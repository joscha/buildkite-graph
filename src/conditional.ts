import { Step, PotentialStep } from '.';

export type Generator<T> = () => T | Promise<T>;
export type ThingOrGenerator<T> = T | Promise<T> | Generator<T>;

export abstract class Conditional<T extends Step> {
  constructor(private readonly guarded: ThingOrGenerator<T>) {}

  get(): T | Promise<T> {
    return typeof this.guarded === 'function' ? this.guarded() : this.guarded;
  }

  /**
   * The step is accepted if the returned boolean is true or the promise resolves to true.
   * The step is rejected if the returned boolean is false or the promise resolves to false.
   */
  abstract accept(): boolean | Promise<boolean>;
}

export async function getAndCacheDependency(
  cache: Map<any, any>,
  potentialDependency: PotentialStep,
): Promise<Step> {
  if (potentialDependency instanceof Conditional) {
    if (cache.has(potentialDependency)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return cache.get(potentialDependency)!;
    } else {
      // in the case we have to unwrap the conditional we store it for later use
      // otherwise the getter will be called many times, returning a new object each
      // time which means evenm though multiple steps might depend on the same conditionals
      // we would add a new step each time. Also, generating a step can be potentially expemnsive
      // so we want to do this only once
      const dependency = await potentialDependency.get();
      cache.set(potentialDependency, dependency);
      return dependency;
    }
  } else {
    return potentialDependency;
  }
}
