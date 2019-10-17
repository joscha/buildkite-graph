import { Pipeline } from '../';

export interface Serializer<T> {
    serialize(e: Pipeline): Promise<T>;
}
