import { Command, Entity, Step, Plugin } from '../';
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

function createTest(name: string, gen: () => Entity) {
    describe(name, () => {
        test.each(Object.keys(serializers))('%s', type => {
            expect(serializers[type].serialize(gen())).toMatchSnapshot();
        });
    });
}

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
                const passed = new Step('echo The command passed').dependsOn(
                    command,
                );

                return new Entity('test')
                    .add(command)
                    .add(always)
                    .add(passed);
            },
        );
    });

    describe('timeouts', () => {
        createTest('commands with timeouts set step timeout total', () => {
            const command1 = new Command('yarn install', 10);
            const command2 = new Command('yarn test', 10);
            return new Entity('test').add(new Step([command1, command2]));
        });

        createTest('step timeout total trumps commands', () => {
            const command1 = new Command('yarn install', 10);
            const command2 = new Command('yarn test', 10);
            return new Entity('test').add(
                new Step([command1, command2]).withTimeout(2),
            );
        });

        createTest('one infinite timeout will cancel out the others', () => {
            const command1 = new Command('yarn install', 10);
            const command2 = new Command('yarn test');
            return new Entity('test').add(new Step([command1, command2]));
        });

        createTest('can be infinite', () => {
            return new Entity('test').add(new Step('noop').withTimeout());
        });
    });

    createTest('agents', () =>
        new Entity('whatever').add(new Step('noop').withAgent('npm', 'true')),
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
                                artifact_path: 'web/target/htmllint-*.txt',
                                type: 'oneline',
                            },
                        ],
                    }),
                )
                .plugins.add(new Plugin('detect-clowns#v1.0.0')),
        ),
    );
});
