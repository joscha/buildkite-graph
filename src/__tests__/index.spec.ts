import { Pipeline } from '../';
import { Step } from '../steps/command';
import { createTest } from './helpers';
import { createSimple, createComplex } from './samples';

describe('buildkite-graph', () => {
    describe('general serialization', () => {
        createTest('simple', createSimple);
        createTest('complex', createComplex);
    });

    createTest('missing transitive steps get added to the graph', () => {
        const step1 = new Step('yarn');
        const step2 = new Step('yarn test').dependsOn(step1);
        return new Pipeline('test').add(step2);
    });

    describe('Pipeline', () => {
        createTest('env', () => [
            new Pipeline('whatever').env.set('COLOR', '1'),
        ]);

        createTest('steps', () => [
            new Pipeline('whatever').add(new Step('command')),
        ]);

        createTest('can be augmented', () => [
            new Pipeline('a')
                .add(new Step('a'))
                .add(new Step('b'))
                .add(new Pipeline('a').add(new Step('c')).add(new Step('d'))),
        ]);
    });
});
