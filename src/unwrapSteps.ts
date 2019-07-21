import { Pipeline, PotentialStep } from '.';
import { Step } from './base';
import { Conditional } from './conditional';

export function unwrapSteps(steps: PotentialStep[]): Step[] {
    const ret: Step[] = [];
    for (const s of steps) {
        if (s instanceof Pipeline) {
            ret.push(...unwrapSteps(s.steps));
        } else if (s instanceof Conditional) {
            if (s.accept()) {
                const cond = s.get();
                if (cond instanceof Pipeline) {
                    ret.push(...unwrapSteps(cond.steps));
                } else {
                    ret.push(cond);
                }
            }
        } else {
            ret.push(s);
        }
    }
    return ret;
}
