export abstract class Conditional<T> {
    constructor(private readonly guarded: T) {}

    get(): T {
        return this.guarded;
    }

    abstract accept(): boolean;
}
