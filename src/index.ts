import TopologicalSort from 'topological-sort';
import ow from 'ow';
import 'reflect-metadata';
import { Expose, Exclude, Transform } from 'class-transformer';
import slug from 'slug';

const exitStatusPredicate = ow.any(ow.string.equals('*'), ow.number.integer);

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
class BranchLimitedStep extends DefaultStep {
    @Expose({ name: 'branches' })
    @Transform((branches: Set<string>) =>
        branches.size ? [...branches].sort().join(' ') : undefined,
    )
    private _branches: Set<string> = new Set();

    withBranch(pattern: string): this {
        ow(pattern, ow.string.nonEmpty);
        this._branches.add(pattern);
        return this;
    }
}

class LabeledStep extends BranchLimitedStep {
    private _label?: string;

    @Expose()
    get label() {
        return this._label;
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

export type ExitStatus = number | '*';

interface Retry<T> {
    automatic(statuses: boolean | Map<ExitStatus, number>): T;
    manual(allowed: boolean, permitOnPassed?: boolean, reason?: string): T;
}

@Exclude()
class RetryImpl extends Chainable<Step> implements Retry<Step> {
    @Expose({ name: 'manual' })
    @Transform((value: RetryManual) => (value.hasValue() ? value : undefined))
    private readonly _manual = new RetryManual();

    @Expose({ name: 'automatic' })
    @Transform((value: boolean | Map<ExitStatus, number>) => {
        if (!value) {
            return undefined;
        }
        if (typeof value === 'boolean') {
            return value;
        }
        return [...value.entries()].map(([exit_status, limit]) => ({
            exit_status,
            limit,
        }));
    })
    private _automatic: boolean | Map<ExitStatus, number> = false;

    hasValue(): boolean {
        return !!(this._manual.hasValue() || this._automatic);
    }

    automatic(statuses: boolean | Map<ExitStatus, number> = true): Step {
        if (typeof statuses !== 'boolean') {
            ow(statuses, ow.map.nonEmpty);
            ow(statuses, ow.map.valuesOfType(ow.number.integer.positive));
            ow(statuses, ow.map.valuesOfType(exitStatusPredicate as any)); // Fix predicate type

            this._automatic =
                typeof this._automatic === 'boolean'
                    ? new Map()
                    : this._automatic;

            for (const [exitStatus, limit] of statuses) {
                this._automatic.set(exitStatus, limit);
            }
        } else {
            this._automatic = statuses;
        }
        return this.parent;
    }

    manual(
        allowed: boolean = true,
        permitOnPassed: boolean = false,
        reason?: string,
    ): Step {
        ow(allowed, ow.boolean);
        ow(permitOnPassed, ow.boolean);
        ow(reason, ow.any(ow.undefined, ow.string.nonEmpty));

        this._manual.allowed = allowed;
        this._manual.permitOnPassed = permitOnPassed;
        this._manual.reason = reason;

        return this.parent;
    }
}

class RetryManual {
    @Transform((value: boolean) => (value ? undefined : false))
    allowed: boolean = true;

    @Expose({ name: 'permit_on_passed' })
    @Transform((value: boolean) => (value ? true : undefined))
    permitOnPassed: boolean = false;

    @Transform((value: string) => value || undefined)
    reason?: string;

    hasValue() {
        return !this.allowed || this.permitOnPassed;
    }
}

@Exclude()
export class Step extends LabeledStep {
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
    @Transform(transformKeyValueImpl)
    public readonly env: KeyValue<this>;

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

    @Expose({ name: 'timeout_in_minutes' })
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

    @Expose({ name: 'plugins' })
    @Transform(transformPlugins)
    public readonly plugins: Plugins<this> = new PluginsImpl(this);

    @Expose({ name: 'soft_fail' })
    @Transform((value: Set<ExitStatus>) => {
        if (!value.size) {
            return undefined;
        } else if (value.has('*')) {
            return true;
        } else {
            return [...value].map(exit_status => ({ exit_status }));
        }
    })
    private _softFail: Set<ExitStatus> = new Set();

    @Expose({ name: 'skip' })
    @Transform((value: boolean) => (value ? value : undefined))
    private _skip?: boolean | string;

    @Expose()
    @Transform((value: RetryImpl) => (value.hasValue() ? value : undefined))
    public readonly retry: Retry<Step> = new RetryImpl(this);

    constructor(plugin: Plugin, label?: string);
    constructor(command: string, label?: string);
    constructor(command: Command, label?: string);
    constructor(commands: (string | Plugin | Command)[], label?: string);
    constructor(
        command: string | Plugin | Command | (string | Plugin | Command)[],
        label?: string,
    ) {
        super();
        this.env = new KeyValueImpl(this);
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

    withId(identifier: string): this {
        ow(identifier, ow.string.nonEmpty);
        this._id = identifier;
        return this;
    }

    withSoftFail(fail: ExitStatus | true): this {
        if (fail !== true) {
            ow(fail, exitStatusPredicate);
        }
        this._softFail.add(fail === true ? '*' : fail);
        return this;
    }

    skip(skip: boolean | string): this {
        if (typeof skip !== 'boolean') {
            ow(skip, ow.string.nonEmpty);
        }
        this._skip = skip;
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

interface Build<T> {
    env: KeyValue<T>;
    metadata: KeyValue<T>;

    withMessage(message: string): T;

    withCommit(commit: string): T;
    withBranch(branch: string): T;
}

@Exclude()
class BuildImpl<T> implements Build<T> {
    @Expose({ name: 'message' })
    private _message?: string;

    @Expose({ name: 'commit' })
    private _commit?: string;

    @Expose({ name: 'branch' })
    private _branch?: string;

    @Expose()
    @Transform(transformKeyValueImpl)
    public readonly env: KeyValue<T>;

    @Expose({ name: 'meta_data' })
    @Transform(transformKeyValueImpl)
    public readonly metadata: KeyValue<T>;

    constructor(private readonly triggerStep: T) {
        this.env = new KeyValueImpl(triggerStep);
        this.metadata = new KeyValueImpl(triggerStep);
    }

    withMessage(message: string): T {
        this._message = message;
        return this.triggerStep;
    }

    withCommit(commit: string): T {
        this._commit = commit;
        return this.triggerStep;
    }

    withBranch(branch: string): T {
        this._branch = branch;
        return this.triggerStep;
    }

    hasData() {
        return (
            this._branch ||
            this._commit ||
            typeof this._message !== 'undefined' ||
            (this.env as KeyValueImpl<T>).vars.size ||
            (this.metadata as KeyValueImpl<T>).vars.size
        );
    }
}

@Exclude()
export class TriggerStep extends LabeledStep {
    @Expose()
    @Transform((value: BuildImpl<any>) => (value.hasData() ? value : undefined))
    public readonly build: Build<TriggerStep> = new BuildImpl(this);

    @Expose({ name: 'async' })
    @Transform((value: boolean) => (value ? value : undefined))
    private _async: boolean = false;

    @Expose()
    get trigger() {
        return this._trigger instanceof Entity
            ? slug(this._trigger.name, { lower: true })
            : this._trigger;
    }

    constructor(
        private readonly _trigger: Entity | string,
        label?: string,
        async: boolean = false,
    ) {
        super();
        if (label) {
            this.withLabel(label);
        }
        this._async = async;
    }

    async(async: boolean): this {
        this._async = async;
        return this;
    }

    toString() {
        return this.label || `[trigger ${this.trigger}]`;
    }
}

interface KeyValue<T> {
    set(name: string, value: string): T;
}

@Exclude()
class KeyValueImpl<T> extends Chainable<T> implements KeyValue<T> {
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
function transformKeyValueImpl(kv: KeyValueImpl<any>) {
    return kv.vars.size ? kv.vars : undefined;
}

@Exclude()
export class Entity {
    public readonly name: string;

    public readonly steps: DefaultStep[] = [];

    @Expose()
    @Transform(transformKeyValueImpl)
    public readonly env: KeyValue<this>;

    constructor(name: string) {
        this.name = name;
        this.env = new KeyValueImpl(this);
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

@Expose()
abstract class Field {
    public readonly required?: false;

    constructor(
        public readonly key: string,
        public readonly label?: string,
        public readonly hint?: string,
        required: boolean = false,
    ) {
        ow(key, ow.string.nonEmpty);
        ow(key, ow.string.matches(/[0-9a-z-\/]+/i));
        if (!required) {
            this.required = required;
        }
    }
}

@Expose()
export class TextField extends Field {
    private readonly default?: string;

    constructor(
        key: string,
        label?: string,
        hint?: string,
        required: boolean = true,
        defaultValue?: string,
    ) {
        super(key, label, hint, required);
        this.default = defaultValue;
    }
}

export class Option {
    constructor(
        private readonly label: string,
        private readonly value: string,
    ) {
        ow(label, ow.string.nonEmpty);
        ow(value, ow.string.nonEmpty);
    }
}

@Expose()
export class SelectField extends Field {
    private options: Option[] = [];
    private readonly multiple?: true;
    private readonly default?: string | string[];

    constructor(
        key: string,
        label?: string,
        hint?: string,
        required?: boolean,
        multiple?: false,
        defaultValue?: string,
    );
    constructor(
        key: string,
        label?: string,
        hint?: string,
        required?: boolean,
        multiple?: true,
        defaultValue?: string | string[],
    );
    constructor(
        key: string,
        label?: string,
        hint?: string,
        required: boolean = true,
        multiple: boolean = false,
        defaultValue?: string | string[],
    ) {
        super(key, label, hint, required);
        this.default = defaultValue;
        if (multiple) {
            this.multiple = multiple;
        }
    }

    addOption(option: Option) {
        this.options.push(option);
        return this;
    }
}

interface Fields<T> {
    add(field: Field): T;
}

@Exclude()
class FieldsImpl extends Chainable<BlockStep> implements Fields<BlockStep> {
    fields: Map<string, Field> = new Map();

    add(field: Field) {
        this.fields.set(field.key, field);
        return this.parent;
    }

    hasFields(): boolean {
        return this.fields.size > 0;
    }
}

@Exclude()
export class BlockStep extends BranchLimitedStep {
    @Expose({ name: 'block' })
    private readonly title: string;

    @Expose()
    private readonly prompt?: string;

    @Expose()
    @Transform((value: FieldsImpl) =>
        value.hasFields() ? [...value.fields.values()] : undefined,
    )
    public readonly fields: Fields<BlockStep> = new FieldsImpl(this);

    constructor(title: string, prompt?: string) {
        super();
        this.title = title;
        this.prompt = prompt;
    }

    toString() {
        return `[block for '${this.title}']`;
    }
}
