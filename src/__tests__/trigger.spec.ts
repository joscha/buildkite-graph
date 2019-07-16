import { Entity } from '../';
import { ExitStatus } from '../steps/base';
import { Step, Command } from '../steps/command';
import { TriggerStep } from '../steps/trigger';
import { Plugin } from '../plugins';
import { createTest } from './helpers';
import { createSimple, createComplex } from './samples';

describe('buildkite-graph', () => {
    describe('Steps', () => {
        describe('Trigger', () => {
            createTest('can trigger another pipeline', () => [
                new Entity('whatever').add(
                    new TriggerStep(new Entity('another-build')),
                ),
                new Entity('whatever').add(new TriggerStep('another-build')),
            ]);

            createTest('with a label', () => [
                new Entity('whatever').add(
                    new TriggerStep('another', 'Trigger another pipeline'),
                ),
            ]);

            createTest('limit branches', () => [
                new Entity('whatever').add(
                    new TriggerStep('another').withBranch('master'),
                ),
            ]);
            createTest('async', () => [
                new Entity('whatever').add(
                    new TriggerStep('another', 'Label', true),
                ),
                new Entity('whatever').add(
                    new TriggerStep('another', 'Label', true).async(false),
                ),
                new Entity('whatever').add(
                    new TriggerStep('another').async(true),
                ),
            ]);

            createTest('build', () => [
                new Entity('whatever').add(
                    new TriggerStep('another').build.env
                        .set('KEY', 'VALUE')
                        .build.env.set('ANOTHER_KEY', 'VALUE'),
                ),
                new Entity('whatever').add(
                    new TriggerStep('another').build.withBranch('rease-bla'),
                ),
                new Entity('whatever').add(
                    new TriggerStep('another').build.withCommit('c0ffee'),
                ),
                new Entity('whatever').add(
                    new TriggerStep('another').build.withMessage('My messge'),
                ),
                new Entity('whatever').add(
                    new TriggerStep('another').build.metadata
                        .set('release-version', '1.1')
                        .build.metadata.set('some-other', 'value'),
                ),
            ]);
        });
    });
});
