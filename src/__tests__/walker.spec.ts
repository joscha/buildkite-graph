import { Command, CommandStep } from '../../src/steps/command';
import { Pipeline, Step } from '../../src/index';
import { evaluatePipeline, Mutators, walk } from '../../src/walker';
import { Conditional } from '../../src/conditional';
// import { createTest } from './helpers';
class TrueConditional<T extends Step> extends Conditional<T> {
  accept(): boolean {
    return true;
  }
}

class FalseConditional<T extends Step> extends Conditional<T> {
  accept(): boolean {
    return false;
  }
}

describe('buildkite-graph', () => {
  describe('evaluator', () => {
    it('should generate step from conditional', async () => {
      const pipeline = new Pipeline('unmutated pipeline');
      const step = new CommandStep([new Command('unmutated')]).withKey(
        'unmutated',
      );
      pipeline.add(new TrueConditional(step));
      const p = await evaluatePipeline(pipeline);
      expect(p.steps[0]).toEqual(step);
    });
    it('should not generate step from false conditional', async () => {
      const pipeline = new Pipeline('unmutated pipeline');
      const step = new CommandStep([new Command('unmutated')]).withKey(
        'unmutated',
      );
      pipeline.add(new FalseConditional(step));
      const p = await evaluatePipeline(pipeline);
      expect(p.steps).toEqual([]);
    });
    it('should evaluate step dependencies as well', async () => {
      const pipeline = new Pipeline('unmutated pipeline');
      const step = new CommandStep([new Command('unmutated')]).withKey(
        'unmutated',
      );
      const dep = new TrueConditional(
        new CommandStep([new Command('trueDep')]).withKey('trueDep'),
      );
      step.dependsOn(dep);
      pipeline.add(step);
      const p = await evaluatePipeline(pipeline);
      const result = p.steps[0] as CommandStep;
      result.dependencies.forEach((dep) => {
        expect(dep).toEqual(
          new CommandStep([new Command('trueDep')]).withKey('trueDep'),
        );
      });
    });
    it('should generate step from a true conditional, and not generate a false conditional', async () => {
      const pipeline = new Pipeline('unmutated pipeline');
      const trueStep = new CommandStep([new Command('unmutated')]).withKey(
        'trueStep',
      );
      const falseStep = new CommandStep([new Command('unmutated')]).withKey(
        'falseStep',
      );
      pipeline
        .add(new FalseConditional(falseStep))
        .add(new TrueConditional(trueStep));
      const p = await evaluatePipeline(pipeline);
      expect(p.steps.length).toEqual(1);
      expect(p.steps[0]).toEqual(trueStep);
    });
  });
  describe('Walker', () => {
    describe('mutate', () => {
      let pipeline: Pipeline;
      const mutators: Mutators = {};
      beforeEach(async () => {
        pipeline = await evaluatePipeline(new Pipeline('unmutated pipeline'));
        mutators.pipelineFn = async (entity: Pipeline): Promise<Pipeline> => {
          const p = new Pipeline('mutated pipeline');
          p.steps = entity.steps;
          return p;
        };
        mutators.stepFn = async (entity: Step): Promise<Step> => {
          const step = new CommandStep([new Command('mutated')]).withKey(
            'mutated',
          );
          if (entity instanceof CommandStep) {
            step.command = entity.command;
          }
          return step;
        };
        mutators.commandFn = async (entity: Command): Promise<Command> => {
          if (entity instanceof Command) {
            return new Command('mutated');
          }
          return entity;
        };
      });
      describe('pipeline', () => {
        it('should mutate pipeline', async () => {
          const p = await walk(pipeline, { pipelineFn: mutators.pipelineFn });
          expect(p.name).toEqual('mutated pipeline');
        });
      });
      describe('step', () => {
        beforeEach(() => {
          pipeline.add(
            new CommandStep([new Command('unmutated')]).withKey('unmutated'),
          );
        });
        it('should mutate step', async () => {
          const p = await walk(pipeline, { stepFn: mutators.stepFn });
          const received = p.steps[0] as CommandStep;
          expect(received.key).toEqual('mutated');
        });
        it('should throw on conditional step', async () => {
          pipeline = new Pipeline('unmutated pipeline');
          const step = new CommandStep([new Command('unmutated')]).withKey(
            'unmutated',
          );
          pipeline.add(new TrueConditional(step));
          await expect(
            walk(pipeline, { stepFn: mutators.stepFn }),
          ).rejects.toThrow(
            'encountered conditional during walk, please run evaluatePipeline',
          );
        });
        it('should throw on conditional dep', async () => {
          const pipeline = new Pipeline('unmutated pipeline');
          const step = new CommandStep([new Command('unmutated')]).withKey(
            'unmutated',
          );
          const dep = new TrueConditional(
            new CommandStep([new Command('trueDep')]).withKey('trueDep'),
          );
          step.dependsOn(dep);
          pipeline.add(step);
          await expect(
            walk(pipeline, { stepFn: mutators.stepFn }),
          ).rejects.toThrow(
            'encountered conditional during walk, please run evaluatePipeline',
          );
        });
        it('should mutate dependent steps', async () => {
          pipeline = new Pipeline('unmutated pipeline');
          const step = new CommandStep([new Command('unmutated')]).withKey(
            'unmutated',
          );
          const step2 = new CommandStep([new Command('unmutated')])
            .withKey('unmutated')
            .dependsOn(step);
          const dep = new CommandStep([new Command('unmutateddep')]).withKey(
            'unmutateddep',
          );
          step.dependsOn(dep);
          pipeline.add(step).add(step2);
          const p = await walk(pipeline, { stepFn: mutators.stepFn });
          const received = p.steps[0] as CommandStep;
          received.dependencies.forEach((dep) => {
            if (dep instanceof CommandStep) {
              expect(dep.key).toEqual('mutated');
            }
          });
          expect(received.key).toEqual('mutated');
        });
        it('should not mutate pipeline', async () => {
          const p = await walk(pipeline, { stepFn: mutators.stepFn });
          expect(p.name).toEqual('unmutated pipeline');
        });
      });
      describe('command', () => {
        beforeEach(() => {
          const step = new CommandStep([new Command('unmutated')]).withKey(
            'unmutated',
          );
          pipeline.add(step);
        });
        it('should mutate command', async () => {
          const p = await walk(pipeline, { commandFn: mutators.commandFn });
          const step = p.steps[0] as CommandStep;
          expect(step.command[0].command).toEqual('mutated');
        });
      });
      it('mutate everything', async () => {
        const command = new Command('unmutated');
        const commandDep = new Command('unmutated2');
        const step = new CommandStep([command, command]).withKey('unmutated');
        const dep = new CommandStep([commandDep, command]).withKey(
          'unmutatedDep',
        );
        step.dependsOn(dep);
        pipeline.add(step);
        const p = await walk(pipeline, {
          pipelineFn: mutators.pipelineFn,
          stepFn: mutators.stepFn,
          commandFn: mutators.commandFn,
        });
        expect(p.name).toEqual('mutated pipeline');
        const steps = p.steps[0] as CommandStep;
        steps.dependencies.forEach((dep) => {
          if (dep instanceof CommandStep) {
            expect(dep.key).toEqual('mutated');
          }
        });
        expect(steps.key).toEqual('mutated');
        steps.command.forEach((command) => {
          expect(command.command).toEqual('mutated');
        });
      });
    });
  });
});
