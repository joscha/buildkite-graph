import { Pipeline, PotentialStep } from '.';
import { Step } from './base';
import { Conditional } from './conditional';

function isConditional(x: PotentialStep): x is Conditional<any> {
    return (
        'get' in x &&
        typeof x.get === 'function' &&
        'accept' in x &&
        typeof x.accept === 'function'
    );
}

class UnknownPotentialStepError extends Error {}

export function unwrapSteps(steps: PotentialStep[]): Step[] {
    const ret: Step[] = [];
    for (const s of steps) {
        if (s instanceof Pipeline) {
            ret.push(...unwrapSteps(s.steps));
        } else if (s instanceof Step) {
            ret.push(s);
        } else if (isConditional(s)) {
            if (s.accept()) {
                const cond = s.get();
                if (cond instanceof Pipeline) {
                    ret.push(...unwrapSteps(cond.steps));
                } else {
                    ret.push(cond);
                }
            }
        } else {
            throw new UnknownPotentialStepError(`Unknown potential step: ${s}`);
        }
    }
    return ret;
}
