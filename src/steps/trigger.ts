import { Pipeline, Serializable } from '../index';
import { LabeledStep } from '../base';
import { Build, BuildImpl } from './trigger/build';

export class TriggerStep extends LabeledStep implements Serializable {
    get trigger(): string {
        return this._trigger instanceof Pipeline
            ? this._trigger.slug()
            : this._trigger;
    }

    private _async = false;

    public readonly build: Build<TriggerStep> = new BuildImpl(this);

    constructor(
        private readonly _trigger: Pipeline | string,
        label?: string,
        async = false,
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
    toString(): string {
        return this.label || `[trigger ${this.trigger}]`;
    }

    async toJson(): Promise<object> {
        return {
            ...(await super.toJson()),
            trigger: this.trigger,
            async: this._async || undefined,
            build: await (this.build as BuildImpl<this>).toJson(),
        };
    }
}
