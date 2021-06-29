import * as graphviz from 'graphviz';
import { Serializer } from '.';
import { Pipeline, TriggerStep } from '../';
import { sortedWithBlocks } from '../sortedWithBlocks';

export class DotSerializer implements Serializer<string> {
  async serialize(e: Pipeline): Promise<string> {
    const allSteps = await sortedWithBlocks(e);
    if (allSteps.length > 0) {
      allSteps.unshift(null);
    }

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
        const edge = graph.addEdge(dependency.toString(), step.toString());
        edge.set('ltail', `cluster_${i - 2}`);
        edge.set('lhead', `cluster_${i - 1}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
