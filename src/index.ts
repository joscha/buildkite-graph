import slugify from '@sindresorhus/slugify';
import { Step } from './base';
import { Conditional } from './conditional';
import { KeyValue, KeyValueImpl } from './key_value';
import { DotSerializer } from './serializers/dot';
import { JsonSerializer } from './serializers/json';
import { StructuralSerializer } from './serializers/structural';
import { YamlSerializer } from './serializers/yaml';
import { sortedSteps } from './sortedSteps';
import { sortedWithBlocks } from './sortedWithBlocks';
import { WaitStep } from './steps/wait';
import { StepCache } from './unwrapSteps';
export { ExitStatus, Step } from './base';
export { Conditional, Generator, ThingOrGenerator } from './conditional';
export { KeyValue } from './key_value';
export { Serializer } from './serializers';
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

export type SerializationOptions = {
    /**
     * Whether to use the new depends_on syntax which allows the serializer to serialize into a graph with dependencies instead of a list with wait steps.
     * More details here: https://buildkite.com/docs/pipelines/dependencies#defining-explicit-dependencies
     */
    explicitDependencies?: boolean;
};

export type ToJsonSerializationOptions =
    | {
          explicitDependencies: true;
          cache: StepCache;
      }
    | { explicitDependencies: false };
export interface Serializable {
    toJson(opts?: ToJsonSerializationOptions): Promise<object | undefined>;
}

export type PotentialStep = Step | Conditional<Step>;

export class Pipeline implements Serializable {
    public readonly name: string;

    public readonly steps: PotentialStep[] = [];

    public readonly env: KeyValue<this>;

    constructor(name: string) {
        this.name = name;
        this.env = new KeyValueImpl(this);
    }

    add(...step: PotentialStep[]): this {
        step.forEach(s => {
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
        opts: ToJsonSerializationOptions = { explicitDependencies: false },
    ): Promise<(WaitStep | Step)[]> {
        if (opts.explicitDependencies) {
            const sorted = await sortedSteps(this, opts.cache);
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
    ): Promise<object> {
        const newOpts: ToJsonSerializationOptions = opts.explicitDependencies
            ? {
                  explicitDependencies: true,
                  cache: new Map(),
              }
            : {
                  explicitDependencies: false,
              };

        return {
            env: await (this.env as KeyValueImpl<this>).toJson(),
            steps: await Promise.all(
                (await this.toList(newOpts)).map(s => s.toJson(newOpts)),
            ),
        };
    }
}
