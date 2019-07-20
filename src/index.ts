import { Exclude, Expose, Transform } from 'class-transformer';
import 'reflect-metadata';
import TopologicalSort from 'topological-sort';
import { Conditional } from './conditional';
import { KeyValue, KeyValueImpl, transformKeyValueImpl } from './key_value';
import { DefaultStep } from './steps/base';
import { WaitStep } from './steps/wait';
import { Step } from './steps/command';

type PotentialStep = DefaultStep | Conditional<DefaultStep> | Entity;

@Exclude()
export class Entity {
    public readonly name: string;

    public readonly steps: PotentialStep[] = [];

    @Expose()
    @Transform(transformKeyValueImpl)
    public readonly env: KeyValue<this>;

    constructor(name: string) {
        this.name = name;
        this.env = new KeyValueImpl(this);
    }

    add(...step: PotentialStep[]) {
        this.steps.push(...step);
        return this;
    }

    @Expose({ name: 'steps' })
    private get _steps() {
        const stepsWithBlocks = stortedWithBlocks(this);

        // TODO: when step.always = true,
        // then previous step needs a wait step with continueOnFailure: true
        // if step after does not have .always = true a wait step needs to be
        // inserted.
        // See: https://buildkite.com/docs/pipelines/wait-step#continuing-on-failure
        const steps = [];
        let lastWait: WaitStep | undefined = undefined;
        for (const s of stepsWithBlocks) {
            if (s === null) {
                lastWait = new WaitStep();
                steps.push(lastWait);
            } else {
                if (lastWait) {
                    if (s.always && !lastWait.continueOnFailure) {
                        lastWait.continueOnFailure = true;
                    } else if (lastWait.continueOnFailure && !s.always) {
                        lastWait = new WaitStep();
                        steps.push(lastWait);
                    }
                }
                steps.push(s);
            }
        }

        return steps;
    }
}

function unwrapConditional<T extends DefaultStep>(
    conditional: Conditional<T>,
): T | null {
    return conditional.accept() ? conditional.get() : null;
}

function unwrapSteps(steps: PotentialStep[]): DefaultStep[] {
    const ret = [];
    for (const s of steps) {
        if (s instanceof Entity) {
            ret.push(...unwrapSteps(s.steps));
        } else if (s instanceof Conditional) {
            ret.push(unwrapConditional(s));
        } else {
            ret.push(s);
        }
    }
    return ret.filter((s: DefaultStep | null): s is DefaultStep => !!s);
}

function sortedSteps(e: Entity) {
    const steps = unwrapSteps(e.steps);
    const sortOp = new TopologicalSort<DefaultStep, DefaultStep>(
        new Map(steps.map(step => [step, step])),
    );

    for (let step of steps) {
        for (const dependency of step.dependencies) {
            if (steps.indexOf(dependency) === -1) {
                // a dependency has not been added to the graph explicitly,
                // so we add it implicitly
                sortOp.addNode(dependency, dependency);
                steps.push(dependency);
                // maybe we want to rather throw here?
                // Unsure...there could be a strict mode where we:
                // throw new Error(`Step not part of the graph: '${dependency}'`);
            }
            sortOp.addEdge(dependency, step);
        }
    }
    return Array.from(sortOp.sort().values()).map(i => i.node);
}

export function stortedWithBlocks(e: Entity) {
    const sorted = sortedSteps(e);
    // null denotes a block
    const allSteps: (DefaultStep | null)[] = [];
    let lastWaitStep = -1;
    for (const step of sorted) {
        dep: for (const dependency of step.dependencies) {
            const dependentStep = allSteps.indexOf(dependency);
            if (dependentStep !== -1 && dependentStep > lastWaitStep) {
                lastWaitStep = allSteps.push(null) - 1;
                break dep;
            }
        }
        allSteps.push(step);
    }
    return allSteps;
}
