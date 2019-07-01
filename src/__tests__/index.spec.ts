import { Entity, Step } from '../';
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

    /*
    describe('can produce JSON', () => {
        const serializer = new JsonSerializer();
        it('for simple pipelines', () => {
            const webDeploy = createSimple();

            expect(serializer.serialize(webDeploy)).toMatchSnapshot();
        });

        it('for complex pipelines', () => {
            const webBuildEditor = createComplex();
            expect(serializer.serialize(webBuildEditor)).toMatchSnapshot();
        });

        describe('continue on failure', () => {
            it('multiple subsequent always-executed subsequent steps do not get an additional wait step', () => {
                const command = new Step('command.sh');
                const always = new Step('echo This runs regardless of the success or failure')
                .alwaysExecute()
                .dependsOn(command);
                const always2 = new Step('echo This runs regardless of the success or failure 2')
                .alwaysExecute()
                .dependsOn(command);
                const always3 = new Step('echo This runs regardless of the success or failure 3')
                .alwaysExecute()
                .dependsOn(command);

                const pipeline = new Entity('test')
                    .add(command)
                    .add(always)
                    .add(always2)
                    .add(always3);

                    expect(serializer.serialize(pipeline)).toMatchSnapshot();
            });

            it('subsequent depending steps that are not always executed get an additional wait step', () => {
                const command = new Step('command.sh');
                const always = new Step('echo This runs regardless of the success or failure')
                .alwaysExecute()
                .dependsOn(command);
                const passed = new Step('echo The command passed')
                .dependsOn(command);

                const pipeline = new Entity('test')
                    .add(command)
                    .add(always)
                    .add(passed);

                    expect(serializer.serialize(pipeline)).toMatchSnapshot();
            });
        });
    });

    describe('can produce YAML', () => {
        const serializer = new YamlSerializer();
        it('for simple pipelines', () => {
            const webDeploy = createSimple();
            expect(serializer.serialize(webDeploy)).toMatchSnapshot();
        });

        it('for complex pipelines', () => {
            const webBuildEditor = createComplex();
            expect(serializer.serialize(webBuildEditor)).toMatchSnapshot();
        });
    });

    describe('can produce dot', () => {
        const serializer = new DotSerializer();
        it('for complex pipelines', () => {
            const webBuildEditor = createComplex();
            expect(serializer.serialize(webBuildEditor)).toMatchSnapshot();
        });
    });
    */
});
