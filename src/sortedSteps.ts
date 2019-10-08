import TopologicalSort from 'topological-sort';
import { Step } from './base';
import { Pipeline } from './index';
import { unwrapSteps } from './unwrapSteps';
import { Conditional } from './conditional';
import { CommandStep } from './steps/command';

export function sortedSteps(
    e: Pipeline,
    cache: Map<Conditional<Step>, Step>,
): Step[] {
    const steps = unwrapSteps(e.steps, cache);
    const sortOp = new TopologicalSort<Step, Step>(
        new Map(steps.map(step => [step, step])),
    );

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        for (const potentialDependency of step.dependencies) {
            // when we depend on a conditional the acceptor of the conditional doesn't matter
            // we need to always get it and add it to the graph
            let dependency: Step;
            if (potentialDependency instanceof Conditional) {
                if (cache.has(potentialDependency)) {
                    dependency = cache.get(potentialDependency)!;
                } else {
                    // in the case we have to unwrap the conditional we store it for later use
                    // otherwise the getter will be called many times, returning a new object each
                    // time which means evenm though multiple steps might depend on the same conditionals
                    // we would add a new step each time. Also, generating a step can be potentially expemnsive
                    // so we want to do this only once
                    dependency = potentialDependency.get();
                    cache.set(potentialDependency, dependency);
                }
            } else {
                dependency = potentialDependency;
            }
            if (steps.indexOf(dependency) === -1) {
                // a dependency has not been added to the graph explicitly,
                // so we add it implicitly
                sortOp.addNode(dependency, dependency);
                steps.push(dependency);
                // maybe we want to rather throw here?
                // Unsure...there could be a strict mode where we:
                // throw new Error(`Step not part of the graph: '${dependency}'`);
            }
            if (dependency !== step) {
                // not a self-reference, we just add the edge as usual
                sortOp.addEdge(dependency, step);
            } else {
                // self-reference, so we need to add a wait step in between later
                if (i !== 0) {
                    // we only do this if it is not the very first step
                    sortOp.addEdge(steps[i - 1], step);
                }
            }
        }
    }
    return Array.from(sortOp.sort().values()).map(i => i.node);
}
