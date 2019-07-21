import { classToPlain } from 'class-transformer';
import { Pipeline } from '../';
import { Serializer } from '.';

export class JsonSerializer implements Serializer<object> {
    serialize(e: Pipeline): object {
        // Workaround to get rid of undefined values
        return JSON.parse(JSON.stringify(classToPlain(e)));
    }
}
