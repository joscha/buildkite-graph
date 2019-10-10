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

    /**
     * The step is accepted if the returned boolean is true or the promise resolves.
     * The step is rejected if the returned boolean is false or the promise rejects.
     */
    abstract accept(): boolean | Promise<void | Error>;
}
