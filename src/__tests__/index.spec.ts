import { CommandStep, Pipeline } from '../';
import { createTest } from './helpers';
import { createComplex, createSimple } from './samples';

describe('buildkite-graph', () => {
    describe('general serialization', () => {
        createTest('simple', createSimple);
        createTest('complex', createComplex);
    });

    createTest('missing transitive steps get added to the graph', () => {
        const step1 = new CommandStep('yarn');
        const step2 = new CommandStep('yarn test').dependsOn(step1);
        return new Pipeline('test').add(step2);
    });

    describe('Pipeline', () => {
        createTest('env', () => [
            new Pipeline('whatever').env.set('COLOR', '1'),
        ]);

        createTest('steps', () => [
            new Pipeline('whatever').add(new CommandStep('command')),
        ]);

        createTest('can be augmented', () => [
            new Pipeline('a')
                .add(new CommandStep('a'))
                .add(new CommandStep('b'))
                .add(
                    new Pipeline('a')
                        .add(new CommandStep('c'))
                        .add(new CommandStep('d')),
                ),
        ]);
    });
});
