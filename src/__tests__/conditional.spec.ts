import { CommandStep, Conditional, Pipeline, Step } from '../';
import { createTest } from './helpers';

class MyConditional<T extends Step | Pipeline> extends Conditional<T> {
    constructor(step: T, private readonly accepted: boolean) {
        super(step);
    }

    accept(): boolean {
        return this.accepted;
    }
}

describe('buildkite-graph', () => {
    describe('Steps', () => {
        describe('Command', () => {
            createTest('step addition', () => [
                new Pipeline('whatever').add(
                    new MyConditional(
                        new CommandStep('yarn').add('yarn test'),
                        true,
                    ),
                ),
                new Pipeline('whatever').add(
                    new MyConditional(
                        new CommandStep('yarn').add('yarn test'),
                        false,
                    ),
                ),
            ]);
        });
    });
    describe('Pipelines', () => {
        createTest('can be conditional', () => [
            new Pipeline('a')
                .add(new CommandStep('a'))
                .add(new CommandStep('b'))
                .add(
                    new MyConditional(
                        new Pipeline('a')
                            .add(new CommandStep('c'))
                            .add(new CommandStep('d')),
                        true,
                    ),
                ),
            new Pipeline('a')
                .add(new CommandStep('a'))
                .add(new CommandStep('b'))
                .add(
                    new MyConditional(
                        new Pipeline('a')
                            .add(new CommandStep('c'))
                            .add(new CommandStep('d')),
                        false,
                    ),
                ),
        ]);
    });
});
