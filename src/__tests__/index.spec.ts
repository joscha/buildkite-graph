import { Command, Entity, Step } from '../';
import { DotSerializer } from '../serializers/dot';
import { JsonSerializer } from '../serializers/json';
import { YamlSerializer } from '../serializers/yaml';
import { createSimple, createComplex } from './helpers';

const jsonSerializer = new JsonSerializer();
const yamlSerializer = new YamlSerializer();
const dotSerializer = new DotSerializer();

function createTest(name: string, gen: () => Entity) {
    describe('JSON', () => {
        it(name, () => {
            expect(jsonSerializer.serialize(gen())).toMatchSnapshot();
        });
    });
    describe('YAML', () => {
        it(name, () => {
            expect(yamlSerializer.serialize(gen())).toMatchSnapshot();
        });
    });
    describe('dot', () => {
        it(name, () => {
            expect(dotSerializer.serialize(gen())).toMatchSnapshot();
        });
    });
}

describe('buildkite-graph', () => {
    describe('general serialization', () => {
        createTest('simple', createSimple);
        createTest('complex', createComplex);
    });

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
    });
});
