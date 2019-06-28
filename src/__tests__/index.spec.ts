import {
  Entity,
  Step,
  TriggerStep,
  JsonSerializer,
  YamlSerializer,
  DotSerializer
} from "../";

describe("buildkite-graph", () => {
  function createSimple() {
    return new Entity("web-deploy").env
      .set("USE_COLOR", 1)
      .env.set("DEBUG", true)
      .add(new Step("Deploy", "buildkite/deploy_web.sh"));
  }

  function createComplex() {
    const webDeploy = createSimple();
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
    const integrationTestStep = new Step(
      "Integration tests",
      "web/bin/buildkite/run_web_step.sh run-integration-tests local editor chrome"
    )
      .withParallelism(8)
      .dependsOn(buildEditorStep);

    const saucelabsIntegrationTestStep = new Step(
      ":saucelabs: Integration tests",
      "web/bin/buildkite/run_web_step.sh run-integration-tests saucelabs editor safari"
    )
      .withParallelism(8)
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

    const deployEditorToTechStep = new TriggerStep(
      webDeploy,
      "Deploy to tech"
    ).build.env
      .set("FLAVOR", "tech")
      .build.env.set("RELEASE_PATH", "some/path/")
      .dependsOn(copyToDeployBucketStep);

    const deployEditorToUserTestingStep = new TriggerStep(
      webDeploy,
      "Deploy to usertesting"
    ).build.env
      .set("FLAVOR", "usertesting")
      .build.env.set("RELEASE_PATH", "some/path/")
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
    return webBuildEditor;
  }

  describe("can produce JSON", () => {
    const serializer = new JsonSerializer();
    it("for simple pipelines", () => {
      const webDeploy = createSimple();

      expect(serializer.serialize(webDeploy)).toMatchSnapshot();
    });

    it("for complex pipelines", () => {
      const webBuildEditor = createComplex();
      expect(serializer.serialize(webBuildEditor)).toMatchSnapshot();
    });
  });

  describe("can produce YAML", () => {
    const serializer = new YamlSerializer();
    it("for simple pipelines", () => {
      const webDeploy = createSimple();
      expect(serializer.serialize(webDeploy)).toMatchSnapshot();
    });

    it("for complex pipelines", () => {
      const webBuildEditor = createComplex();
      expect(serializer.serialize(webBuildEditor)).toMatchSnapshot();
    });
  });

  describe("can produce dot", () => {
    const serializer = new DotSerializer();
    it("for complex pipelines", () => {
      const webBuildEditor = createComplex();
      expect(serializer.serialize(webBuildEditor)).toMatchSnapshot();
    });
  });
});
