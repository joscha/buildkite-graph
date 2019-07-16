import TopologicalSort from 'topological-sort';
import ow from 'ow';
import 'reflect-metadata';
import { Expose, Exclude, Transform } from 'class-transformer';
import slug from 'slug';
import {
    Chainable,
    LabeledStep,
    DefaultStep,
    BranchLimitedStep,
} from './steps/base';
import { WaitStep } from './steps/wait';
import { KeyValue, KeyValueImpl, transformKeyValueImpl } from './key_value';

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
