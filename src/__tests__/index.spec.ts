import { Entity, Step, ParallelStep, TriggerStep } from "../";

describe("buildkite-graph", () => {
  function createSimple() {
    return new Entity("web-deploy")
      .withEnv("USE_COLOR", 1)
      .withEnv("DEBUG", true)
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

    const deployEditorToTechStep = new TriggerStep(webDeploy, "Deploy to tech")
      .withEnv("FLAVOR", "tech")
      .withEnv("RELEASE_PATH", "some/path/")
      .dependsOn(copyToDeployBucketStep);

    const deployEditorToUserTestingStep = new TriggerStep(
      webDeploy,
      "Deploy to usertesting"
    )
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
    return webBuildEditor;
  }

  it("can produce YAML for simple pipelines", () => {
    const webDeploy = createSimple();

    // expect(webDeploy.serialize()).toMatchSnapshot();
    expect(webDeploy.toYAML()).toMatchSnapshot();
  });

  it("can produce YAML for complex pipelines", () => {
    const webBuildEditor = createComplex();
    // expect(webBuildEditor.serialize()).toMatchSnapshot();
    expect(webBuildEditor.toYAML()).toMatchSnapshot();
  });

  it("can produce dot for complex pipelines", () => {
    const webBuildEditor = createComplex();
    expect(webBuildEditor.toDot()).toMatchSnapshot();
  });
});
