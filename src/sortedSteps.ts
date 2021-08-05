import TopologicalSort from 'topological-sort';
import { Step } from './base';
import { Pipeline } from './index';
import { unwrapSteps, StepCache } from './unwrapSteps';
import { Conditional, getAndCacheDependency } from './conditional';

export async function sortedSteps(
  e: Pipeline,
  cache: StepCache,
): Promise<Step[]> {
  const steps = await unwrapSteps(e.steps, cache);
  const sortOp = new TopologicalSort<Step, Step>(
    new Map(steps.map((step) => [step, step])),
  );

  const inGraph = (s: Step): boolean => steps.indexOf(s) !== -1;
  const addToGraph = (s: Step): void => {
    if (!inGraph(s)) {
      // a dependency has not been added to the graph explicitly,
      // so we add it implicitly
      sortOp.addNode(s, s);
      steps.push(s);
      // maybe we want to rather throw here?
      // Unsure...there could be a strict mode where we:
      // throw new Error(`Step not part of the graph: '${dependency}'`);
    }
  };

  const removedEffects = new Set<Step>();
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const addDependency = (dependency: Step): void => {
      addToGraph(dependency);
      try {
        sortOp.addEdge(dependency, step);
      } catch (e) {
        // edge was already added, that is fine
      }
    };
    const iterateAndAddEffect = async (s: Step): Promise<void> => {
      for (const potentialEffectDependency of s.effectDependencies) {
        const dependency = await getAndCacheDependency(
          cache,
          potentialEffectDependency,
        );
        if (potentialEffectDependency instanceof Conditional) {
          // in case it is a conditional we are interested in whether it that one was accepted or not
          if (
            (await potentialEffectDependency.accept()) ||
            inGraph(dependency)
          ) {
            // if it was accepted and it is part of the graph, add the dependency to the current step
            addDependency(dependency);
            s.dependsOn(potentialEffectDependency);
          } else {
            // remove the current step from the graph
            removedEffects.add(s);
          }
        } else {
          // the dependency is a step and it wasn't removed before;
          // add ourselves to the graph if the step is part of the graph
          if (inGraph(dependency) && !removedEffects.has(dependency)) {
            addDependency(dependency);
            s.dependsOn(potentialEffectDependency);
          } else {
            removedEffects.add(s);
          }
        }
      }
    };

    await iterateAndAddEffect(step);

    if (!removedEffects.has(step)) {
      for (const potentialDependency of [...step.dependencies]) {
        // when we depend on a conditional the acceptor of the conditional doesn't matter
        // we need to always get it and add it to the graph
        const dependency = await getAndCacheDependency(
          cache,
          potentialDependency,
        );
        addDependency(dependency);
        for (const removedEffectStep of [...removedEffects]) {
          removedEffects.delete(removedEffectStep);
          await iterateAndAddEffect(removedEffectStep);
        }
      }
    }
  }
  return Array.from(sortOp.sort().values())
    .map((i) => i.node)
    .filter((s) => !removedEffects.has(s));
}
