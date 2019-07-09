import { Serializer } from '../serializer';
import { Entity } from '../';
import { classToPlain } from 'class-transformer';

export class JsonSerializer implements Serializer<object> {
    serialize(e: Entity) {
        // Workaround to get rid of undefined values
        return JSON.parse(JSON.stringify(classToPlain(e)));
    }
}
