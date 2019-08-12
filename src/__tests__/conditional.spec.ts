import { CommandStep, Conditional, Pipeline, Step, GeneratorFn } from '../';
import { createTest } from './helpers';

class MyConditional<T extends Pipeline | Step> extends Conditional<T> {
    constructor(step: T | GeneratorFn<T>, private readonly accepted: boolean) {
        super(step as any);
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
                        () => new CommandStep('yarn').add('yarn test'),
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
