import TopologicalSort from 'topological-sort';

import ow from 'ow';

import 'reflect-metadata';

import { Expose, Exclude, Transform } from 'class-transformer';
import slug from 'slug';

interface BaseStep {}

// see https://github.com/microsoft/TypeScript/issues/22815#issuecomment-375766197
interface DefaultStep extends BaseStep {}
abstract class DefaultStep implements BaseStep {
    @Exclude()
    public readonly dependencies: Set<DefaultStep> = new Set();

    private _label?: string;

    @Expose()
    get label() {
        return this._label;
    }

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

    withLabel(label: string) {
        this._label = label;
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
        /* istanbul ignore next */
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

function assertTimeout(timeout: number) {
    ow(timeout, ow.number.integerOrInfinite.positive);
}

export class Command {
    constructor(public command: string, public timeout: number = Infinity) {
        ow(command, ow.string.not.empty);
        assertTimeout(timeout);
    }

    toString() {
        return this.command;
    }
}

@Exclude()
export class Step extends DefaultStep {
    @Expose({ name: 'command' })
    @Transform((value: Command[]) => {
        if (!value || value.length === 0) {
            return undefined;
        }
        return value.length === 1
            ? value[0].command
            : value.map(c => c.command);
    })
    public readonly command: Command[] = [];

    @Expose()
    @Transform(value => transformEnv(value))
    public readonly env: Env<this>;

    private _id?: string;
    @Expose({ name: 'id' })
    get id() {
        return this._id;
    }

    private _parallelism?: number;

    @Expose({ name: 'parallelism' })
    get paralellism() {
        return this._parallelism;
    }

    @Expose()
    private concurrency?: number;

    @Expose({ name: 'concurrency_group' })
    private concurrencyGroup?: string;

    @Expose({ name: 'artifact_paths' })
    @Transform((paths: Set<string>) => (paths.size ? paths : undefined))
    private _artifactPaths: Set<string> = new Set();

    private _agents: Map<string, string> = new Map();

    @Expose()
    @Transform((agents: Map<string, string>) =>
        agents.size ? agents : undefined,
    )
    get agents() {
        return this._agents;
    }

    private _timeout?: number;

    @Expose({ name: 'timeout' })
    get timeout() {
        if (this._timeout === Infinity || this._timeout === 0) {
            return undefined;
        } else if (this._timeout) {
            return this._timeout;
        }
        if (this.command) {
            const value = this.command.reduce((acc, command) => {
                acc += command.timeout;
                return acc;
            }, 0);
            if (value === Infinity || value === 0) {
                return undefined;
            } else if (value) {
                return value;
            }
        }
    }

    @Expose({ name: 'branches' })
    @Transform((branches: Set<string>) =>
        branches.size ? [...branches].sort().join(' ') : undefined,
    )
    private _branches: Set<string> = new Set();

    @Expose({ name: 'plugins' })
    @Transform(transformPlugins)
    public readonly plugins: Plugins<this> = new PluginsImpl(this);

    constructor(plugin: Plugin, label?: string);
    constructor(command: string, label?: string);
    constructor(command: Command, label?: string);
    constructor(commands: (string | Plugin | Command)[], label?: string);
    constructor(
        command: string | Plugin | Command | (string | Plugin | Command)[],
        label?: string,
    ) {
        super();
        this.env = new EnvImpl(this);
        if (label) {
            this.withLabel(label);
        }
        if (Array.isArray(command)) {
            ow(command, ow.array.minLength(1));
            for (const c of command) {
                this.add(c);
            }
        } else {
            this.add(command);
        }
    }

    add(c: string | Plugin | Command) {
        if (c instanceof Plugin) {
            this.plugins.add(c);
        } else if (typeof c === 'string') {
            this.command.push(new Command(c));
        } else if (c instanceof Command) {
            this.command.push(c);
        }
        return this;
    }

    /**
     *
     * @param timeout for the step in seconds.
     */
    withTimeout(timeout: number = Infinity): this {
        assertTimeout(timeout);
        this._timeout = timeout;
        return this;
    }

    withParallelism(parallelism: number): this {
        ow(parallelism, ow.number.integer.positive);
        this._parallelism = parallelism;
        return this;
    }

    withAgent(key: string, value: string): this {
        ow(key, ow.string.nonEmpty);
        ow(value, ow.string.nonEmpty);
        this._agents.set(key, value);
        return this;
    }

    withBranch(pattern: string): this {
        ow(pattern, ow.string.nonEmpty);
        this._branches.add(pattern);
        return this;
    }

    withArtifactPath(glob: string): this {
        ow(glob, ow.string.nonEmpty);
        this._artifactPaths.add(glob);
        return this;
    }

    withConcurrency(concurrency: number, group: string): this {
        ow(concurrency, ow.number.integer.positive);
        this.concurrency = concurrency;
        this.concurrencyGroup = group;
        return this;
    }

    withId(identifier: string) {
        ow(identifier, ow.string.nonEmpty);
        this._id = identifier;
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
        return slug(this.triggeredEntity.name, { lower: true });
    }

    @Expose({ name: 'build' })
    private get _build() {
        return { env: (this.build.env as EnvImpl<any>).vars };
    }

    constructor(public readonly triggeredEntity: Entity, label?: string) {
        super();
        if (label) {
            this.withLabel(label);
        }
    }

    toString() {
        return this.label || `Trigger ${this.triggeredEntity.name}`;
    }
}

interface Env<T> {
    set(name: string, value: string): T;
}

@Exclude()
class EnvImpl<T> extends Chainable<T> implements Env<T> {
    @Expose({ name: 'env' })
    public readonly vars: Map<string, string> = new Map();

    set(name: string, value: string): T {
        ow(name, ow.string.nonEmpty);
        ow(value, ow.string.nonEmpty);
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

    add(...step: DefaultStep[]) {
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

function sortedSteps(e: Entity) {
    const sortOp = new TopologicalSort<DefaultStep, DefaultStep>(
        new Map(e.steps.map(step => [step, step])),
    );

    for (const step of e.steps) {
        for (const dependency of step.dependencies) {
            if (e.steps.indexOf(dependency) === -1) {
                // a dependency has not been added to the graph explicitly,
                // so we add it implicitly
                sortOp.addNode(dependency, dependency);
                e.steps.push(dependency);
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
