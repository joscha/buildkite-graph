import { Pipeline } from '../';
import { Conditional } from '../conditional';
import { DefaultStep } from '../base';
import { Step } from '../steps/command';
import { createTest } from './helpers';

class MyConditional<T extends DefaultStep | Pipeline> extends Conditional<T> {
    constructor(step: T, private readonly accepted: boolean) {
        super(step);
    }

    accept() {
        return this.accepted;
    }
}

describe('buildkite-graph', () => {
    describe('Steps', () => {
        describe('Command', () => {
            createTest('step addition', () => [
                new Pipeline('whatever').add(
                    new MyConditional(new Step('yarn').add('yarn test'), true),
                ),
                new Pipeline('whatever').add(
                    new MyConditional(new Step('yarn').add('yarn test'), false),
                ),
            ]);
        });
    });
    describe('Pipelines', () => {
        createTest('can be conditional', () => [
            new Pipeline('a')
                .add(new Step('a'))
                .add(new Step('b'))
                .add(
                    new MyConditional(
                        new Pipeline('a').add(new Step('c')).add(new Step('d')),
                        true,
                    ),
                ),
            new Pipeline('a')
                .add(new Step('a'))
                .add(new Step('b'))
                .add(
                    new MyConditional(
                        new Pipeline('a').add(new Step('c')).add(new Step('d')),
                        false,
                    ),
                ),
        ]);
    });
});
