import { BranchLimitedStep } from '../base';
import { Fields, FieldsImpl } from './block/fields';

export class BlockStep extends BranchLimitedStep {
    private readonly title: string;
    private readonly prompt?: string;
    public readonly fields: Fields<this> = new FieldsImpl(this);
    constructor(title: string, prompt?: string) {
        super();
        this.title = title;
        this.prompt = prompt;
    }

    toString(): string {
        return `[block for '${this.title}']`;
    }

    async toJson() {
        return {
            ...(await super.toJson()),
            block: this.title,
            prompt: this.prompt,
            fields: await (this.fields as FieldsImpl<this>).toJson(),
        };
    }
}
