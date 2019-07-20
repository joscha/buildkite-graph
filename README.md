# buildkite-graph

A graph-based generator for Buildkite pipelines

This module allows you to generate Buildkite pipelines by defining their dependencies via a graph. This graph gets then serialized into the Buildkite-specific YAML format.
All standard Buildkite features are supported.

The main advantage of using this module is:

-   Easy reuse and recombination of steps
-   Defining dependencies between steps explicitly
-   Wait steps are not defined explicitly and manually managed but derived from the graph, always providing the most optimized graph
-   Steps can be defined conditionally via an acceptor function, allowing for completely dynamic pipelines
-   The graph can be serialzed into [dot](https://www.graphviz.org/) format, allowing you to see the whole of the pipeline in one glance. Clusters denote which parts of the graph are dependendent.
-   Timeouts can be defined on a per-command basis, the step will then accumulate the timeouts accordingly

## Example
