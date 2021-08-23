import { Pipeline } from '../';
import { Step } from 'src/base';
export type MutatorFn = (entity: Step) => Promise<void>;
export interface Serializer<T> {
  serialize(e: Pipeline): Promise<T>;
}
