import { MutatorFn } from './serializers';
import { StepCache } from './unwrapSteps';

type JSON = Record<string, unknown> | JSON[];

export interface Serializable {
  toJson(opts?: ToJsonSerializationOptions): Promise<JSON | undefined>;
}

export type SerializationOptions = {
  /**
   * Whether to use the new depends_on syntax which allows the serializer to serialize into a graph with dependencies instead of a list with wait steps.
   * More details here: https://buildkite.com/docs/pipelines/dependencies#defining-explicit-dependencies
   */
  explicitDependencies?: boolean;
  /**
   * Whether accept all conditional steps regardlss of it's being rejected or not. This is particularlly helpful in some places whether you want to generate the entire
   * graph without conditions. Plese note this would only work when `explicitDependencies` above is set to true.
   */
  acceptAllConditions?: boolean;
  /**
   * Allows passing in a method that will be called on every Step in a topological sorted list of steps
   * This mutator can mutate anything in a Step except things that can change the structural integrity of the DAG.
   * i.e. the mutator must not mutate anything in Step dependencies or effective dependencies, and also must be
   * mutated in place.
   * Example: examples/mutate_graph.ts
   */
  mutator?: MutatorFn;
};

export type ToJsonSerializationOptions =
  | {
      explicitDependencies: true;
      acceptAllConditions: boolean;
      cache: StepCache;
    }
  | {
      explicitDependencies: false;
      acceptAllConditions: false;
    };

export const toJsonSerializationDefaultOptions: ToJsonSerializationOptions = {
  explicitDependencies: false,
  acceptAllConditions: false,
};
