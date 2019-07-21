import TopologicalSort from 'topological-sort';
import { Step } from './base';
import { Pipeline } from './index';
import { unwrapSteps } from './unwrapSteps';

export function sortedSteps(e: Pipeline): Step[] {
    const steps = unwrapSteps(e.steps);
    const sortOp = new TopologicalSort<Step, Step>(
        new Map(steps.map(step => [step, step])),
    );
    for (let step of steps) {
        for (const dependency of step.dependencies) {
            if (steps.indexOf(dependency) === -1) {
                // a dependency has not been added to the graph explicitly,
                // so we add it implicitly
                sortOp.addNode(dependency, dependency);
                steps.push(dependency);
                // maybe we want to rather throw here?
                // Unsure...there could be a strict mode where we:
                // throw new Error(`Step not part of the graph: '${dependency}'`);
            }
            sortOp.addEdge(dependency, step);
        }
    }
    return Array.from(sortOp.sort().values()).map(i => i.node);
}
