import { Step } from '.';

export type Generator<T> = () => T | Promise<T>;
export type ThingOrGenerator<T> = T | Promise<T> | Generator<T>;

export abstract class Conditional<T extends Step> {
  constructor(
    private readonly guarded: ThingOrGenerator<T>,
    private readonly overridable = true,
  ) {}

  get(): T | Promise<T> {
    return typeof this.guarded === 'function' ? this.guarded() : this.guarded;
  }

  /**
   * The step is accepted if the returned boolean is true or the promise resolves to true.
   * The step is rejected if the returned boolean is false or the promise resolves to false.
   */
  abstract accept(): boolean | Promise<boolean>;

  /**
   * Whether this condition could be overriden to accept when `acceptAllConditions` is set. `overridable` is
   * set to true by default.
   * @returns boolean
   */
  isOverridable(): boolean {
    return this.overridable;
  }
}
