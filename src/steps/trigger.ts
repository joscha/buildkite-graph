import { Exclude, Expose, Transform } from 'class-transformer';
import { Pipeline } from '../';
import { LabeledStep } from '../base';
import { Build, BuildImpl } from './trigger/build';

@Exclude()
export class TriggerStep extends LabeledStep {
    @Expose()
    get trigger(): string {
        return this._trigger instanceof Pipeline
            ? this._trigger.slug()
            : this._trigger;
    }

    @Expose({ name: 'async' })
    @Transform((value: boolean) => (value ? value : undefined))
    private _async = false;

    @Expose()
    @Transform((value: BuildImpl<any>) => (value.hasData() ? value : undefined))
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
}
