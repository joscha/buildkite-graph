import { serialize } from 'class-transformer';
import { Pipeline } from '../';
import { Serializer } from '.';

export class JsonSerializer implements Serializer<object | string> {
    constructor(private readonly stringify: boolean = false) {}

    serialize(e: Pipeline): object | string {
        const serialized = serialize(e);
        // Workaround to get rid of undefined values
        return this.stringify ? serialized : JSON.parse(serialized);
    }
}
