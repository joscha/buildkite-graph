import { PotentialStep, Pipeline, Conditional, Command, CommandStep } from '.';
import { getAndCacheDependency } from './conditional';
import { cloneDeep } from 'lodash';
export type Entity = Pipeline | PotentialStep | Command;

export type MutatorFn = <T extends Entity>(entity: T) => Promise<T>;

async function walkEntity<T extends Entity>(
  entity: T,
  mutator?: MutatorFn,
  nodeCache: Map<any, any> = new Map<any, any>(),
): Promise<T> {
  if (!mutator) {
    return entity;
  }

  if (nodeCache.has(entity)) {
    return nodeCache.get(entity);
  }

  const conditionalCache = new Map();

  if (entity instanceof Conditional) {
    if (await entity.accept()) {
      entity = <any>await getAndCacheDependency(conditionalCache, entity);
    } else {
      return entity;
    }
  }

  if (entity instanceof Pipeline) {
    const newSteps = [];

    for (const step of entity.steps) {
      let newStep = cloneDeep(step);
      newStep = await walkEntity(newStep, mutator, nodeCache);
      newSteps.push(newStep);
    }
    entity.steps = newSteps;
  } else if (entity instanceof CommandStep) {
    const newDeps: Set<PotentialStep> = new Set();
    for (const dep of entity.dependencies) {
      const newDep = await walkEntity(dep, mutator, nodeCache);
      newDeps.add(newDep);
    }
    entity.dependencies = newDeps;

    const newCommands: Command[] = [];
    for (const command of entity.command) {
      let newCommand = cloneDeep(command);
      newCommand = await walkEntity(newCommand, mutator, nodeCache);
      newCommands.push(newCommand);
    }
    entity.command = newCommands;
  }

  let newEntity = cloneDeep(entity);
  newEntity = await mutator(newEntity);
  nodeCache.set(entity, newEntity);
  entity = newEntity;

  return newEntity;
}

export async function walk(p: Pipeline, mutator: MutatorFn): Promise<Pipeline> {
  return walkEntity(p, mutator);
}
