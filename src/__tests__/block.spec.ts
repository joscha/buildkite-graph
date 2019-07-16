import { Entity } from '../';
import { ExitStatus } from '../steps/base';
import { Step, Command } from '../steps/command';
import { BlockStep } from '../steps/block';
import { TextField, SelectField, Option } from '../steps/block/fields';
import { Plugin } from '../plugins';
import { createTest } from './helpers';
import { createSimple, createComplex } from './samples';

describe('buildkite-graph', () => {
    describe('Steps', () => {
        describe('Block', () => {
            createTest('can be added', () => [
                new Entity('whatever').add(new BlockStep(':rocket: Release!')),
                new Entity('whatever').add(
                    new BlockStep(
                        ':rocket: Release!',
                        'Release to production?',
                    ),
                ),
            ]);

            createTest('branches', () =>
                new Entity('whatever').add(
                    new BlockStep('my title')
                        .withBranch('master')
                        .withBranch('stable/*')
                        .withBranch('!release/*'),
                ),
            );

            createTest('with fields', () => [
                new Entity('whatever').add(
                    new BlockStep('my title').fields
                        .add(new TextField('field-1'))
                        .fields.add(new SelectField('field-2'))
                        .fields.add(new TextField('field-3')),
                ),
                new Entity('whatever').add(
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
                new Entity('whatever').add(
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
                new Entity('whatever').add(
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
