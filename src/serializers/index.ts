import { Pipeline, Step } from '../';

/**
 * method signature for the mutator to run on every step in a topologically sorted pipeline
 * @param entity the step being muted. This must be mutated in-place a step must not be mutated into a different object, and its dependencies
 * or effective dependencies must not be mutated.
 * @returns void the step must be mutated in-place.
 */
export type MutatorFn = (entity: Step) => Promise<void>;
export interface Serializer<T> {
  serialize(e: Pipeline): Promise<T>;
}
