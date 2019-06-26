import TopologicalSort from "topological-sort";

import * as jsyaml from "js-yaml";

type SerializedStep<T> = T extends object ? {} : null;

type Primitive = number | string | boolean;

interface BaseStep<SerializedStep> {
  serialize(): SerializedStep;
}

// see https://github.com/microsoft/TypeScript/issues/22815#issuecomment-375766197
interface DefaultStep<SerializedStep> extends BaseStep<SerializedStep> {}
abstract class DefaultStep<SerializedStep> implements BaseStep<SerializedStep> {
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
  constructor(private readonly continueOnFailure?: boolean) {}

  serialize(): Wait {
    const ret: Wait = {
      wait: null
    };
    if (this.continueOnFailure) {
      ret.continue_on_failure = true;
    }
    return ret;
  }

  toString() {
    return "[wait]";
  }
}

type Default = {
  label: string;
  command: string | string[];
};

class Step extends DefaultStep<Default> {
  constructor(
    private readonly label: string,
    private readonly command: string
  ) {
    super();
  }

  serialize(): Default {
    return {
      label: this.label,
      command: this.command
    };
  }

  toString() {
    return `<${this.label}>`;
  }
}

class ParallelStep extends Step {
  constructor(
    label: string,
    command: string,
    private readonly concurrency: number
  ) {
    super(label, command);
  }

  serialize() {
    const ret = super.serialize();
    return {
      ...ret,
      concurrency: this.concurrency
    };
  }
}

type Build = {
  env?: object;
};

type Trigger = {
  trigger: string;
  build?: Build;
};

class TriggerStep extends DefaultStep<Trigger> {
  private readonly env: Env = new Env();

  constructor(private readonly entity: Entity) {
    super();
  }

  withEnv(name: string, value: Primitive) {
    this.env.add(name, value);
    return this;
  }

  serialize(): Trigger {
    const env = this.env.serialize();
    const ret: Trigger = {
      trigger: this.entity.name
    };
    if (env) {
      ret.build = {
        ...env
      };
    }
    return ret;
  }

  toString() {
    return `[trigger: ${this.entity.name}]`;
  }
}

class Env {
  private readonly vars: Map<string, Primitive> = new Map();

  add(name: string, value: Primitive) {
    this.vars.set(name, value);
  }

  serialize() {
    return this.vars.size
      ? {
          env: Array.from(this.vars).reduce<Record<string, Primitive>>(
            (ret, [k, v]) => {
              ret[k] = v;
              return ret;
            },
            {}
          )
        }
      : null;
  }
}

class Entity {
  private readonly steps: DefaultStep<any>[] = [];
  private readonly env: Env = new Env();

  constructor(public readonly name: string) {}

  add(step: DefaultStep<any>) {
    this.steps.push(step);
    return this;
  }

  withEnv(name: string, value: Primitive) {
    this.env.add(name, value);
    return this;
  }

  private sortedSteps() {
    const sortOp = new TopologicalSort<DefaultStep<any>, DefaultStep<any>>(
      new Map(this.steps.map(step => [step, step]))
    );

    for (const step of this.steps) {
      for (const dependency of step.dependencies) {
        if (this.steps.indexOf(dependency) === -1) {
          //throw new Error(`Step not part of the graph: '${dependency}'`);
          sortOp.addNode(dependency, dependency);
          this.steps.push(dependency);
        }
        sortOp.addEdge(dependency, step);
      }
    }
    return Array.from(sortOp.sort().values()).map(i => i.node);
  }

  serialize() {
    const sortedSteps = this.sortedSteps();
    const allSteps: BaseStep<any>[] = [];
    let lastWaitStep = -1;
    for (const step of sortedSteps) {
      dep: for (const dependency of step.dependencies) {
        const dependentStep = allSteps.indexOf(dependency);
        if (dependentStep !== -1 && dependentStep > lastWaitStep) {
          lastWaitStep = allSteps.push(new WaitStep()) - 1;
          break dep;
        }
      }
      allSteps.push(step);
    }

    return {
      steps: [this.env.serialize(), ...allSteps.map(s => s.serialize())].filter(
        Boolean
      )
    };
  }

