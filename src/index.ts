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

    @Exclude()
    public always: boolean = false;

    alwaysExecute() {
        this.always = true;
        return this;
    }
}

@Exclude()
abstract class Chainable<T> {
    constructor(protected readonly parent: T) {
        this.parent = parent;
    }
}

class WaitStep implements BaseStep {
    public readonly wait: null = null;

    // TODO: Omit this when not true once
    // https://github.com/typestack/class-transformer/issues/273
    // has been fixed
    @Expose({ name: 'continue_on_failure' })
    public continueOnFailure?: true;

    constructor(continueOnFailure?: true) {
        this.continueOnFailure = continueOnFailure;
    }

    toString() {
        return '[wait]';
    }
}

interface Plugins<T> {
    add(plugin: Plugin): T;
}

function transformPlugins(value: PluginsImpl<any>) {
    if (!value.plugins.length) {
        return undefined;
    }

    return value.plugins.map(plugin => {
        return {
            [plugin.pluginNameOrPath]: plugin.configuration || null,
        };
    });
}

@Exclude()
class PluginsImpl<T> extends Chainable<T> implements Plugins<T> {
    public plugins: Plugin[] = [];

    add(plugin: Plugin) {
        this.plugins.push(plugin);
        return this.parent;
    }
}

export class Step extends DefaultStep {
    public parallelism?: number;

    @Transform(value =>
        value ? (value.length === 1 ? value[0] : value) : undefined,
    )
    public readonly command?: string[];

    @Transform(transformPlugins)
    public readonly plugins: Plugins<this> = new PluginsImpl(this);

    constructor(plugin: Plugin, label?: string);
    constructor(command: string, label?: string);
    constructor(commands: string[], label?: string);
    constructor(
        command: string | string[] | Plugin,
        public readonly label?: string,
    ) {
        super();
        if (command instanceof Plugin) {
            this.plugins.add(command);
        } else if (typeof command === 'string') {
            ow(command, ow.string.not.empty);
            this.command = [command];
        } else {
            ow(command, ow.array.minLength(1));
            ow(command, ow.array.ofType(ow.string.not.empty));
            this.command = command;
        }
    }

    withParallelism(parallelism: number): this {
        ow(parallelism, ow.number.positive);
        this.parallelism = parallelism;
        return this;
    }

    toString() {
        return (
            this.label ||
            (this.command
                ? `<${this.command.join(' && ')}>`
                : this.plugins.toString())
        );
    }
}

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
class EnvImpl<T> extends Chainable<T> implements Env<T> {
    @Expose({ name: 'env' })
    public readonly vars: Map<string, Primitive> = new Map();

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

export class Plugin {
    constructor(
        public readonly pluginNameOrPath: string,
        public readonly configuration?: object,
    ) {
        ow(pluginNameOrPath, ow.string.not.empty);
    }
}
