import slugify from '@sindresorhus/slugify';
import { Step } from './base';
import { Conditional } from './conditional';
import { KeyValue, KeyValueImpl } from './key_value';
import {
  ToJsonSerializationOptions,
  toJsonSerializationDefaultOptions,
  Serializable,
  SerializationOptions,
} from './serialization';
import { DotSerializer } from './serializers/dot';
import { JsonSerializer } from './serializers/json';
import { StructuralSerializer } from './serializers/structural';
import { YamlSerializer } from './serializers/yaml';
import { sortedSteps } from './sortedSteps';
import { sortedWithBlocks } from './sortedWithBlocks';
import { WaitStep } from './steps/wait';
import { isEqual } from 'lodash';
import { ok } from 'assert';
export { ExitStatus, Step } from './base';
export { Conditional, Generator, ThingOrGenerator } from './conditional';
export { KeyValue } from './key_value';
export { MutatorFn, Serializer } from './serializers';
export {
  SerializationOptions,
  Serializable,
  ToJsonSerializationOptions,
} from './serialization';
export { BlockStep } from './steps/block';
export { Option, SelectField, TextField } from './steps/block/fields';
export { Command, CommandStep } from './steps/command';
export { Plugin } from './steps/command/plugins';
export { TriggerStep } from './steps/trigger';
export const serializers = {
  DotSerializer,
  JsonSerializer,
  StructuralSerializer,
  YamlSerializer,
};

export type PotentialStep<S extends Step = Step> = S | Conditional<S>;

export class Pipeline implements Serializable {
  public readonly name: string;

  public readonly steps: PotentialStep[] = [];

  public readonly env: KeyValue<this>;

  constructor(name: string) {
    this.name = name;
    this.env = new KeyValueImpl(this);
  }

  add(...step: PotentialStep[]): this {
    step.forEach((s) => {
      if (this.steps.includes(s)) {
        throw new Error('Can not add the same step more than once');
      }
      this.steps.push(s);
    });
    return this;
  }

  slug(): string {
    return slugify(this.name, {
      lowercase: true,
      customReplacements: [['_', '-']],
      decamelize: false,
    });
  }

  async toList(
    opts: ToJsonSerializationOptions = toJsonSerializationDefaultOptions,
  ): Promise<(WaitStep | Step)[]> {
    if (opts.explicitDependencies) {
      const sorted = await sortedSteps(
        this,
        opts.cache,
        opts.acceptAllConditions,
      );
      return sorted;
    }

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const stepsWithBlocks = await sortedWithBlocks(this);
    const steps: (WaitStep | Step)[] = [];
    let lastWait: WaitStep | undefined = undefined;
    for (const s of stepsWithBlocks) {
      if (s === null) {
        lastWait = new WaitStep();
        steps.push(lastWait);
      } else {
        if (lastWait) {
          if (s.always && !lastWait.continueOnFailure) {
            lastWait.continueOnFailure = true;
          } else if (lastWait.continueOnFailure && !s.always) {
            lastWait = new WaitStep();
            steps.push(lastWait);
          }
        }
        steps.push(s);
      }
    }
    return steps;
  }

  async toJson(
    opts: SerializationOptions = { explicitDependencies: false },
  ): Promise<Record<string, unknown>> {
    const newOpts: ToJsonSerializationOptions = opts.explicitDependencies
      ? {
          explicitDependencies: true,
          acceptAllConditions: !!opts.acceptAllConditions,
          cache: new Map(),
        }
      : toJsonSerializationDefaultOptions;

    const steps = await this.toList(newOpts);
    if (opts.mutator) {
      for (const step of steps) {
        if (!(step instanceof Step)) {
          continue;
        }
        const deps = {
          dependencies: new Set(step.dependencies),
          effectDependencies: new Set(step.effectDependencies),
        };
        await opts.mutator(step);
        ok(
          isEqual(deps, {
            dependencies: step.dependencies,
            effectDependencies: step.effectDependencies,
          }),
          'mutator must not mutate dependencies or effects',
        );
      }
    }

    return {
      env: await (this.env as KeyValueImpl<this>).toJson(),
      steps: await Promise.all(steps.map((s) => s.toJson(newOpts))),
    };
  }
}
