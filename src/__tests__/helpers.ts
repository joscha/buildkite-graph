import {
    Pipeline,
    Serializer,
    serializers as predefinedSerializers,
} from '../';

type SerializerType = 'json' | 'yaml' | 'dot' | 'structure';

export const serializers: Record<SerializerType, Serializer<any>> = {
    json: new predefinedSerializers.JsonSerializer(),
    yaml: new predefinedSerializers.YamlSerializer(),
    dot: new predefinedSerializers.DotSerializer(),
    structure: new predefinedSerializers.StructuralSerializer(),
};

type PipelineGenerator = () => Pipeline | Pipeline[];

const defaultSerializerTypes: SerializerType[] = [
    'json',
    'yaml',
    'dot',
    'structure',
];

export const createTest = (
    name: string,
    gen: PipelineGenerator,
    serializersToTest: SerializerType[] = defaultSerializerTypes,
    describeFn = describe,
): void =>
    describeFn(name, () => {
        test.each(serializersToTest)('%s', async type => {
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
    createTest(name, gen, defaultSerializerTypes, describe.only);
