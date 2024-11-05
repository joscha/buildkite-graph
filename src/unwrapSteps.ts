import { PotentialStep, Step } from './index';
import { Conditional } from './conditional';

export type StepCache<S extends Step = Step> = Map<Conditional<S>, S>;

export async function unwrapSteps<S extends Step = Step>(
  steps: PotentialStep<S>[],
  cache: StepCache<S>,
  acceptAllConditions: boolean,
): Promise<S[]> {
  const ret: S[] = [];
  for (const s of steps) {
    if (s instanceof Conditional) {
      if (cache.has(s)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ret.push(cache.get(s)!);
      } else if (
        (acceptAllConditions && s.isOverridable()) ||
        (await s.accept()) === true
      ) {
        const cond = await s.get();
        cache.set(s, cond);
        ret.push(cond);
      }
    } else {
      ret.push(s);
    }
  }
  return ret;
}
