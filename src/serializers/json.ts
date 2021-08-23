import { Pipeline, SerializationOptions } from '../';
import { MutatorFn, Serializer } from '.';

type JsonSerializationOptions = {
  stringify?: boolean;
  mutator?: MutatorFn;
} & SerializationOptions;

export class JsonSerializer
  implements Serializer<Record<string, unknown> | string>
{
  constructor(private readonly opts: JsonSerializationOptions = {}) {}

  async serialize(
    e: Pipeline,
    mutator?: MutatorFn,
  ): Promise<Record<string, unknown> | string> {
    const serialized = JSON.stringify(
      await e.toJson({ ...this.opts, mutator }),
    );
    // Workaround to get rid of undefined values
    return this.opts.stringify ? serialized : JSON.parse(serialized);
  }
}
