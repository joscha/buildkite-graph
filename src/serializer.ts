import { Entity } from './';

export interface Serializer<T> {
    serialize(e: Entity): T;
}
