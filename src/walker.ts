import { PotentialStep, Pipeline, Conditional, Command, CommandStep } from '.';
import { getAndCacheDependency } from './conditional';

export type Entity = Pipeline | PotentialStep | Command;

async function walkEntity<T extends Entity>(
  entity: T,
  nodeCache: Map<any, any>,
  mutator?: (entity: Entity) => any,
): Promise<T> {
  if (nodeCache.has(entity)) {
    return nodeCache.get(entity);
  }

  const cache = new Map();

  if (entity instanceof Conditional) {
    if (await entity.accept()) {
      entity = <any>await getAndCacheDependency(cache, entity);
    } else {
      return entity;
    }
  }

  if (entity instanceof Pipeline) {
    const steps = entity.steps;
    steps.forEach(async (step, idx) => {
      const newStep = await walkEntity(step, nodeCache, mutator);
      steps[idx] = newStep;
    });
  } else if (entity instanceof CommandStep) {
    const deps = entity.dependencies;
    deps.forEach(async (dep) => {
      const newDep = await walkEntity(dep, nodeCache, mutator);
      if (deps.has(dep)) {
        deps.delete(dep);
        deps.add(newDep);
      }
    });

    const commands = entity.command;
    commands.forEach(async (command, idx) => {
      commands[idx] = await walkEntity(command, nodeCache, mutator);
    });
  }

  if (mutator) {
    const newEntity = mutator(entity);
    nodeCache.set(entity, newEntity);
    entity = newEntity;
  }

  return entity;
}

export async function walk(
  p: Pipeline,
  mutator: (entity: Entity) => Entity,
): Promise<Pipeline> {
  const nodeCache = new Map();
  return walkEntity(p, nodeCache, mutator);
}
