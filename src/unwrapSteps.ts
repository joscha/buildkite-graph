import { Pipeline, PotentialStep } from '.';
import { Step, MaybeStep } from './base';
import { Conditional } from './conditional';

export function unwrapSteps(
    steps: PotentialStep[],
    cache: Map<Conditional<Step | Pipeline>, Step>,
): Step[] {
    const ret: Step[] = [];
    for (const s of steps) {
        if (s instanceof Pipeline) {
            ret.push(...unwrapSteps(s.steps, cache));
        } else if (s instanceof Conditional) {
            if (cache.has(s)) {
                continue;
            }
            if (s.accept()) {
                const cond = s.get();
                if (cond instanceof Pipeline) {
                    ret.push(...unwrapSteps(cond.steps, cache));
                } else {
                    cache.set(s, cond);
                    ret.push(cond);
                }
            }
        } else {
            ret.push(s);
        }
    }
    return ret;
}
