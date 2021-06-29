import { Pipeline, SerializationOptions } from '../';
import { Serializer } from '.';

type JsonSerializationOptions = {
    stringify?: boolean;
} & SerializationOptions;

export class JsonSerializer
    implements Serializer<Record<string, unknown> | string>
{
    constructor(private readonly opts: JsonSerializationOptions = {}) {}

    async serialize(e: Pipeline): Promise<Record<string, unknown> | string> {
        const serialized = JSON.stringify(await e.toJson(this.opts));
        // Workaround to get rid of undefined values
        return this.opts.stringify ? serialized : JSON.parse(serialized);
    }
}
