import {
    CommandStep,
    Conditional,
    Pipeline,
    Step,
    ThingOrGenerator,
} from '../';
import { createTest, serializers } from './helpers';

class MyConditional<T extends Step> extends Conditional<T> {
    constructor(
        step: ThingOrGenerator<T>,
        private readonly accepted: ReturnType<Conditional<T>['accept']>,
    ) {
        super(step as any);
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
            createTest('async step addition', () => [
                new Pipeline('whatever').add(
                    new MyConditional(
                        new CommandStep('yarn').add('yarn test'),
                        Promise.resolve(true),
                    ),
                ),
                new Pipeline('whatever').add(
                    new MyConditional(
                        new CommandStep('yarn').add('yarn test'),
                        Promise.resolve(false),
                    ),
                ),
            ]);

            it('throws on accept rejection', async () => {
                expect(
                    serializers.json.serialize(
                        new Pipeline('whatever').add(
                            new MyConditional(
                                new CommandStep('yarn').add('yarn test'),
                                Promise.reject(new Error('O noes!!!')),
                            ),
                        ),
                    ),
                ).rejects.toThrowError();
            });

            describe('Conditional dependencies', () => {
                createTest('can be specified', () => {
                    const p = new Pipeline('x');

                    // even though the onditional is set to false,
                    // "a" will be added to the graph as "b" depends on it
                    const a = new MyConditional(new CommandStep('a'), false);
                    p.add(new CommandStep('b').dependsOn(a));

                    return p;
                });

                describe('can be specified multiple times', () => {
                    createTest('as dependency', () => {
                        const p = new Pipeline('x');

                        // even though the onditional is set to false,
                        // "a" will be added to the graph as "b" depends on it
                        const a = new MyConditional(
                            new CommandStep('a'),
                            false,
                        );
                        p.add(new CommandStep('b').dependsOn(a));
                        p.add(new CommandStep('c').dependsOn(a));

                        return p;
                    });
                    it('but not in the pipeline', () => {
                        expect(() => {
                            const a = new MyConditional(
                                new CommandStep('a'),
                                false,
                            );
                            new Pipeline('x').add(a, a);
                        }).toThrow();
                    });
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
    });
});
