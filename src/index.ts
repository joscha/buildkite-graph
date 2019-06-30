import TopologicalSort from 'topological-sort';

import ow from 'ow';

import 'reflect-metadata';

import { Expose, Exclude, Transform } from 'class-transformer';

type Primitive = number | string | boolean;

interface BaseStep {}

// see https://github.com/microsoft/TypeScript/issues/22815#issuecomment-375766197
interface DefaultStep extends BaseStep {}
abstract class DefaultStep implements BaseStep {
    @Exclude()
    public readonly dependencies: Set<DefaultStep> = new Set();

    dependsOn(step: DefaultStep): this {
        this.dependencies.add(step);
        return this;
    }
}

type Wait = {
    wait: null;
    continue_on_failure?: true;
};

class WaitStep implements BaseStep {
    // TODO: Omit this when not true once
    // https://github.com/typestack/class-transformer/issues/273
    // has been fixed
    @Expose({ name: 'continue_on_failure' })
    public continueOnFailure?: true;

    public readonly wait: null = null;

    constructor(continueOnFailure?: true) {
        this.continueOnFailure = continueOnFailure;
    }

    toString() {
        return '[wait]';
    }
}

type Default = {
    label?: string;
    command: string | string[];
    parallelism?: number;
};

export class Step extends DefaultStep {
    public parallelism?: number;

    public readonly command: string | string[];

    constructor(command: string | string[], public readonly label?: string) {
        super();
        if (typeof command === 'string') {
            ow(command, ow.string.not.empty);
            this.command = command;
        } else {
            ow(command, ow.array.minLength(1));
            ow(command, ow.array.ofType(ow.string.not.empty));
            this.command = command.length === 1 ? command[0] : command;
        }
    }

    withParallelism(parallelism: number): this {
        ow(parallelism, ow.number.positive);
        this.parallelism = parallelism;
        return this;
    }

    toString() {
        return this.label;
    }
}

type Trigger = {
    trigger: string;
    build?: Build;
};

class Build {
    public readonly env: Env<TriggerStep>;
    constructor(triggerStep: TriggerStep) {
        this.env = new EnvImpl(triggerStep);
    }
}

@Exclude()
export class TriggerStep extends DefaultStep {
    public readonly build = new Build(this);

    @Expose()
    get trigger() {
        return this.triggeredEntity.name;
    }

    @Expose({ name: 'build' })
    private get _build() {
        return { env: (this.build.env as EnvImpl<any>).vars };
    }

    constructor(
        public readonly triggeredEntity: Entity,
        public readonly label?: string,
    ) {
        super();
    }

    toString() {
        return this.label || `Trigger ${this.triggeredEntity.name}`;
    }
}

interface Env<T> {
    set(name: string, value: Primitive): T;
}

@Exclude()
class EnvImpl<T> implements Env<T> {
    @Exclude()
    private readonly parent: T;

    @Expose({ name: 'env' })
    public readonly vars: Map<string, Primitive> = new Map();

    constructor(parent: T) {
        this.parent = parent;
    }

    set(name: string, value: Primitive): T {
        this.vars.set(name, value);
        return this.parent;
    }
}

// TODO: remove this once
// https://github.com/typestack/class-transformer/issues/274
// is fixed
function transformEnv(env: EnvImpl<any>) {
    return env.vars.size ? env.vars : undefined;
}

@Exclude()
export class Entity {
    public readonly name: string;

    public readonly steps: DefaultStep[] = [];

    @Expose()
    @Transform(value => transformEnv(value))
    public readonly env: Env<this>;

    constructor(name: string) {
        this.name = name;
        this.env = new EnvImpl(this);
    }

    add(step: DefaultStep) {
        this.steps.push(step);
        return this;
    }

    @Expose({ name: 'steps' })
    private get _steps() {
        const allSteps = stortedWithBlocks(this);

        return [...allSteps.map(s => s || new WaitStep())].filter(Boolean);
    }
}

function sortedSteps(e: Entity) {
    const sortOp = new TopologicalSort<DefaultStep, DefaultStep>(
        new Map(e.steps.map(step => [step, step])),
    );

    for (const step of e.steps) {
        for (const dependency of step.dependencies) {
            if (e.steps.indexOf(dependency) === -1) {
                //throw new Error(`Step not part of the graph: '${dependency}'`);
                sortOp.addNode(dependency, dependency);
                e.steps.push(dependency);
            }
            sortOp.addEdge(dependency, step);
        }
    }
    return Array.from(sortOp.sort().values()).map(i => i.node);
}

export function stortedWithBlocks(e: Entity) {
    const sorted = sortedSteps(e);
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
