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

  accept(): ReturnType<Conditional<T>['accept']> {
    return this.accepted;
  }
}

describe('buildkite-graph', () => {
  describe('Steps', () => {
    describe('Command', () => {
      createTest('step addition', () => [
        new Pipeline('whatever').add(
          new MyConditional(new CommandStep('yarn').add('yarn test'), true),
        ),
        new Pipeline('whatever').add(
          new MyConditional(
            () => new CommandStep('yarn').add('yarn test'),
            true,
          ),
        ),
        new Pipeline('whatever').add(
          new MyConditional(new CommandStep('yarn').add('yarn test'), false),
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

      createTest('async step creation', () => [
        new Pipeline('whatever').add(
          new MyConditional(
            Promise.resolve(new CommandStep('yarn').add('yarn test')),
            true,
          ),
        ),
        new Pipeline('whatever').add(
          new MyConditional(
            () => Promise.resolve(new CommandStep('yarn').add('yarn test')),
            true,
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
            const a = new MyConditional(new CommandStep('a'), false);
            p.add(new CommandStep('b').dependsOn(a));
            p.add(new CommandStep('c').dependsOn(a));

            return p;
          });
          it('but not in the pipeline', () => {
            expect(() => {
              const a = new MyConditional(new CommandStep('a'), false);
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

      describe.only('isEffectOf', () => {
        createTest(
          'will add steps if their effect dependency is accepted',
          () => {
            const acceptedTests = new MyConditional(
              new CommandStep('run tests'),
              true,
            );
            const deployCoverage = new CommandStep(
              'deploy coverage',
            ).isEffectOf(acceptedTests);

            return new Pipeline('x').add(acceptedTests, deployCoverage);
          },
          ['structure'],
        );

        createTest(
          'will not add steps if effect dependency is rejected',
          () => {
            const acceptedTests = new MyConditional(
              new CommandStep('run tests'),
              false,
            );
            const deployCoverage = new CommandStep(
              'deploy coverage',
            ).isEffectOf(acceptedTests);

            return new Pipeline('x').add(acceptedTests, deployCoverage);
          },
          ['structure'],
        );

        createTest(
          'will add steps if acceptAllConditions is set even if effect dependency is rejected',
          () => {
            const acceptedTests = new MyConditional(
              new CommandStep('run tests'),
              false,
            );
            const deployCoverage = new CommandStep(
              'deploy coverage',
            ).isEffectOf(acceptedTests);

            return new Pipeline('x').add(acceptedTests, deployCoverage);
          },
          ['json_depends_on_accept_all', 'yaml_depends_on_accept_all'],
        );

        createTest(
          'will not add steps if any effect dependency is rejected',
          () => {
            const acceptedTests = new MyConditional(
              new CommandStep('run tests 1'),
              true,
            );
            const rejectedTests = new MyConditional(
              new CommandStep('run tests 2'),
              false,
            );
            const deployCoverage = new CommandStep(
              'deploy coverage',
            ).isEffectOf(rejectedTests, acceptedTests);

            return new Pipeline('x').add(
              acceptedTests,
              rejectedTests,
              deployCoverage,
            );
          },
          ['structure'],
        );

        createTest(
          'effects of effects will be added if first effect dependency is accepted',
          () => {
            const acceptedTests = new MyConditional(
              new CommandStep('run tests'),
              true,
            );
            const createCoverageStep = new CommandStep(
              'create coverage',
            ).isEffectOf(acceptedTests);
            const deployCoverage = new CommandStep(
              'deploy coverage',
            ).isEffectOf(createCoverageStep);

            return new Pipeline('x').add(
              acceptedTests,
              createCoverageStep,
              deployCoverage,
            );
          },
          ['structure'],
        );

        createTest(
          'effects of effects will not be added if first effect dependency is rejected',
          () => {
            const acceptedTests = new MyConditional(
              new CommandStep('run tests'),
              false,
            );
            const createCoverageStep = new CommandStep(
              'create coverage',
            ).isEffectOf(acceptedTests);
            const deployCoverage = new CommandStep(
              'deploy coverage',
            ).isEffectOf(createCoverageStep);

            return new Pipeline('x').add(
              acceptedTests,
              createCoverageStep,
              deployCoverage,
            );
          },
          ['structure'],
        );

        createTest(
          'last call wins',
          () => {
            const acceptedTests = new MyConditional(
              new CommandStep('run tests'),
              false,
            );
            const deployCoverage1 = new CommandStep('deploy coverage')
              .isEffectOf(acceptedTests)
              .dependsOn(acceptedTests);
            const deployCoverage2 = new CommandStep('deploy coverage')
              .dependsOn(acceptedTests)
              .isEffectOf(acceptedTests);

            return [
              new Pipeline('x').add(deployCoverage1),
              new Pipeline('x').add(deployCoverage2),
            ];
          },
          ['structure'],
        );

        createTest(
          'dependsOn is used after isEffectOf',
          () => {
            const buildConditional = new MyConditional(
              new CommandStep('build app'),
              false,
            );
            const tests = new MyConditional(
              new CommandStep('run tests'),
              false,
            );

            const deployApp = new CommandStep('deploy app')
              .isEffectOf(buildConditional)
              .dependsOn(tests);

            return new Pipeline('x').add(buildConditional, deployApp);
          },
          ['structure'],
        );

        createTest(
          'effects of steps that are becoming part of the graph are exercised',
          () => {
            const buildConditional = new MyConditional(
              new CommandStep('build app'),
              false,
            );
            const tests = new MyConditional(
              () =>
                new CommandStep('run integration tests').dependsOn(
                  buildConditional,
                ),
              true,
            );

            const deployApp = new CommandStep('deploy app').isEffectOf(
              buildConditional,
            );

            return new Pipeline('x').add(buildConditional, tests, deployApp);
          },
          ['structure'],
        );

        createTest(
          'later steps affect earlier effects',
          () => {
            const p = new Pipeline('x');
            const buildConditional = new MyConditional(
              () => new CommandStep('build app'),
              false,
            );
            p.add(buildConditional);

            const deployApp = new CommandStep('deploy app').isEffectOf(
              buildConditional,
            );
            p.add(deployApp);

            const releaseApp = new CommandStep('release app').isEffectOf(
              deployApp,
            );
            p.add(releaseApp);

            const tests = new MyConditional(
              () =>
                new Promise<Step>((resolve) =>
                  setTimeout(
                    () =>
                      resolve(
                        new CommandStep('run integration tests').dependsOn(
                          buildConditional,
                        ),
                      ),
                    100,
                  ),
                ),
              true,
            );
            p.add(tests);

            return p;
          },
          ['structure'],
        );

        createTest(
          'effects and conditionals have correct depends_on',
          () => {
            const p = new Pipeline('x');
            const buildConditional = new MyConditional(
              () => new CommandStep('build app').withKey('build'),
              false,
            );
            p.add(buildConditional);

            const deployStep = new CommandStep('deploy app')
              .withKey('deploy')
              .isEffectOf(buildConditional);
            p.add(deployStep);

            const testsUsingBuildArtifact = new CommandStep('ssr tests')
              .withKey('ssr-tests')
              .dependsOn(buildConditional);
            p.add(testsUsingBuildArtifact);
            return p;
          },
          ['yaml_depends_on'],
        );
      });
    });
  });
});
