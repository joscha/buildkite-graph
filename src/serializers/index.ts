import { Pipeline, Step } from '../';
export type MutatorFn = (entity: Step) => Promise<void>;
export interface Serializer<T> {
  serialize(e: Pipeline): Promise<T>;
}
