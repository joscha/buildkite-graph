import { Entity, Step, TriggerStep, Plugin } from '../';

export function createSimple() {
    return new Entity('web-deploy').env
        .set('USE_COLOR', 1)
        .env.set('DEBUG', true)
        .add(new Step('buildkite/deploy_web.sh', 'Deploy'));
}

export function createComplex() {
    const webDeploy = createSimple();
    const buildEditorStep = new Step(
        'web/bin/buildkite/run_web_step.sh build editor',
        'Build Editor',
    );
    const testEditorStep = new Step(
        'web/bin/buildkite/run_web_step.sh test editor',
        'Test Editor',
    );

    const annotateFailuresStep = new Step(
        new Plugin('bugcrowd/test-summary#v1.5.0', {
            inputs: [
                {
                    label: ':htmllint: HTML lint',
                    artifact_path: 'web/target/htmllint-*.txt',
                    type: 'oneline',
                },
            ],
        }),

        'Annotate failures',
    ).plugins
        .add(new Plugin('detect-clowns#v1.0.0'))
        .alwaysExecute()
        .dependsOn(testEditorStep);

    const deployCoverageReportStep = new Step(
        'web/bin/buildkite/run_web_step.sh deploy-report coverage editor',
        'Upload coverage',
    )
        .alwaysExecute()
        .dependsOn(testEditorStep);

    const integrationTestStep = new Step(
        'web/bin/buildkite/run_web_step.sh run-integration-tests local editor chrome',
        'Integration tests',
    )
        .withParallelism(8)
        .dependsOn(buildEditorStep);

    const saucelabsIntegrationTestStep = new Step(
        'web/bin/buildkite/run_web_step.sh run-integration-tests saucelabs editor safari',
        ':saucelabs: Integration tests',
    )
        .withParallelism(8)
        .add(new Plugin('sauce-connect-plugin'))
        .dependsOn(integrationTestStep);

    const visregBaselineUpdateStep = new Step(
        'web/bin/buildkite/run_web_step.sh run-visual-regression editor',
        'Visreg baseline update',
    ).dependsOn(integrationTestStep);

    const annotateCucumberFailuresStep = new Step(
        'web/bin/buildkite/run_web_step.sh annotate-cucumber-failed-cases',
    )
        .alwaysExecute()
        .dependsOn(integrationTestStep)
        .dependsOn(saucelabsIntegrationTestStep);

    const copyToDeployBucketStep = new Step(
        'web/bin/buildkite/run_web_step.sh copy-to-deploy-bucket editor',
        'Copy to deploy bucket',
    ).dependsOn(saucelabsIntegrationTestStep);

    const updateCheckpointStep = new Step(
        'production/test/jobs/advance_branch.sh "checkpoint/web/green/editor"',
        'Update checkpoint',
    ).dependsOn(copyToDeployBucketStep);

    const deployEditorToTechStep = new TriggerStep(
        webDeploy,
        'Deploy to tech',
    ).build.env
        .set('FLAVOR', 'tech')
        .build.env.set('RELEASE_PATH', 'some/path/')
        .dependsOn(copyToDeployBucketStep);

    const deployEditorToUserTestingStep = new TriggerStep(
        webDeploy,
        'Deploy to usertesting',
    ).build.env
        .set('FLAVOR', 'usertesting')
        .build.env.set('RELEASE_PATH', 'some/path/')
        .dependsOn(copyToDeployBucketStep);

    /*
const releaseStep = new ManualStep('Release editor', options)
  .dependsOn(updateCheckpointStep)
*/

    const webBuildEditor = new Entity('web-build-editor')
        .add(buildEditorStep)
        .add(testEditorStep)
        .add(annotateFailuresStep)
        .add(deployCoverageReportStep)
        .add(integrationTestStep)
        .add(saucelabsIntegrationTestStep)
        .add(visregBaselineUpdateStep)
        .add(annotateCucumberFailuresStep)
        .add(copyToDeployBucketStep)
        .add(updateCheckpointStep)
        .add(deployEditorToTechStep)
        .add(deployEditorToUserTestingStep);
    // .add(releaseStep)
    return webBuildEditor;
}
