import { Command, CommandStep } from '../../src/steps/command';
import { Pipeline, Step } from '../../src/index';
import { JsonSerializer } from '../../src/serializers/json';

describe('buildkite-graph', () => {
  describe('Mutator', () => {
    let pipeline: Pipeline;
    describe('step', () => {
      beforeEach(() => {
        pipeline = new Pipeline('mutator');
        pipeline.add(
          new CommandStep([new Command('unmutated')]).withKey('unmutated'),
        );
      });
      it('should mutate step', async () => {
        const received = await new JsonSerializer({
          explicitDependencies: true,
        }).serialize(pipeline, async (entity: Step) => {
          if (entity instanceof CommandStep) {
            entity.command[0] = new Command('mutated');
          }
        });
        expect(received).toEqual({
          steps: [{ key: 'unmutated', command: 'mutated' }],
        });
      });
      it('should fail on dependency change', async () => {
        await expect(
          new JsonSerializer({
            explicitDependencies: true,
          }).serialize(pipeline, async (entity: Step) => {
            const dep = new CommandStep([new Command('unmutated')]).withKey(
              'unmutated',
            );
            entity.dependsOn(dep);
          }),
        ).rejects.toThrow('mutator cannot mutate dependencies');
      });
    });
  });
});
