import {
  PotentialStep,
  Pipeline,
  Conditional,
  Command,
  CommandStep,
  Step,
} from '.';
import { cloneDeep } from 'lodash';
import { getAndCacheDependency } from './conditional';
export interface Mutators {
  pipelineFn?: (pipeline: Pipeline) => Promise<Pipeline>;
  stepFn?: (step: Step) => Promise<Step>;
  commandFn?: (command: Command) => Promise<Command>;
}

/**
 * @param p The pipeline to evaluate
 * @returns An evaluated pipeline with all conditionals generated if they were accepted
 */
export async function evaluatePipeline(pipeline: Pipeline): Promise<Pipeline> {
  const conditionalCache = new Map<any, any>();
  const newSteps = [];
  for (const step of pipeline.steps) {
    const newStep = await evaluateStep(step, conditionalCache);
    if (newStep) {
      newSteps.push(newStep);
    }
  }
  pipeline.steps = newSteps;
  return pipeline;
}

async function evaluateStep(
  step: PotentialStep,
  conditionalCache: Map<any, any>,
): Promise<Step | null> {
  if (step instanceof Conditional) {
    if (await step.accept()) {
      step = await getAndCacheDependency(conditionalCache, step);
    } else {
      return null;
    }
  }
  const deps = step.dependencies;
  const newDeps: Set<Step> = new Set();
  for (const dep of deps) {
    const newDep = await evaluateStep(dep, conditionalCache);
    if (newDep) {
      newDeps.add(newDep);
    }
  }
  step.dependencies = newDeps;
  return step;
}

export async function walk(p: Pipeline, mutator: Mutators): Promise<Pipeline> {
  const nodeCache = new Map<any, any>();

  async function walkPipeline(p: Pipeline): Promise<Pipeline> {
    const newSteps = [];
    for (const step of p.steps) {
      const result = await walkStep(step);
      if (result) {
        newSteps.push(result);
      }
    }
    p.steps = newSteps;
    if (mutator.pipelineFn) {
      p = await mutator.pipelineFn(p);
    }
    return p;
  }

  async function walkStep(step: PotentialStep): Promise<Step> {
    if (step instanceof Conditional) {
      throw new Error(
        `encountered conditional during walk, please run evaluatePipeline`,
      );
    }

    if (nodeCache.has(step.key)) {
      return nodeCache.get(step.key);
    }
    if (step instanceof CommandStep) {
      const newDeps: Set<PotentialStep> = new Set();
      for (const dep of step.dependencies) {
        if (dep instanceof Conditional) {
          throw new Error(
            `encountered conditional during walk, please run evaluatePipeline`,
          );
        }
        const newDep = await walkStep(dep);
        if (newDep) {
          newDeps.add(newDep);
        }
      }
      step.dependencies = newDeps;

      const newCommands: Command[] = [];
      for (const command of step.command) {
        let newCommand = cloneDeep(command);
        newCommand = await walkCommand(newCommand);
        newCommands.push(newCommand);
      }
      step.command = newCommands;
    }
    if (mutator.stepFn) {
      step = await mutator.stepFn(step);
    }
    nodeCache.set(step.key, step);
    return step;
  }

  async function walkCommand(command: Command): Promise<Command> {
    const commandStr = JSON.stringify(command);
    if (nodeCache.has(commandStr)) {
      return nodeCache.get(commandStr);
    }
    if (mutator.commandFn) {
      command = await mutator.commandFn(command);
    }
    nodeCache.set(commandStr, command);
    return command;
  }

  return walkPipeline(p);
}
