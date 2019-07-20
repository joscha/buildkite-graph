import { Exclude, Expose, Transform } from 'class-transformer';
import { BranchLimitedStep } from '../base';
import { Fields, FieldsImpl } from './block/fields';

@Exclude()
export class BlockStep extends BranchLimitedStep {
    @Expose({ name: 'block' })
    private readonly title: string;
    @Expose()
    private readonly prompt?: string;
    @Expose()
    @Transform((value: FieldsImpl<any>) =>
        value.hasFields() ? [...value.fields.values()] : undefined,
    )
    public readonly fields: Fields<this> = new FieldsImpl(this);
    constructor(title: string, prompt?: string) {
        super();
        this.title = title;
        this.prompt = prompt;
    }
    toString() {
        return `[block for '${this.title}']`;
    }
}
