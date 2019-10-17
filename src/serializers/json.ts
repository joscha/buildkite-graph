import { Pipeline } from '../';
import { Serializer } from '.';

export class JsonSerializer implements Serializer<object | string> {
    constructor(private readonly stringify: boolean = false) {}

    async serialize(e: Pipeline): Promise<object | string> {
        const serialized = JSON.stringify(await e.toJson());
        // Workaround to get rid of undefined values
        return this.stringify ? serialized : JSON.parse(serialized);
    }
}
