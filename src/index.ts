import slugify from '@sindresorhus/slugify';
import { Exclude, Expose, Transform } from 'class-transformer';
import 'reflect-metadata';
import { Step } from './base';
import { Conditional } from './conditional';
import { KeyValue, KeyValueImpl, transformKeyValueImpl } from './key_value';
import { WaitStep } from './steps/wait';
import { stortedWithBlocks } from './stortedWithBlocks';
export { ExitStatus, Step } from './base';
export { Conditional, Generator } from './conditional';
export { BlockStep } from './steps/block';
export { Option, SelectField, TextField } from './steps/block/fields';
export { Command, CommandStep } from './steps/command';
export { Plugin } from './steps/command/plugins';
export { TriggerStep } from './steps/trigger';
export { KeyValue } from './key_value';

export type PotentialStep = Pipeline | Step | Conditional<Pipeline | Step>;

@Exclude()
export class Pipeline {
    public readonly name: string;

    public readonly steps: PotentialStep[] = [];

    @Expose()
    @Transform(transformKeyValueImpl)
    public readonly env: KeyValue<this>;

    constructor(name: string) {
        this.name = name;
        this.env = new KeyValueImpl(this);
    }

    add(...step: PotentialStep[]): this {
        this.steps.push(...step);
        return this;
    }

    slug(): string {
        return slugify(this.name, {
            lowercase: true,
            customReplacements: [['_', '-']],
        });
    }

    @Expose({ name: 'steps' })
    private get _steps(): (WaitStep | Step)[] {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        const stepsWithBlocks = stortedWithBlocks(this);

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
}
