import { Pipeline, SerializationOptions } from '../';
import { Serializer } from '.';

type JsonSerializationOptions = {
    stringify?: boolean;
} & SerializationOptions;

export class JsonSerializer implements Serializer<object | string> {
    constructor(private readonly opts: JsonSerializationOptions = {}) {}

    async serialize(e: Pipeline): Promise<object | string> {
        const serialized = JSON.stringify(await e.toJson(this.opts));
        // Workaround to get rid of undefined values
        return this.opts.stringify ? serialized : JSON.parse(serialized);
    }
}
