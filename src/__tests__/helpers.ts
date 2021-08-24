import { MutatorFn } from 'src/serializers';
import {
  Pipeline,
  Serializer,
  serializers as predefinedSerializers,
  Step,
} from '../';
import { resetUuidCounter } from './setup';

type SerializerType =
  | 'json'
  | 'json_depends_on'
  | 'yaml'
  | 'yaml_depends_on'
  | 'dot'
  | 'structure'
  | 'yaml_mutate';

const mutate: MutatorFn = async (entity: Step) => {
  return;
};
export const serializers: Record<SerializerType, Serializer<any>> = {
  json: new predefinedSerializers.JsonSerializer(),
  json_depends_on: new predefinedSerializers.JsonSerializer({
    explicitDependencies: true,
  }),
  yaml: new predefinedSerializers.YamlSerializer(),
  yaml_depends_on: new predefinedSerializers.YamlSerializer({
    explicitDependencies: true,
  }),
  dot: new predefinedSerializers.DotSerializer(),
  structure: new predefinedSerializers.StructuralSerializer(),
  yaml_mutate: new predefinedSerializers.YamlSerializer({ mutator: mutate }),
};

type PipelineGenerator = () => Pipeline | Pipeline[];

const defaultSerializerTypes: SerializerType[] = [
  'json',
  'json_depends_on',
  'yaml',
  'yaml_depends_on',
  'dot',
  'structure',
  'yaml_mutate',
];

export const createTest = (
  name: string,
  gen: PipelineGenerator,
  serializersToTest: SerializerType[] = defaultSerializerTypes,
  describeFn = describe,
): void =>
  describeFn(name, () => {
    test.each(serializersToTest)('%s', async (type) => {
      resetUuidCounter();
      let entities = gen();
      if (!Array.isArray(entities)) {
        entities = [entities];
      }
      for (const entity of entities) {
        expect(await serializers[type].serialize(entity)).toMatchSnapshot();
      }
    });
  });

createTest.only = (name: string, gen: PipelineGenerator) =>
  createTest(name, gen, defaultSerializerTypes, describe.only);
