import { Expose, Transform } from 'class-transformer';
import 'reflect-metadata';
import { BaseStep } from '../base';

export class WaitStep implements BaseStep {
    public readonly wait: null = null;

    @Expose({ name: 'continue_on_failure' })
    @Transform((value: boolean) => value || undefined)
    public continueOnFailure: boolean;

    constructor(continueOnFailure: boolean = false) {
        this.continueOnFailure = continueOnFailure;
    }

    toString(): string {
        /* istanbul ignore next */
        return '[wait]';
    }
}
