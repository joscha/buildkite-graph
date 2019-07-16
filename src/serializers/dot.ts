import * as graphviz from 'graphviz';
import { Serializer } from '../serializer';
import { Entity, stortedWithBlocks } from '../';
import { TriggerStep } from '../steps/trigger';

export class DotSerializer implements Serializer<string> {
    serialize(e: Entity) {
        const allSteps = stortedWithBlocks(e);
        allSteps.unshift(null);

        const graph = graphviz.digraph(`"${e.name}"`);
        graph.set('compound', true);
        let lastNode;
        let i = 0;
        let currentCluster: graphviz.Graph;
        for (const step of allSteps) {
            if (step === null) {
                currentCluster = graph.addCluster(`cluster_${i++}`);
                currentCluster.set('color', 'black');
                continue;
            }
            for (const dependency of step.dependencies) {
                const edge = graph.addEdge(
                    dependency.toString(),
                    step.toString(),
                );
                edge.set('ltail', `cluster_${i - 2}`);
                edge.set('lhead', `cluster_${i - 1}`);
            }
            lastNode = currentCluster!.addNode(step.toString());
            lastNode.set('color', 'grey');

            if (step instanceof TriggerStep) {
                const triggered = graph.addNode(step.trigger);
                triggered.set('shape', 'Msquare');
                const edge = graph.addEdge(lastNode, triggered);
                edge.set('label', 'triggers');
            }
        }
        return graph.to_dot();
    }
}
