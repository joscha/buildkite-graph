# buildkite-graph

A graph-based generator for Buildkite pipelines

This module allows you to generate Buildkite pipelines by defining their dependencies via a graph. This graph gets then serialized into the Buildkite-specific YAML format.
All standard Buildkite features are supported.

The main advantage of using this module is:

- Easy reuse and recombination of steps
- Defining dependencies between steps explicitly
- Wait steps are not defined explicitly and manually managed but derived from the graph, always providing the most optimized graph
- Steps can be defined conditionally via an acceptor function, allowing for completely dynamic pipelines
- The graph can be serialzed into [dot](https://www.graphviz.org/) format, allowing you to see the whole of the pipeline in one glance. Clusters denote which parts of the graph are dependendent.
- Timeouts can be defined on a per-command basis, the step will then accumulate the timeouts accordingly

## Example in a nutshell

```ts
const install = new Command('yarn', 2);

const lint = new CommandStep([install, new Command('yarn lint', 1)]).withKey(
  'lint',
);
const test = new CommandStep([install, new Command('yarn test', 2)])
  .withKey('test')
  .dependsOn(lint);
const build = new CommandStep([install, new Command('yarn build', 5)])
  .withKey('build')
  .dependsOn(lint);
const integration = new CommandStep([
  install,
  new Command('yarn integration', 10),
])
  .withKey('integration-test')
  .dependsOn(build);

const pipeline = new Pipeline('My pipeline').add(test).add(integration);
```

> Do you see how we don't have to add the `lint` or `build`step? Because other steps depend on them, they will become part of the graph automatically in the right place. This allows you to define graphs with complex dependencies and only add the steps which have an important signal - no more manually adding auxiliary steps.

will serialize to:

```yaml
steps:
  - command:
      - yarn
      - yarn lint
    timeout_in_minutes: 3
  - wait: ~
  - command:
      - yarn
      - yarn build
    timeout_in_minutes: 7
  - command:
      - yarn
      - yarn test
    timeout_in_minutes: 4
  - wait: ~
  - command:
      - yarn
      - yarn integration
    timeout_in_minutes: 12
```

> Did you see how the `wait` step got added for you? How cool is that, hey :)

> And did you also see how the timeouts for the steps are derived from the commands?

Since version 5 we also support the [new `depends_on` syntax](https://buildkite.com/changelog/84-introducing-pipeline-step-dependencies):

```yaml
steps:
  - key: lint
    command:
      - yarn
      - yarn lint
    timeout_in_minutes: 3
  - key: build
    depends_on:
      - step: lint
    command:
      - yarn
      - yarn build
    timeout_in_minutes: 7
  - key: test
    depends_on:
      - step: lint
    command:
      - yarn
      - yarn test
    timeout_in_minutes: 4
  - key: integration-test
    depends_on:
      - step: build
    command:
      - yarn
      - yarn integration
    timeout_in_minutes: 12
```

you can get this format by using a flag on the yaml serializer:

```ts
console.log(
  await new YamlSerializer({ explicitDependencies: true }).serialize(pipeline),
);
```

The same with graphviz:

```dot
digraph "My pipeline" {
  graph [ compound =true ];
subgraph cluster_0 {
  graph [ color = "black" ];
  "<yarn && yarn lint>" [ color = "grey" ];
}

subgraph cluster_1 {
  graph [ color = "black" ];
  "<yarn && yarn build>" [ color = "grey" ];
  "<yarn && yarn test>" [ color = "grey" ];
}

subgraph cluster_2 {
  graph [ color = "black" ];
  "<yarn && yarn integration>" [ color = "grey" ];
}

  "<yarn && yarn lint>";
  "<yarn && yarn build>";
  "<yarn && yarn test>";
  "<yarn && yarn integration>";
  "<yarn && yarn lint>" -> "<yarn && yarn build>" [ ltail = "cluster_0", lhead = "cluster_1" ];
  "<yarn && yarn lint>" -> "<yarn && yarn test>" [ ltail = "cluster_0", lhead = "cluster_1" ];
  "<yarn && yarn build>" -> "<yarn && yarn integration>" [ ltail = "cluster_1", lhead = "cluster_2" ];
}
```

which will visualize to:

<img src="https://user-images.githubusercontent.com/188038/61578524-b6cfc280-ab3b-11e9-87ab-28fa6be480ff.png" width="500">

> See the clusters (the square boxes)? The are legs of multiple steps in your pipeline, each separated by a wait step.

...but wait there's more; you can use the structural serializer to produce a textual output of the pipeline:

```
* Build Editor
* Test Editor
* [wait; continues on failure]
* Annotate failures
* Upload coverage
* [wait]
* Integration tests [x 8]
* [wait]
* :saucelabs: Integration tests [x 8]
* Visreg baseline update
* [wait; continues on failure]
* Annotate cucumber failures
* [wait]
* Copy to deploy bucket
* [wait]
* Update checkpoint
* Deploy to tech
* Deploy to usertesting
* [wait]
* [block for 'Release editor']
```

just by calling:

```ts
console.log(await new StructuralSerializer().serialize(pipeline));
```

This will allow you to create snapshot tests for your dynamic pipelines which represent the step composition and order.

## Side-effects (Weak dependencies)

Sometimes a dependency is not a strong one, e.g. if you have a unit test you probably want to deploy the coverage, but adding the deploy coverage step should not trigger the unit tests unless they need to. In that case you can use `.isEffectOf()` instead of `.dependsOn()`:

```ts
deploCoverageStep.isEffectOf(conditionalUnitTestStep);
```
