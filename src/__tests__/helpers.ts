import { Pipeline } from '../';
import { Serializer } from '../serializers';
import { DotSerializer } from '../serializers/dot';
import { JsonSerializer } from '../serializers/json';
import { YamlSerializer } from '../serializers/yaml';

const serializers: Record<string, Serializer<any>> = {
    json: new JsonSerializer(),
    yaml: new YamlSerializer(),
    dot: new DotSerializer(),
};

type PipelineGenerator = () => Pipeline | Pipeline[];

export const createTest = (
    name: string,
    gen: PipelineGenerator,
    describeFn = describe,
): void =>
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

createTest.only = (name: string, gen: PipelineGenerator) =>
    createTest(name, gen, describe.only);
