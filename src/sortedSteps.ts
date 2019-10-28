import TopologicalSort from 'topological-sort';
import { Step } from './base';
import { Pipeline, PotentialStep } from './index';
import { unwrapSteps } from './unwrapSteps';
import { Conditional } from './conditional';

export async function sortedSteps(
    e: Pipeline,
    cache: Map<Conditional<Step>, Step>,
): Promise<Step[]> {
    const steps = await unwrapSteps(e.steps, cache);
    const sortOp = new TopologicalSort<Step, Step>(
        new Map(steps.map(step => [step, step])),
    );

    async function getAndCacheDependency(
        potentialDependency: PotentialStep,
    ): Promise<Step> {
        if (potentialDependency instanceof Conditional) {
            if (cache.has(potentialDependency)) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                return cache.get(potentialDependency)!;
            } else {
                // in the case we have to unwrap the conditional we store it for later use
                // otherwise the getter will be called many times, returning a new object each
                // time which means evenm though multiple steps might depend on the same conditionals
                // we would add a new step each time. Also, generating a step can be potentially expemnsive
                // so we want to do this only once
                const dependency = await potentialDependency.get();
                cache.set(potentialDependency, dependency);
                return dependency;
            }
        } else {
            return potentialDependency;
        }
    }
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
            if (dependency !== step) {
                // not a self-reference, we just add the edge as usual
                try {
                    sortOp.addEdge(dependency, step);
                } catch (e) {
                    // edge was already added, that is fine
                }
            } else {
                // self-reference, so we need to add a wait step in between later
                if (i !== 0) {
                    // we only do this if it is not the very first step
                    try {
                        sortOp.addEdge(steps[i - 1], step);
                    } catch (e) {
                        // edge was already added, that is fine
                    }
                }
            }
        };
        const iterateAndAddEffect = async (s: Step): Promise<void> => {
            for (const potentialEffectDependency of s.effectDependencies) {
                const dependency = await getAndCacheDependency(
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
                    if (
                        inGraph(dependency) &&
                        !removedEffects.has(dependency)
                    ) {
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
            for (const potentialDependency of step.dependencies) {
                // when we depend on a conditional the acceptor of the conditional doesn't matter
                // we need to always get it and add it to the graph
                const dependency = await getAndCacheDependency(
                    potentialDependency,
                );
                addDependency(dependency);
                for (const removedEffectStep of removedEffects) {
                    if (
                        removedEffectStep.effectDependencies.has(
                            potentialDependency,
                        )
                    ) {
                        removedEffects.delete(removedEffectStep);
                        await iterateAndAddEffect(removedEffectStep);
                    }
                }
            }
        }
    }
    return Array.from(sortOp.sort().values())
        .map(i => i.node)
        .filter(s => !removedEffects.has(s));
}
