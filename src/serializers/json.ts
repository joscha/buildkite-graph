import { Serializer } from '../serializer';
import { Pipeline } from '../';
import { classToPlain } from 'class-transformer';

export class JsonSerializer implements Serializer<object> {
    serialize(e: Pipeline) {
        // Workaround to get rid of undefined values
        return JSON.parse(JSON.stringify(classToPlain(e)));
    }
}