  toYAML() {
    return jsyaml.safeDump(this.serialize(), {
      styles: {
        "!!null": "canonical" // dump null as ~
      }
    });
  }
}

// --- web-deploy
const webDeploy = new Entity("web-deploy")
  .withEnv("USE_COLOR", 1)
  .withEnv("DEBUG", true)
  .add(new Step("Deploy", "buildkite/deploy_web.sh"));

// --- web-build-editor
const buildEditorStep = new Step(
  "Build Editor",
  "web/bin/buildkite/run_web_step.sh build editor"
);
const testEditorStep = new Step(
  "Test Editor",
  "web/bin/buildkite/run_web_step.sh test editor"
);
/*

const annotateFailuresStep = new AlwaysExecutedStep('annotate failures')
    .dependsOn(testEditorStep);
const deployCoverageReportStep = new AlwaysExecutedStep('web/bin/buildkite/run_web_step.sh deploy-report coverage editor')
    .dependsOn(testEditorStep);
*/
const integrationTestStep = new ParallelStep(
  "Integration tests",
  "web/bin/buildkite/run_web_step.sh run-integration-tests local editor chrome",
  8
).dependsOn(buildEditorStep);

const saucelabsIntegrationTestStep = new ParallelStep(
  ":saucelabs: Integration tests",
  "web/bin/buildkite/run_web_step.sh run-integration-tests saucelabs editor safari",
  8
)
  // .add(new Plugin('sauce-connect-plugin'))
  //.deferred()
  .dependsOn(integrationTestStep);

const visregBaselineUpdateStep = new Step(
  "Visreg baseline update",
  "web/bin/buildkite/run_web_step.sh run-visual-regression editor"
).dependsOn(integrationTestStep);

/*    
const annotateCucumberFailuresStep = new AlwaysExecutedStep('web/bin/buildkite/run_web_step.sh annotate-cucumber-failed-cases')
    .dependsOn(integrationTestStep)
    .dependsOn(saucelabsIntegrationTestStep);
*/
const copyToDeployBucketStep = new Step(
  "Copy to deploy bucket",
  "web/bin/buildkite/run_web_step.sh copy-to-deploy-bucket editor"
).dependsOn(saucelabsIntegrationTestStep);
/*
const updateCheckpointStep = new Step('production/test/jobs/advance_branch.sh "checkpoint/web/green/editor"')
    .dependsOn(copyToDeployBucketStep)

*/

const deployEditorToTechStep = new TriggerStep(webDeploy)
  .withEnv("FLAVOR", "tech")
  .withEnv("RELEASE_PATH", "some/path/")
  .dependsOn(copyToDeployBucketStep);

const deployEditorToUserTestingStep = new TriggerStep(webDeploy)
  .withEnv("FLAVOR", "usertesting")
  .withEnv("RELEASE_PATH", "some/path/")
  .dependsOn(copyToDeployBucketStep);

/*
const releaseStep = new ManualStep('Release editor', options)
    .dependsOn(updateCheckpointStep)
*/

const webBuildEditor = new Entity("web-build-editor")
  .add(buildEditorStep)
  .add(testEditorStep)
  // .add(annotateFailuresStep)
  // .add(deployCoverageReportStep)
  .add(integrationTestStep)
  .add(saucelabsIntegrationTestStep)
  .add(visregBaselineUpdateStep)
  // .add(annotateCucumberFailuresStep)
  .add(copyToDeployBucketStep)
  // .add(updateCheckpointStep)
  .add(deployEditorToTechStep)
  .add(deployEditorToUserTestingStep);
// .add(releaseStep)

//console.log(JSON.stringify(webDeploy.serialize(),null,2));
//console.log('---');
//console.log(JSON.stringify(webBuildEditor.serialize(),null,2));

console.log(webDeploy.toYAML());
console.log("---");
console.log(webBuildEditor.toYAML());

// create graph visualization via: https://github.com/jakesgordon/javascript-state-machine
// https://github.com/DomParfitt/graphviz-react#readme
// https://github.com/glejeune/node-graphviz
