import { PotentialStep, Step } from './index';
import { Conditional } from './conditional';

export type StepCache = Map<Conditional<Step>, Step>;

export async function unwrapSteps(
  steps: PotentialStep[],
  cache: StepCache,
): Promise<Step[]> {
  const ret: Step[] = [];
  for (const s of steps) {
    if (s instanceof Conditional) {
      if (cache.has(s)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ret.push(cache.get(s)!);
      } else if ((await s.accept()) === true) {
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
