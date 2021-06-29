import { CommandStep, Pipeline } from '../';
import { createTest } from './helpers';
import { createComplex, createSimple } from './samples';

describe('buildkite-graph', () => {
  describe('general serialization', () => {
    createTest('simple', createSimple);
    createTest('complex', createComplex);

    createTest('JSON serializer can stringify', () => new Pipeline('test'), [
      'json',
    ]);

    createTest('Structural serializer can stringify', () => createComplex(), [
      'structure',
    ]);
  });

  createTest('missing transitive steps get added to the graph', () => {
    const step1 = new CommandStep('yarn');
    const step2 = new CommandStep('yarn test').dependsOn(step1);
    return new Pipeline('test').add(step2);
  });

  describe('Pipeline', () => {
    it('returns a slug', () => {
      expect(new Pipeline('A: B: c_d').slug()).toEqual('a-b-c-d');
      expect(new Pipeline('Web: E2E: page').slug()).toEqual('web-e2e-page');
    });

    it('only allows adding a step once', () => {
      const step = new CommandStep('');
      expect(() => new Pipeline('test').add(step).add(step)).toThrowError();
    });

    createTest('env', () => [new Pipeline('whatever').env.set('COLOR', '1')]);

    createTest('steps', () => [
      new Pipeline('whatever').add(new CommandStep('command')),
    ]);
  });
});
