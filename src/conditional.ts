import { Step, Pipeline, GeneratorFn } from '.';

export abstract class Conditional<T extends Step | Pipeline> {
    constructor(guarded: T);
    constructor(guarded: GeneratorFn<T>);
    constructor(private readonly guarded: T | GeneratorFn<T>) {}

    get(): T {
        return typeof this.guarded === 'function'
            ? this.guarded()
            : this.guarded;
    }

    abstract accept(): boolean;
}
