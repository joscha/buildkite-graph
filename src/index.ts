import TopologicalSort from "topological-sort";

import * as jsyaml from "js-yaml";

import * as graphviz from "graphviz";

import ow from "ow";

import "reflect-metadata";

import { Expose, Exclude, classToPlain, Transform } from "class-transformer";

type SerializedStep<T> = T extends object ? {} : null;

type Primitive = number | string | boolean;

interface BaseStep<SerializedStep> {
  serialize(): SerializedStep;
}

// see https://github.com/microsoft/TypeScript/issues/22815#issuecomment-375766197
interface DefaultStep<SerializedStep> extends BaseStep<SerializedStep> {}
abstract class DefaultStep<SerializedStep> implements BaseStep<SerializedStep> {
  @Exclude()
  public readonly dependencies: Set<DefaultStep<any>> = new Set();

  dependsOn(step: DefaultStep<any>): this {
    this.dependencies.add(step);
    return this;
  }
}

type Wait = {
  wait: null;
  continue_on_failure?: true;
};

class WaitStep implements BaseStep<SerializedStep<Wait>> {
  @Expose({ name: "continue_on_failure" })
  public continueOnFailure?: true;
  public readonly wait: null = null;

  constructor(continueOnFailure?: true) {
    this.continueOnFailure = continueOnFailure;
  }

  serialize(): Wait {
    return this;
  }

  toString() {
    return "[wait]";
  }
}

type Default = {
  label?: string;
  command: string | string[];
  parallelism?: number;
};

export class Step extends DefaultStep<Default> {
  public parallelism?: number;

  public readonly command: string | string[];

  constructor(public readonly label?: string, ...command: string[]) {
    super();
    this.command = command.length === 1 ? command[0] : command;
  }

  withParallelism(parallelism: number): this {
    ow(parallelism, ow.number.positive);
    this.parallelism = parallelism;
    return this;
  }

  serialize(): Default {
    return this;
  }

  toString() {
    return this.label;
  }
}

type Trigger = {
  trigger: string;
  build?: Build;
};

class Build {
  public readonly env: Env<TriggerStep>;
  constructor(triggerStep: TriggerStep) {
    this.env = new EnvImpl(triggerStep);
  }
}

@Exclude()
export class TriggerStep extends DefaultStep<Trigger> {
  public readonly build = new Build(this);

  @Expose()
  get trigger() {
    return this.triggeredEntity.name;
  }

  @Expose({ name: "build" })
  private get _build() {
    return { env: (this.build.env as EnvImpl<any>).vars };
  }

  constructor(
    public readonly triggeredEntity: Entity,
    public readonly label?: string
  ) {
    super();
  }

  /*
  serialize(): Trigger {
    //const env = transformEnv(this.env as EnvImpl<this>);
    const ret: Trigger = {
      trigger: this.triggeredEntity.name
    };
    if (this.env) {
      ret.build = {
        env: this.env
      };
    }
    return ret;
  }
  */

  toString() {
    return this.label || `Trigger ${this.triggeredEntity.name}`;
  }
}

interface Env<T> {
  set(name: string, value: Primitive): T;
}

@Exclude()
class EnvImpl<T> implements Env<T> {
  @Exclude()
  private readonly parent: T;

  @Expose({ name: "env" })
  public readonly vars: Map<string, Primitive> = new Map();

  constructor(parent: T) {
    this.parent = parent;
  }

  set(name: string, value: Primitive): T {
    this.vars.set(name, value);
    return this.parent;
  }
}

function transformEnv(env: EnvImpl<any>) {
  return env.vars.size ? env.vars : undefined;
}

@Exclude()
export class Entity {
  public readonly name: string;

  public readonly steps: DefaultStep<any>[] = [];

  @Expose()
  @Transform(value => transformEnv(value))
  public readonly env: Env<this>;

  constructor(name: string) {
    this.name = name;
    this.env = new EnvImpl(this);
  }

  /*
  @Expose({ name: "env" })
  private get _env() {
    return this.env.serialized();
  }
  */

  add(step: DefaultStep<any>) {
    this.steps.push(step);
    return this;
  }

  @Expose({ name: "steps" })
  private get _steps() {
    const allSteps = stortedWithBlocks(this);

    return [...allSteps.map(s => s || new WaitStep())].filter(Boolean);
  }
}

function sortedSteps(e: Entity) {
  const sortOp = new TopologicalSort<DefaultStep<any>, DefaultStep<any>>(
    new Map(e.steps.map(step => [step, step]))
  );

  for (const step of e.steps) {
    for (const dependency of step.dependencies) {
      if (e.steps.indexOf(dependency) === -1) {
        //throw new Error(`Step not part of the graph: '${dependency}'`);
        sortOp.addNode(dependency, dependency);
        e.steps.push(dependency);
      }
      sortOp.addEdge(dependency, step);
    }
  }
  return Array.from(sortOp.sort().values()).map(i => i.node);
}

function stortedWithBlocks(e: Entity) {
  const sorted = sortedSteps(e);
  const allSteps: (DefaultStep<any> | null)[] = [];
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

interface Serializer<T> {
  serialize(e: Entity): T;
}

export class JsonSerializer implements Serializer<object> {
  serialize(e: Entity) {
    // TODO: filter undefined values
    return classToPlain(e);
  }
}

export class YamlSerializer implements Serializer<string> {
  serialize(e: Entity) {
    return jsyaml.safeDump(new JsonSerializer().serialize(e), {
      skipInvalid: true,
      styles: {
        "!!null": "canonical" // dump null as ~
      }
    });
  }
}

export class DotSerializer implements Serializer<string> {
  serialize(e: Entity) {
    const allSteps = stortedWithBlocks(e);
    allSteps.unshift(null);

    const graph = graphviz.digraph(`"${e.name}"`);
    graph.set("compound", true);
    let lastNode;
    let i = 0;
    let currentCluster: graphviz.Graph;
    for (const step of allSteps) {
      if (step === null) {
        currentCluster = graph.addCluster(`cluster_${i++}`);
        currentCluster.set("color", "black");
        continue;
      }
      for (const dependency of step.dependencies) {
        const edge = graph.addEdge(dependency.toString(), step.toString());
        edge.set("ltail", `cluster_${i - 2}`);
        edge.set("lhead", `cluster_${i - 1}`);
      }
      lastNode = currentCluster!.addNode(step.toString());
      lastNode.set("color", "grey");

      if (step instanceof TriggerStep) {
        const triggered = graph.addNode(step.triggeredEntity.name);
        triggered.set("shape", "Msquare");
        const edge = graph.addEdge(lastNode, triggered);
        edge.set("label", "triggers");
      }
    }
    return graph.to_dot();
  }
}
