import { Pipeline } from '../';
import { TriggerStep } from '../steps/trigger';
import { createTest } from './helpers';

describe('buildkite-graph', () => {
    describe('Steps', () => {
        describe('Trigger', () => {
            createTest('can trigger another pipeline', () => [
                new Pipeline('whatever').add(
                    new TriggerStep(new Pipeline('another-build')),
                ),
                new Pipeline('whatever').add(new TriggerStep('another-build')),
            ]);

            createTest('with a label', () => [
                new Pipeline('whatever').add(
                    new TriggerStep('another', 'Trigger another pipeline'),
                ),
            ]);

            createTest('limit branches', () => [
                new Pipeline('whatever').add(
                    new TriggerStep('another').withBranch('master'),
                ),
            ]);
            createTest('async', () => [
                new Pipeline('whatever').add(
                    new TriggerStep('another', 'Label', true),
                ),
                new Pipeline('whatever').add(
                    new TriggerStep('another', 'Label', true).async(false),
                ),
                new Pipeline('whatever').add(
                    new TriggerStep('another').async(true),
                ),
            ]);

            createTest('build', () => [
                new Pipeline('whatever').add(
                    new TriggerStep('another').build.env
                        .set('KEY', 'VALUE')
                        .build.env.set('ANOTHER_KEY', 'VALUE'),
                ),
                new Pipeline('whatever').add(
                    new TriggerStep('another').build.withBranch('rease-bla'),
                ),
                new Pipeline('whatever').add(
                    new TriggerStep('another').build.withCommit('c0ffee'),
                ),
                new Pipeline('whatever').add(
                    new TriggerStep('another').build.withMessage('My messge'),
                ),
                new Pipeline('whatever').add(
                    new TriggerStep('another').build.metadata
                        .set('release-version', '1.1')
                        .build.metadata.set('some-other', 'value'),
                ),
            ]);
        });
    });
});
