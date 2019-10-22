import { CommandStep, Pipeline, serializers } from '../';
import { createTest } from './helpers';
import { createComplex, createSimple } from './samples';

describe('buildkite-graph', () => {
    describe('general serialization', () => {
        createTest('simple', createSimple);
        createTest('complex', createComplex);

        it('JSON serializer can stringify', async () => {
            expect(
                await new serializers.JsonSerializer(true).serialize(
                    new Pipeline('test'),
                ),
            ).toMatchSnapshot();
        });

        it('Structural serializer can stringify', async () => {
            expect(
                await new serializers.StructuralSerializer().serialize(
                    createComplex(),
                ),
            ).toMatchSnapshot();
        });
    });

    createTest('missing transitive steps get added to the graph', () => {
        const step1 = new CommandStep('yarn');
        const step2 = new CommandStep('yarn test').dependsOn(step1);
        return new Pipeline('test').add(step2);
    });

    describe('Pipeline', () => {
        it('returns a slug', () => {
            expect(new Pipeline('A: B: c_d').slug()).toEqual('a-b-c-d');
            expect(new Pipeline('Web: E2E: page').slug()).toEqual(
                'web-e2e-page',
            );
        });

        createTest('env', () => [
            new Pipeline('whatever').env.set('COLOR', '1'),
        ]);

        createTest('steps', () => [
            new Pipeline('whatever').add(new CommandStep('command')),
        ]);
    });
});
