import { DefaultStep } from './steps/base';

export abstract class Conditional<T extends DefaultStep> {
    constructor(private readonly guarded: T) {}

    get() {
        return this.guarded;
    }

    abstract accept(): boolean;
}
