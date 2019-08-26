import { classToPlain } from 'class-transformer';
import { Pipeline } from '../';
import { Serializer } from '.';

export class JsonSerializer implements Serializer<object | string> {
    constructor(private readonly stringify: boolean = false) {}

    serialize(e: Pipeline): object | string {
        // Workaround to get rid of undefined values
        const json = JSON.parse(JSON.stringify(classToPlain(e)));
        return this.stringify ? JSON.stringify(json) : json;
    }
}
