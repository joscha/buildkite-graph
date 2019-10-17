import { BlockStep, Option, Pipeline, SelectField, TextField } from '../';
import { createTest } from './helpers';

describe('buildkite-graph', () => {
    describe('Steps', () => {
        describe('Block', () => {
            createTest('can be added', () => [
                new Pipeline('whatever').add(
                    new BlockStep(':rocket: Release!'),
                ),
                new Pipeline('whatever').add(
                    new BlockStep(
                        ':rocket: Release!',
                        'Release to production?',
                    ),
                ),
            ]);

            createTest('branches', () =>
                new Pipeline('whatever').add(
                    new BlockStep('my title')
                        .withBranch('master')
                        .withBranch('stable/*')
                        .withBranch('!release/*'),
                ),
            );

            createTest('with fields', () => [
                new Pipeline('whatever').add(
                    new BlockStep('my title').fields
                        .add(new TextField('field-1', 'Label 1'))
                        .fields.add(new SelectField('field-2', 'Label 2'))
                        .fields.add(new TextField('field-3', 'Label 3')),
                ),
                new Pipeline('whatever').add(
                    new BlockStep('my title').fields.add(
                        new TextField(
                            'release-name',
                            'Code Name',
                            'What’s the code name for this release? :name_badge:',
                            false,
                            'Flying Dolphin',
                        ),
                    ),
                ),
                new Pipeline('whatever').add(
                    new BlockStep('my title').fields.add(
                        new SelectField(
                            'release-stream',
                            'Stream',
                            'What’s the release stream?',
                            false,
                            false,
                            'beta',
                        )
                            .addOption(new Option('Beta', 'beta'))
                            .addOption(new Option('Stable', 'stable')),
                    ),
                ),
                new Pipeline('whatever').add(
                    new BlockStep('my title').fields.add(
                        new SelectField(
                            'regions',
                            'Regions',
                            'Which regions should we deploy this to? :earth_asia:',
                            true,
                            true,
                            ['na', 'eur', 'asia', 'aunz'],
                        )
                            .addOption(new Option('North America', 'na'))
                            .addOption(new Option('Europe', 'eur'))
                            .addOption(new Option('Asia', 'asia'))
                            .addOption(new Option('Oceania', 'aunz')),
                    ),
                ),
            ]);
        });
    });
});
