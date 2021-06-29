import ow from 'ow';
import { BranchLimitedStep } from '../base';
import { Fields, FieldsImpl } from './block/fields';
import { ToJsonSerializationOptions } from 'src';

export class BlockStep extends BranchLimitedStep {
  private readonly title: string;
  private readonly prompt?: string;
  public readonly fields: Fields<this> = new FieldsImpl(this);
  constructor(title: string, prompt?: string) {
    super();
    ow(title, ow.string.nonEmpty);
    this.title = title;
    this.prompt = prompt;
  }

  toString(): string {
    return `[block for '${this.title}']`;
  }

  async toJson(
    opts: ToJsonSerializationOptions = { explicitDependencies: false },
  ): Promise<Record<string, unknown>> {
    return {
      ...(await super.toJson(opts)),
      block: this.title,
      prompt: this.prompt,
      fields: await (this.fields as FieldsImpl<this>).toJson(),
    };
  }
}
