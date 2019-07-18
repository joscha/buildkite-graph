import { Entity } from '../';
import { Conditional } from '../conditional';
import { DefaultStep } from '../steps/base';
import { Step } from '../steps/command';
import { createTest } from './helpers';

class MyConditional<T extends DefaultStep> extends Conditional<T> {
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
                new Entity('whatever').add(
                    new MyConditional(new Step('yarn').add('yarn test'), true),
                ),
                new Entity('whatever').add(
                    new MyConditional(new Step('yarn').add('yarn test'), false),
                ),
            ]);
        });
    });
});
