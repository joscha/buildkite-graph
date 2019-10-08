import { Step } from './base';
import { sortedSteps } from './sortedSteps';
import { Pipeline } from './index';
import { Conditional } from './conditional';

export function sortedWithBlocks(e: Pipeline): (Step | null)[] {
    const cache = new Map<Conditional<Step>, Step>();
    const sorted = sortedSteps(e, cache);
    console.log(sorted);
    // null denotes a block
    const allSteps: (Step | null)[] = [];
    let lastWaitStep = -1;
    for (const step of sorted) {
        dep: for (const potentialDependency of step.dependencies) {
            const dependency =
                potentialDependency instanceof Conditional
                    ? cache.get(potentialDependency)!
                    : potentialDependency;
            const dependentStep = allSteps.indexOf(dependency);
            if (
                dependency === step ||
                (dependentStep !== -1 && dependentStep > lastWaitStep)
            ) {
                lastWaitStep = allSteps.push(null) - 1;
                break dep;
            }
        }
        allSteps.push(step);
    }
    return allSteps;
}
