import { CommandStep, Conditional, Generator, Pipeline, Step } from '../';
import { createTest } from './helpers';

export type ThingOrGenerator<T> = T | Generator<T>;

class MyConditional<T extends Pipeline | Step> implements Conditional<T> {
    private readonly step?: T;
    constructor(step: ThingOrGenerator<T>, private readonly accepted: boolean) {
        if (typeof step === 'function') {
            this.get = step;
        } else {
            this.step = step;
        }
    }

    get(): T {
        return this.step!;
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
