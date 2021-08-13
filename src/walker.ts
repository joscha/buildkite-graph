import {
  PotentialStep,
  Pipeline,
  Conditional,
  Command,
  CommandStep,
  Step,
} from '.';
import { getAndCacheDependency } from './conditional';
import { cloneDeep } from 'lodash';

export interface Mutators {
  pipelineFn?: (pipeline: Pipeline) => Pipeline;
  stepFn?: (step: Step) => Step;
  commandFn?: (command: Command) => Command;
}

export async function evaluatePipeline(p: Pipeline): Promise<Pipeline> {
  const conditionalCache = new Map<any, any>();
  const pipeline = new Pipeline(p.name);
  pipeline.steps = [];
  for (const step of p.steps) {
    let newStep: PotentialStep | null = cloneDeep(step);
    newStep = await evaluateStep(newStep, conditionalCache);
    if (newStep) {
      pipeline.steps.push(newStep);
    }
  }
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
    let newPipeline = cloneDeep(p);
    for (const step of newPipeline.steps) {
      let newStep = cloneDeep(step);
      const result = await walkStep(newStep);
      if (result) {
        newStep = result;
        newSteps.push(newStep);
      }
    }
    newPipeline.steps = newSteps;
    if (mutator.pipelineFn) {
      newPipeline = mutator.pipelineFn(newPipeline);
    }
    return newPipeline;
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
    let newStep = cloneDeep(step);
    if (newStep instanceof CommandStep) {
      const newDeps: Set<PotentialStep> = new Set();
      for (const dep of newStep.dependencies) {
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
      newStep.dependencies = newDeps;

      const newCommands: Command[] = [];
      for (const command of newStep.command) {
        let newCommand = cloneDeep(command);
        newCommand = await walkCommand(newCommand);
        newCommands.push(newCommand);
      }
      newStep.command = newCommands;
    }
    if (mutator.stepFn) {
      newStep = mutator.stepFn(newStep);
    }
    nodeCache.set(step.key, newStep);
    return newStep;
  }

  async function walkCommand(command: Command): Promise<Command> {
    const commandStr = JSON.stringify(command);
    if (nodeCache.has(commandStr)) {
      return nodeCache.get(commandStr);
    }
    let newCommand = cloneDeep(command);
    if (mutator.commandFn) {
      newCommand = mutator.commandFn(newCommand);
    }
    nodeCache.set(commandStr, newCommand);
    return newCommand;
  }

  return walkPipeline(p);
}
