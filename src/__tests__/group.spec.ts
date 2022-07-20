import { CommandStep, GroupStep, Pipeline } from '../';
import { createTest } from './helpers';

describe('buildkite-graph', () => {
  describe('Steps', () => {
    describe('Group', () => {
      createTest('group step', () => [
        new Pipeline('whatever').add(new GroupStep('group')),
      ]);

      createTest('with a label', () => [
        new Pipeline('whatever').add(
          new GroupStep('another').withLabel('Trigger another pipeline'),
        ),
      ]);

      createTest('step addition', () => [
        new Pipeline('whatever').add(
          new GroupStep('group').add(new CommandStep('yarn')),
        ),
        new Pipeline('whatever').add(
          new GroupStep('group').add(
            new CommandStep('yarn'),
            new CommandStep('yarn test'),
          ),
        ),
        new Pipeline('whatever').add(
          new GroupStep('group')
            .add(new CommandStep('yarn'))
            .add(new CommandStep('yarn test')),
        ),
      ]);
    });
  });
});
