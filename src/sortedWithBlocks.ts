import { Step } from './base';
import { sortedSteps } from './sortedSteps';
import { Pipeline } from './index';
import { Conditional } from './conditional';
import { StepCache } from './unwrapSteps';

export async function sortedWithBlocks(e: Pipeline): Promise<(Step | null)[]> {
  const cache: StepCache = new Map();
  const sorted = await sortedSteps(e, cache);
  // null denotes a block
  const allSteps: (Step | null)[] = [];
  let lastWaitStep = -1;
  for (const step of sorted) {
    dep: for (const potentialDependency of step.dependencies) {
      const dependency =
        potentialDependency instanceof Conditional
          ? cache.get(potentialDependency) || (await potentialDependency.get())
          : potentialDependency;
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
