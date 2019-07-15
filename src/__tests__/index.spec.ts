import {
    Command,
    Entity,
    Step,
    Plugin,
    ExitStatus,
    BlockStep,
    SelectField,
    TextField,
    Option,
    TriggerStep,
} from '../';
import { Serializer } from '../serializer';
import { DotSerializer } from '../serializers/dot';
import { JsonSerializer } from '../serializers/json';
import { YamlSerializer } from '../serializers/yaml';
import { createSimple, createComplex } from './helpers';

const serializers: Record<string, Serializer<any>> = {
    json: new JsonSerializer(),
    yaml: new YamlSerializer(),
    dot: new DotSerializer(),
};

type EntityGenerator = () => Entity | Entity[];

const createTest = (
    name: string,
    gen: EntityGenerator,
    describeFn = describe,
) =>
    describeFn(name, () => {
        test.each(Object.keys(serializers))('%s', type => {
            let entities = gen();
            if (!Array.isArray(entities)) {
                entities = [entities];
            }
            for (const entity of entities) {
                expect(serializers[type].serialize(entity)).toMatchSnapshot();
            }
        });
    });

createTest.only = (name: string, gen: EntityGenerator) =>
    createTest(name, gen, describe.only);

describe('buildkite-graph', () => {
    describe('general serialization', () => {
        createTest('simple', createSimple);
        createTest('complex', createComplex);
    });

    createTest('missing transitive steps get added to the graph', () => {
        const step1 = new Step('yarn');
        const step2 = new Step('yarn test').dependsOn(step1);
        return new Entity('test').add(step2);
    });

    describe('Pipeline', () => {
        createTest('env', () => [new Entity('whatever').env.set('COLOR', '1')]);

        createTest('steps', () => [
            new Entity('whatever').add(new Step('command')),
        ]);
    });

    describe('Steps', () => {
        describe('Command', () => {
            createTest('step addition', () =>
                new Entity('whatever').add(new Step('yarn').add('yarn test')),
            );

            describe('continue on failure', () => {
                createTest(
                    'multiple subsequent always-executed subsequent steps do not get an additional wait step',
                    () => {
                        const command = new Step('command.sh');
                        const always = new Step(
                            'echo This runs regardless of the success or failure',
                        )
                            .alwaysExecute()
                            .dependsOn(command);
                        const always2 = new Step(
                            'echo This runs regardless of the success or failure 2',
                        )
                            .alwaysExecute()
                            .dependsOn(command);
                        const always3 = new Step(
                            'echo This runs regardless of the success or failure 3',
                        )
                            .alwaysExecute()
                            .dependsOn(command);

                        return new Entity('test')
                            .add(command)
                            .add(always)
                            .add(always2)
                            .add(always3);
                    },
                );

                createTest(
                    'subsequent depending steps that are not always executed get an additional wait step',
                    () => {
                        const command = new Step('command.sh');
                        const always = new Step(
                            'echo This runs regardless of the success or failure',
                        )
                            .alwaysExecute()
                            .dependsOn(command);
                        const passed = new Step(
                            'echo The command passed',
                        ).dependsOn(command);

                        return new Entity('test')
                            .add(command)
                            .add(always)
                            .add(passed);
                    },
                );
            });

            describe('timeouts', () => {
                createTest(
                    'commands with timeouts set step timeout total',
                    () => {
                        const command1 = new Command('yarn install', 10);
                        const command2 = new Command('yarn test', 10);
                        return new Entity('test').add(
                            new Step([command1, command2]),
                        );
                    },
                );

                createTest('step timeout total trumps commands', () => {
                    const command1 = new Command('yarn install', 10);
                    const command2 = new Command('yarn test', 10);
                    return new Entity('test').add(
                        new Step([command1, command2])
                            .withTimeout(100)
                            .withTimeout(2),
                    );
                });

                createTest(
                    'one infinite timeout will cancel out the others',
                    () => {
                        const command1 = new Command('yarn install', 10);
                        const command2 = new Command('yarn test');
                        return new Entity('test').add(
                            new Step([command1, command2]),
                        );
                    },
                );

                createTest('can be infinite', () => {
                    return new Entity('test').add(
                        new Step('noop').withTimeout(),
                    );
                });
            });

            createTest('agents', () =>
                new Entity('whatever').add(
                    new Step('noop').withAgent('npm', 'true'),
                ),
            );

            createTest('artifact_paths', () =>
                new Entity('whatever').add(
                    new Step('noop')
                        .withArtifactPath('logs/**/*')
                        .withArtifactPath('coverage/**/*'),
                ),
            );

            createTest('branches', () =>
                new Entity('whatever').add(
                    new Step('noop')
                        .withBranch('master')
                        .withBranch('stable/*')
                        .withBranch('!release/*'),
                ),
            );

            createTest('concurrency', () =>
                new Entity('whatever').add(
                    new Step('noop')
                        .withConcurrency(10, 'will/be/overridden')
                        .withConcurrency(3, 'my-app/deploy'),
                ),
            );

            createTest('env', () =>
                new Entity('whatever').add(
                    new Step('noop').env
                        .set('RAILS_ENV', 'test')
                        .env.set('DEBUG', 'true'),
                ),
            );

            createTest('id', () =>
                new Entity('whatever').add(
                    new Step('noop').withId('my-id-overridden').withId('my-id'),
                ),
            );

            createTest('label', () =>
                new Entity('whatever').add(
                    new Step('noop')
                        .withLabel('my label overridden')
                        .withLabel('my label'),
                ),
            );

            createTest('parallelism', () =>
                new Entity('whatever').add(
                    new Step('noop').withParallelism(100).withParallelism(123),
                ),
            );

            createTest('plugins', () =>
                new Entity('whatever').add(
                    new Step('noop').plugins
                        .add(
                            new Plugin('bugcrowd/test-summary#v1.5.0', {
                                inputs: [
                                    {
                                        label: ':htmllint: HTML lint',
                                        artifact_path:
                                            'web/target/htmllint-*.txt',
                                        type: 'oneline',
                                    },
                                ],
                            }),
                        )
                        .plugins.add(new Plugin('detect-clowns#v1.0.0')),
                ),
            );

            describe('soft_fail', () => {
                createTest('boolean', () => [
                    new Entity('whatever').add(
                        new Step('noop').withSoftFail('*'),
                    ),
                    new Entity('whatever').add(
                        new Step('noop').withSoftFail(true),
                    ),
                ]);

                createTest('multiple', () =>
                    new Entity('whatever').add(
                        new Step('noop').withSoftFail(1).withSoftFail(-127),
                    ),
                );

                createTest('star', () =>
                    new Entity('whatever').add(
                        new Step('noop').withSoftFail(1).withSoftFail('*'),
                    ),
                );
            });

            createTest('skip', () => [
                new Entity('whatever').add(
                    new Step('noop').skip(false).skip(true),
                ),
                new Entity('whatever').add(new Step('noop').skip('my reason')),
            ]);

            createTest('retry', () => [
                new Entity('whatever').add(
                    new Step('noop').retry.automatic(true),
                ),
                new Entity('whatever').add(
                    new Step('noop').retry.automatic(
                        new Map<ExitStatus, number>([['*', 2], [255, 2]]),
                    ),
                ),
                new Entity('whatever').add(
                    new Step('noop').retry.manual(false),
                ),
                new Entity('whatever').add(
                    new Step('noop').retry.manual(
                        false,
                        false,
                        "Sorry, you can't retry a deployment",
                    ),
                ),
                new Entity('whatever').add(
                    new Step('noop').retry.manual(
                        true,
                        false,
                        "Sorry, you can't retry a deployment",
                    ),
                ),
                new Entity('whatever').add(
                    new Step('noop').retry.manual(true, true),
                ),
                new Entity('whatever').add(
                    new Step('noop').retry
                        .automatic(true)
                        .retry.manual(true, true),
                ),
            ]);
        });

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
