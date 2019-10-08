import { PotentialStep, Step } from './index';
import { Conditional } from './conditional';

export function unwrapSteps(
    steps: PotentialStep[],
    cache: Map<Conditional<Step>, Step>,
): Step[] {
    const ret: Step[] = [];
    for (const s of steps) {
        if (s instanceof Conditional) {
            if (cache.has(s)) {
                continue;
            }
            if (s.accept()) {
                const cond = s.get();
                cache.set(s, cond);
                ret.push(cond);
            }
        } else {
            ret.push(s);
        }
    }
    return ret;
}
