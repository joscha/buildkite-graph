import {
    CommandStep,
    Conditional,
    Pipeline,
    Step,
    ThingOrGenerator,
} from '../';
import { createTest, serializers } from './helpers';

class MyConditional<T extends Pipeline | Step> extends Conditional<T> {
    constructor(step: ThingOrGenerator<T>, private readonly accepted: boolean) {
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

            createTest('conditional dependencies', () => {
                const p = new Pipeline('x');

                const a = new MyConditional(new CommandStep('a'), false);
                p.add(new CommandStep('b').dependsOn(a));

                return p;
            });
            it('conditionals are only unwrapped once', () => {
                const p = new Pipeline('x');

                const gen = jest.fn();
                gen.mockReturnValueOnce(new CommandStep('a'));
                gen.mockImplementation(() => {
                    throw new Error('only once!');
                });
                const a = new MyConditional(gen, false);
                p.add(new CommandStep('b').dependsOn(a));

                serializers.json.serialize(p);
            });
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
