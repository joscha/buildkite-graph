import slugify from '@sindresorhus/slugify';
import { Step } from './base';
import { Conditional } from './conditional';
import { KeyValue, KeyValueImpl } from './key_value';
import { WaitStep } from './steps/wait';
import { sortedWithBlocks } from './sortedWithBlocks';
export { ExitStatus, Step } from './base';
export { Conditional, ThingOrGenerator, Generator } from './conditional';
export { BlockStep } from './steps/block';
export { Option, SelectField, TextField } from './steps/block/fields';
export { Command, CommandStep } from './steps/command';
export { Plugin } from './steps/command/plugins';
export { TriggerStep } from './steps/trigger';
export { KeyValue } from './key_value';
import { DotSerializer } from './serializers/dot';
import { JsonSerializer } from './serializers/json';
import { YamlSerializer } from './serializers/yaml';
export { Serializer } from './serializers';

export const serializers = {
    DotSerializer,
    JsonSerializer,
    YamlSerializer,
};

export interface Serializable {
    toJson(): Promise<object | undefined>;
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

    private async _steps(): Promise<(WaitStep | Step)[]> {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const stepsWithBlocks = await sortedWithBlocks(this);

        // TODO: when step.always = true,
        // then previous step needs a wait step with continueOnFailure: true
        // if step after does not have .always = true a wait step needs to be
        // inserted.
        // See: https://buildkite.com/docs/pipelines/wait-step#continuing-on-failure
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

    async toJson() {
        return {
            env: await (this.env as KeyValueImpl<this>).toJson(),
            steps: await Promise.all(
                (await this._steps()).map(s => s.toJson()),
            ),
        };
    }
}
