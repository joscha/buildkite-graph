import { Step } from './base';
import { sortedSteps } from './sortedSteps';
import { Pipeline } from './index';

export function stortedWithBlocks(e: Pipeline): (Step | null)[] {
    const sorted = sortedSteps(e);
    // null denotes a block
    const allSteps: (Step | null)[] = [];
    let lastWaitStep = -1;
    for (const step of sorted) {
        dep: for (const dependency of step.dependencies) {
            const dependentStep = allSteps.indexOf(dependency);
            if (dependentStep !== -1 && dependentStep > lastWaitStep) {
                lastWaitStep = allSteps.push(null) - 1;
                break dep;
            }
        }
        allSteps.push(step);
    }
    return allSteps;
}
