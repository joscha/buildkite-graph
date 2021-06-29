import ow from 'ow';
import sortBy from 'lodash.sortby';
import {
  PotentialStep,
  Serializable,
  ToJsonSerializationOptions,
} from './index';
import uniqid from 'uniqid';
import { unwrapSteps } from './unwrapSteps';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseStep {}

// see https://github.com/microsoft/TypeScript/issues/22815#issuecomment-375766197
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Step extends BaseStep {}
export abstract class Step implements BaseStep, Serializable {
  /**
   * A set of potential steps that are hard dependencies to the
   * current step. Each of these will be marked as accepted in case
   * it is a Conditional and added to the graph as a side-effect.
   */
  public readonly dependencies: Set<PotentialStep> = new Set();

  /**
   * A set of potential steps the current step is an effect of.
   * The current step will only be added if the potential step
   * is accepted; the effect dependency will not be added to the
   * graph automatically
   */
  public readonly effectDependencies: Set<PotentialStep> = new Set();

  private _key?: string;

  get key(): string {
    this._key = this._key || uniqid();
    return this._key;
  }

  private _allowDependencyFailure = false;
  allowDependencyFailure(allow = true): this {
    this._allowDependencyFailure = allow;
    return this;
  }

  /**
   * @deprecated
   */
  withId(identifier: string): this {
    /* istanbul ignore next */
    return this.withKey(identifier);
  }

  withKey(identifier: string): this {
    ow(identifier, ow.string.nonEmpty.maxLength(100));
    this._key = identifier;
    return this;
  }

  private assertEffectOrDependency(...steps: PotentialStep[]): void {
    ow(steps, ow.array.ofType(ow.object.nonEmpty));
    if (steps.includes(this)) {
      throw new Error('Self-references are not supported');
    }
  }

  /**
   * This marks the given step or conditional as a dependency to the current
   * step.
   * In case the dependency is a conditional, then that conditional will
   * always be added to the graph (e.g. the value of the accept function of that
   * conditional will be trumped by the fact that the current step depends on it)
   */
  dependsOn(...steps: PotentialStep[]): this {
    this.assertEffectOrDependency(...steps);
    // iterate in reverse so if dependencies are not added to the graph, yet
    // they will be added in the order they are given as dependencies
    for (let i = steps.length; i > 0; i--) {
      const step = steps[i - 1];
      this.dependencies.add(step);
      this.effectDependencies.delete(step);
    }
    return this;
  }

  isEffectOf(...steps: PotentialStep[]): this {
    this.assertEffectOrDependency(...steps);
    steps.forEach((s) => {
      this.effectDependencies.add(s);
      this.dependencies.delete(s);
    });
    return this;
  }

  public always = false;

  alwaysExecute(): this {
    this.always = true;
    return this;
  }

  async toJson(
    opts: ToJsonSerializationOptions = { explicitDependencies: false },
  ): Promise<Record<string, unknown>> {
    if (!opts.explicitDependencies) {
      return {};
    }
    const dependsOn = sortBy(
      (
        await unwrapSteps(
          [...this.dependencies, ...this.effectDependencies],
          opts.cache,
        )
      ).map((s) => ({
        step: s.key,
        allow_failure: this._allowDependencyFailure
          ? undefined
          : this.always || undefined,
      })),
      'step',
    );
    return {
      key: this.key,
      depends_on: dependsOn.length ? dependsOn : undefined,
      allow_dependency_failure: this._allowDependencyFailure || undefined,
    };
  }
}

export class BranchLimitedStep extends Step {
  private branches: Set<string> = new Set();

  withBranch(pattern: string): this {
    ow(pattern, ow.string.nonEmpty);
    this.branches.add(pattern);
    return this;
  }
  async toJson(
    opts: ToJsonSerializationOptions = { explicitDependencies: false },
  ): Promise<Record<string, unknown>> {
    return {
      branches: this.branches.size
        ? [...this.branches].sort().join(' ')
        : undefined,
      ...(await super.toJson(opts)),
    };
  }
}

export class LabeledStep extends BranchLimitedStep {
  private _label?: string;

  get label(): string | undefined {
    return this._label;
  }

  withLabel(label: string): this {
    this._label = label;
    return this;
  }

  async toJson(
    opts: ToJsonSerializationOptions = { explicitDependencies: false },
  ): Promise<Record<string, unknown>> {
    return {
      label: this.label,
      ...(await super.toJson(opts)),
    };
  }
}

export abstract class Chainable<T> {
  constructor(protected readonly parent: T) {
    this.parent = parent;
  }
}

export type ExitStatus = number | '*';

export const exitStatusPredicate = ow.any(
  ow.string.equals('*'),
  ow.number.integer,
);

export function mapToObject<T>(m: Map<string, T>): Record<string, T> {
  return Array.from(m).reduce<Record<string, T>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}
