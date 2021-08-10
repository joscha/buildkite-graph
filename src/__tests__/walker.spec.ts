import { Command, CommandStep } from '../../src/steps/command';
import { Pipeline } from '../../src/index';
import { walk } from '../../src/walker';

describe('buildkite-graph', () => {
  describe('Walker', () => {
    describe('mutate', () => {
      let mutate: any;
      let pipeline: Pipeline;
      beforeEach(() => {
        pipeline = new Pipeline('unmutated pipeline');
      });
      describe('pipeline', () => {
        beforeAll(() => {
          mutate = (entity: any): any => {
            if (entity instanceof Pipeline) {
              return new Pipeline('mutated pipeline');
            }
          };
        });

        it('should mutate pipeline', async () => {
          const p = await walk(pipeline, mutate);
          expect(p.name).toEqual('mutated pipeline');
        });
      });

      describe('step', () => {
        beforeAll(() => {
          mutate = (entity: any): any => {
            if (entity instanceof CommandStep) {
              return new CommandStep([new Command('mutated')]).withKey(
                'mutated',
              );
            }
            return entity;
          };
        });
        beforeEach(() => {
          pipeline.add(
            new CommandStep([new Command('unmutated')]).withKey('unmutated'),
          );
        });
        it('should mutate step', async () => {
          const p = await walk(pipeline, mutate);
          const received = p.steps[0] as CommandStep;
          expect(received.key).toEqual('mutated');
        });
        it('should not mutate pipeline', async () => {
          const p = await walk(pipeline, mutate);
          expect(p.name).toEqual('unmutated pipeline');
        });
      });
      describe('command', () => {
        beforeAll(() => {
          mutate = (entity: any): any => {
            if (entity instanceof Command) {
              return new Command('mutated');
            }
            return entity;
          };
        });
        beforeEach(() => {
          pipeline.add(
            new CommandStep([new Command('unmutated')]).withKey('unmutated'),
          );
        });
        it('should mutate command', async () => {
          const p = await walk(pipeline, mutate);
          const step = p.steps[0] as CommandStep;
          expect(step.command[0].command).toEqual('mutated');
        });
      });
    });
  });
});
