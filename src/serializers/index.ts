import { Pipeline, Step } from '../';

/**
 * Step mutator callback signature; This function is called for every `Step` in a topologically sorted `Pipeline` when being passed to supporting serializers.
 *
 * @param entity the `Step` to be muted. Mutations must happen in-place (it is not possible to replace the `Step` as a whole and dependencies and effects must not be altered.
 */
export type MutatorFn = (entity: Step) => Promise<void>;
export interface Serializer<T> {
  serialize(e: Pipeline): Promise<T>;
}
