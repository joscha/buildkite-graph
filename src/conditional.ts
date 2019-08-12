export abstract class Conditional<T> {
    constructor(guarded: T);
    constructor(guarded: () => T);
    constructor(private readonly guarded: T) {}

    get(): T {
        return typeof this.guarded === 'function'
            ? this.guarded()
            : this.guarded;
    }

    abstract accept(): boolean;
}
