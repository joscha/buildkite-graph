import { Step } from '.';

export type Generator<T> = () => T;
export type ThingOrGenerator<T> = T | Generator<T>;

export abstract class Conditional<T extends Step> {
    constructor(private readonly guarded: ThingOrGenerator<T>) {}

    get(): T {
        return typeof this.guarded === 'function'
            ? this.guarded()
            : this.guarded;
    }

    abstract accept(): boolean;
}
