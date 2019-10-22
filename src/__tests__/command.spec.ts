import { Command, CommandStep, ExitStatus, Pipeline, Plugin } from '../';
import { createTest } from './helpers';

describe('buildkite-graph', () => {
    describe('Steps', () => {
        describe('dependencies', () => {
            createTest('step dependency', () => [
                new Pipeline('whatever').add(
                    new CommandStep('b').dependsOn(new CommandStep('a')),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('d').dependsOn(
                        new CommandStep('a'),
                        new CommandStep('b'),
                        new CommandStep('c'),
                    ),
                ),
            ]);
            createTest('can depend on itself to produce wait', () => {
                const c = new CommandStep('c');
                return new Pipeline('whatever').add(
                    new CommandStep('a'),
                    new CommandStep('b'),
                    c.dependsOn(c),
                );
            });
        });

        describe('Command', () => {
            createTest('step addition', () => [
                new Pipeline('whatever').add(
                    new CommandStep('yarn').add('yarn test'),
                ),
                new Pipeline('x').add(new CommandStep('')),
            ]);

            describe('continue on failure', () => {
                createTest(
                    'multiple subsequent always-executed subsequent steps do not get an additional wait step',
                    () => {
                        const command = new CommandStep('command.sh');
                        const always = new CommandStep(
                            'echo This runs regardless of the success or failure',
                        )
                            .alwaysExecute()
                            .dependsOn(command);
                        const always2 = new CommandStep(
                            'echo This runs regardless of the success or failure 2',
                        )
                            .alwaysExecute()
                            .dependsOn(command);
                        const always3 = new CommandStep(
                            'echo This runs regardless of the success or failure 3',
                        )
                            .alwaysExecute()
                            .dependsOn(command);

                        return new Pipeline('test')
                            .add(command)
                            .add(always)
                            .add(always2)
                            .add(always3);
                    },
                );

                createTest(
                    'subsequent depending steps that are not always executed get an additional wait step',
                    () => {
                        const command = new CommandStep('command.sh');
                        const always = new CommandStep(
                            'echo This runs regardless of the success or failure',
                        )
                            .alwaysExecute()
                            .dependsOn(command);
                        const passed = new CommandStep(
                            'echo The command passed',
                        ).dependsOn(command);

                        return new Pipeline('test')
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
                        return new Pipeline('test').add(
                            new CommandStep([command1, command2]),
                        );
                    },
                );

                createTest('step timeout total trumps commands', () => {
                    const command1 = new Command('yarn install', 10);
                    const command2 = new Command('yarn test', 10);
                    return new Pipeline('test').add(
                        new CommandStep([command1, command2])
                            .withTimeout(100)
                            .withTimeout(2),
                    );
                });

                createTest(
                    'one infinite timeout will cancel out the others',
                    () => {
                        const command1 = new Command('yarn install', 10);
                        const command2 = new Command('yarn test');
                        return new Pipeline('test').add(
                            new CommandStep([command1, command2]),
                        );
                    },
                );

                createTest('can be infinite', () => {
                    return new Pipeline('test').add(
                        new CommandStep('noop').withTimeout(),
                    );
                });
            });

            createTest('agents', () =>
                new Pipeline('whatever').add(
                    new CommandStep('noop').withAgent('npm', 'true'),
                ),
            );

            createTest('artifact_paths', () => [
                new Pipeline('whatever').add(
                    new CommandStep('noop')
                        .withArtifactPath('logs/**/*')
                        .withArtifactPath('coverage/**/*'),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').withArtifactPath(
                        'logs/**/*',
                        'coverage/**/*',
                    ),
                ),
            ]);

            createTest('branches', () =>
                new Pipeline('whatever').add(
                    new CommandStep('noop')
                        .withBranch('master')
                        .withBranch('stable/*')
                        .withBranch('!release/*'),
                ),
            );

            createTest('concurrency', () =>
                new Pipeline('whatever').add(
                    new CommandStep('noop')
                        .withConcurrency(10, 'will/be/overridden')
                        .withConcurrency(3, 'my-app/deploy'),
                ),
            );

            createTest('env', () =>
                new Pipeline('whatever').add(
                    new CommandStep('noop').env
                        .set('RAILS_ENV', 'test')
                        .env.set('DEBUG', 'true'),
                ),
            );

            createTest('id', () =>
                new Pipeline('whatever').add(
                    new CommandStep('noop')
                        .withId('my-id-overridden')
                        .withId('my-id'),
                ),
            );

            createTest('label', () =>
                new Pipeline('whatever').add(
                    new CommandStep('noop')
                        .withLabel('my label overridden')
                        .withLabel('my label'),
                ),
            );

            createTest('parallelism', () => [
                new Pipeline('whatever').add(
                    new CommandStep('noop')
                        .withParallelism(100)
                        .withParallelism(123),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').withParallelism(1),
                ),
            ]);

            createTest('plugins', () =>
                new Pipeline('whatever').add(
                    new CommandStep('noop').plugins
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
                    new Pipeline('whatever').add(
                        new CommandStep('noop').withSoftFail('*'),
                    ),
                    new Pipeline('whatever').add(
                        new CommandStep('noop').withSoftFail(true),
                    ),
                ]);

                createTest('multiple', () =>
                    new Pipeline('whatever').add(
                        new CommandStep('noop')
                            .withSoftFail(1)
                            .withSoftFail(-127),
                    ),
                );

                createTest('star', () =>
                    new Pipeline('whatever').add(
                        new CommandStep('noop')
                            .withSoftFail(1)
                            .withSoftFail('*'),
                    ),
                );
            });

            describe('skip', () => {
                createTest('value', () => [
                    new Pipeline('whatever').add(
                        new CommandStep('noop').skip(false),
                    ),
                    new Pipeline('whatever').add(
                        new CommandStep('noop').skip(false).skip(true),
                    ),
                    new Pipeline('whatever').add(
                        new CommandStep('noop').skip('my reason'),
                    ),
                ]);

                createTest('function', () => [
                    new Pipeline('whatever').add(
                        new CommandStep('noop').skip(() => false),
                    ),
                    new Pipeline('whatever').add(
                        new CommandStep('noop').skip(() => true),
                    ),
                    new Pipeline('whatever').add(
                        new CommandStep('noop').skip(() => 'my reason'),
                    ),
                ]);
            });

            createTest('retry', () => [
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry.automatic(true),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry.automatic(
                        new Map<ExitStatus, number>([['*', 2], [255, 2]]),
                    ),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry.manual(false),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry.manual(
                        false,
                        false,
                        "Sorry, you can't retry a deployment",
                    ),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry.manual(
                        true,
                        false,
                        "Sorry, you can't retry a deployment",
                    ),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry.manual(true, true),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry
                        .automatic(true)
                        .retry.manual(true, true),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry.automatic(2),
                ),
                new Pipeline('whatever').add(
                    new CommandStep('noop').retry.automatic(
                        new Map<ExitStatus, number>([['*', 1]]),
                    ),
                ),
            ]);
        });
    });
});
