import 'reflect-metadata';
import { Expose } from 'class-transformer';
import { BaseStep } from './base';

export class WaitStep implements BaseStep {
    public readonly wait: null = null;

    // TODO: Omit this when not true once
    // https://github.com/typestack/class-transformer/issues/273
    // has been fixed
    @Expose({ name: 'continue_on_failure' })
    public continueOnFailure?: true;

    constructor(continueOnFailure?: true) {
        this.continueOnFailure = continueOnFailure;
    }

    toString() {
        /* istanbul ignore next */
        return '[wait]';
    }
}
