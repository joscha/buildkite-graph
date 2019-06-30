import { Serializer } from '../serializer';
import { Entity } from '../';
import { classToPlain } from 'class-transformer';

export class JsonSerializer implements Serializer<object> {
    serialize(e: Entity) {
        // TODO: filter undefined values
        return classToPlain(e);
    }
}
