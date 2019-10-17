import {
    Pipeline,
    Serializer,
    serializers as predefinedSerializers,
} from '../';

export const serializers: Record<string, Serializer<any>> = {
    json: new predefinedSerializers.JsonSerializer(),
    yaml: new predefinedSerializers.YamlSerializer(),
    dot: new predefinedSerializers.DotSerializer(),
};

type PipelineGenerator = () => Pipeline | Pipeline[];

export const createTest = (
    name: string,
    gen: PipelineGenerator,
    describeFn = describe,
): void =>
    describeFn(name, () => {
        test.each(Object.keys(serializers))('%s', async type => {
            let entities = gen();
            if (!Array.isArray(entities)) {
                entities = [entities];
            }
            for (const entity of entities) {
                expect(
                    await serializers[type].serialize(entity),
                ).toMatchSnapshot();
            }
        });
    });

createTest.only = (name: string, gen: PipelineGenerator) =>
    createTest(name, gen, describe.only);
