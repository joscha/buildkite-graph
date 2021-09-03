import { Command, CommandStep, ExitStatus, Pipeline, Plugin } from '../';
import { createTest } from './helpers';

describe('buildkite-graph', () => {
  describe('Steps', () => {
    describe('dependencies', () => {
      createTest('step dependency', () => [
        new Pipeline('whatever').add(
          new CommandStep('b').dependsOn(new CommandStep('a')),
        ),
        new Pipeline('whatever').add(
          new CommandStep('d').dependsOn(
            new CommandStep('a'),
            new CommandStep('b'),
            new CommandStep('c'),
          ),
        ),
      ]);
      it('can not depend on itself', () => {
        const c = new CommandStep('c');
        expect(() => c.dependsOn(c)).toThrowError();
      });
    });

    describe('Command', () => {
      createTest('step addition', () => [
        new Pipeline('whatever').add(new CommandStep('yarn').add('yarn test')),
        new Pipeline('x').add(new CommandStep('')),
      ]);

      describe('continue on failure', () => {
        createTest(
          'multiple subsequent always-executed subsequent steps do not get an additional wait step',
          () => {
            const command = new CommandStep('command.sh');
            const always = new CommandStep(
              'echo This runs regardless of the success or failure',
            )
              .alwaysExecute()
              .dependsOn(command);
            const always2 = new CommandStep(
              'echo This runs regardless of the success or failure 2',
            )
              .alwaysExecute()
              .dependsOn(command);
            const always3 = new CommandStep(
              'echo This runs regardless of the success or failure 3',
            )
              .alwaysExecute()
              .dependsOn(command);

            return new Pipeline('test')
              .add(command)
              .add(always)
              .add(always2)
              .add(always3);
          },
        );

        createTest(
          'subsequent depending steps that are not always executed get an additional wait step',
          () => {
            const command = new CommandStep('command.sh');
            const always = new CommandStep(
              'echo This runs regardless of the success or failure',
            )
              .alwaysExecute()
              .dependsOn(command);
            const passed = new CommandStep('echo The command passed').dependsOn(
              command,
            );

            return new Pipeline('test').add(command).add(always).add(passed);
          },
        );
      });

      createTest('dependency failures', () => {
        const a = new CommandStep('a.sh');
        const b = new CommandStep('b.sh').dependsOn(a).allowDependencyFailure();
        const c = new CommandStep('c.sh').dependsOn(a).alwaysExecute();
        const d = new CommandStep('c.sh')
          .dependsOn(a)
          .alwaysExecute()
          .allowDependencyFailure();
        return new Pipeline('test').add(a).add(b).add(c).add(d);
      });

      describe('timeouts', () => {
        createTest('commands with timeouts set step timeout total', () => {
          const command1 = new Command('yarn install', 10);
          const command2 = new Command('yarn test', 10);
          return new Pipeline('test').add(
            new CommandStep([command1, command2]),
          );
        });

        createTest('step timeout total trumps commands', () => {
          const command1 = new Command('yarn install', 10);
          const command2 = new Command('yarn test', 10);
          return new Pipeline('test').add(
            new CommandStep([command1, command2])
              .withTimeout(100)
              .withTimeout(2),
          );
        });

        createTest('one infinite timeout will cancel out the others', () => {
          const command1 = new Command('yarn install', 10);
          const command2 = new Command('yarn test');
          return new Pipeline('test').add(
            new CommandStep([command1, command2]),
          );
        });

        createTest('can be infinite', () => {
          return new Pipeline('test').add(
            new CommandStep('noop').withTimeout(),
          );
        });
      });

      createTest('agents', () =>
        new Pipeline('whatever').add(
          new CommandStep('noop').withAgent('npm', 'true'),
        ),
      );

      createTest('artifact_paths', () => [
        new Pipeline('whatever').add(
          new CommandStep('noop')
            .withArtifactPath('logs/**/*')
            .withArtifactPath('coverage/**/*'),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').withArtifactPath(
            'logs/**/*',
            'coverage/**/*',
          ),
        ),
      ]);

      createTest('branches', () =>
        new Pipeline('whatever').add(
          new CommandStep('noop')
            .withBranch('master')
            .withBranch('stable/*')
            .withBranch('!release/*'),
        ),
      );

      createTest('concurrency', () => [
        new Pipeline('whatever').add(
          new CommandStep('noop')
            .withConcurrency(10, 'will/be/overridden')
            .withConcurrency(3, 'my-app/deploy'),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop')
            .withConcurrencyMethod('eager')
            .withConcurrency(3, 'my-app/deploy'),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop')
            .withConcurrencyMethod('ordered')
            .withConcurrency(3, 'my-app/deploy'),
        ),
      ]);

      createTest('env', () =>
        new Pipeline('whatever').add(
          new CommandStep('noop').env
            .set('RAILS_ENV', 'test')
            .env.set('DEBUG', 'true'),
        ),
      );

      createTest('key', () =>
        new Pipeline('whatever').add(
          new CommandStep('noop')
            .withKey('my-key-overridden')
            .withKey('my-key'),
        ),
      );

      createTest('label', () =>
        new Pipeline('whatever').add(
          new CommandStep('noop')
            .withLabel('my label overridden')
            .withLabel('my label'),
        ),
      );

      createTest('parallelism', () => [
        new Pipeline('whatever').add(
          new CommandStep('noop').withParallelism(100).withParallelism(123),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').withParallelism(1),
        ),
      ]);

      describe('plugins', () => {
        let plugins: Plugin[];
        let stepWithPlugins: CommandStep;

        beforeEach(() => {
          plugins = [
            new Plugin('bugcrowd/test-summary#v1.5.0', {
              inputs: [
                {
                  label: ':htmllint: HTML lint',
                  artifact_path: 'web/target/htmllint-*.txt',
                  type: 'oneline',
                },
              ],
            }),
            new Plugin('detect-clowns#v1.0.0'),
          ];
          stepWithPlugins = new CommandStep('noop').plugins
            .add(plugins[0])
            .plugins.add(plugins[1]);
        });

        createTest('add plugins', () =>
          new Pipeline('whatever').add(stepWithPlugins),
        );

        it('is possible to query existing plugins', () => {
          expect(stepWithPlugins.plugins.filter(() => true)).toMatchObject(
            plugins,
          );
        });
      });

      describe('soft_fail', () => {
        createTest('boolean', () => [
          new Pipeline('whatever').add(
            new CommandStep('noop').withSoftFail('*'),
          ),
          new Pipeline('whatever').add(
            new CommandStep('noop').withSoftFail(true),
          ),
        ]);

        createTest('multiple', () =>
          new Pipeline('whatever').add(
            new CommandStep('noop').withSoftFail(1).withSoftFail(-127),
          ),
        );

        createTest('star', () =>
          new Pipeline('whatever').add(
            new CommandStep('noop').withSoftFail(1).withSoftFail('*'),
          ),
        );
      });

      describe('priority', () => {
        createTest('default', () => [
          new Pipeline('whatever').add(
            new CommandStep('noopImportant').withPriority(100),
            new CommandStep('noop').withPriority(0),
            new CommandStep('noopUnimportant').withPriority(-100),
          ),
        ]);

        it('throws if not an integer', () => {
          expect(() =>
            new CommandStep('noop').withPriority(Infinity),
          ).toThrow();
          expect(() => new CommandStep('noop').withPriority(1.234)).toThrow();
        });
      });

      describe('skip', () => {
        createTest('value', () => [
          new Pipeline('whatever').add(new CommandStep('noop').skip(false)),
          new Pipeline('whatever').add(
            new CommandStep('noop').skip(false).skip(true),
          ),
          new Pipeline('whatever').add(
            new CommandStep('noop').skip('my reason'),
          ),
        ]);

        createTest('function', () => [
          new Pipeline('whatever').add(
            new CommandStep('noop').skip(() => false),
          ),
          new Pipeline('whatever').add(
            new CommandStep('noop').skip(() => true),
          ),
          new Pipeline('whatever').add(
            new CommandStep('noop').skip(() => 'my reason'),
          ),
        ]);
      });

      createTest('retry', () => [
        new Pipeline('whatever').add(
          new CommandStep('noop').retry.automatic(true),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').retry.automatic(
            new Map<ExitStatus, number>([
              ['*', 2],
              [255, 2],
            ]),
          ),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').retry.manual(false),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').retry.manual(
            false,
            false,
            "Sorry, you can't retry a deployment",
          ),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').retry.manual(
            true,
            false,
            "Sorry, you can't retry a deployment",
          ),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').retry.manual(true, true),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').retry
            .automatic(true)
            .retry.manual(true, true),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').retry.automatic(2),
        ),
        new Pipeline('whatever').add(
          new CommandStep('noop').retry.automatic(
            new Map<ExitStatus, number>([['*', 1]]),
          ),
        ),
      ]);

      describe('retry', () => {
        it('is possible to read automatic retries', () => {
          expect(
            new CommandStep('noop').retry
              .automatic(true)
              .retry.getAutomaticValue(),
          ).toEqual(new Map([['*', 2]]));
          expect(
            new CommandStep('noop').retry
              .automatic(5)
              .retry.getAutomaticValue(),
          ).toEqual(new Map([['*', 5]]));
          expect(
            new CommandStep('noop').retry
              .automatic(new Map([[-1, 3]]))
              .retry.getAutomaticValue(),
          ).toEqual(new Map([[-1, 3]]));
        });
      });

      describe('edge cases', () => {
        it('throws if key is empty', () => {
          expect(() => new CommandStep('noop').withKey('')).toThrow();
        });

        it('throws if key is longer than 100 chars', () => {
          expect(() =>
            new CommandStep('noop').withKey('a'.repeat(101)),
          ).toThrow();
        });
      });

      describe('withParameterOverride', () => {
        it('produces an override for a given key', async () => {
          await expect(
            new CommandStep('noop')
              .withParameterOverride('priority', 'MY_PRIORITY')
              .toJson(),
          ).resolves.toEqual(
            expect.objectContaining({ priority: '$MY_PRIORITY' }),
          );
        });
        it('supports double escape', async () => {
          await expect(
            new CommandStep('noop')
              .withParameterOverride('priority', '$MY_PRIORITY')
              .toJson(),
          ).resolves.toEqual(
            expect.objectContaining({ priority: '$$MY_PRIORITY' }),
          );
        });
      });
    });
  });
});
