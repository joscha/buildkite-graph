import { Command, CommandStep, Pipeline, Step, Conditional } from '../src';
import { YamlSerializer } from '../src/serializers/yaml';

class TimeoutCommand extends Command {
  constructor(command: Command) {
    super(command.toString(), command.timeout);
  }

  public serialize(): string {
    return `timeout ${this.timeout} ${this.command}`;
  }

  public toString(): string {
    return `${this.command} [timeout = ${this.timeout}]`;
  }
}

class TestConditional<T extends Step> extends Conditional<T> {
  accept() {
    return true;
  }
}

const install = new Command('yarn', 10);

const lint = new CommandStep([install, new Command('yarn lint')]).withKey(
  'lint',
);

const test = new CommandStep([install, new Command('yarn test', 10)])
  .withKey('test')
  .dependsOn(lint);

const build = new CommandStep([install, new Command('yarn build', 5)]);

const integration = new CommandStep([
  install,
  new Command('yarn integration', 10),
]).dependsOn(build);

const conditional = new TestConditional(test);
const pipeline = new Pipeline('My pipeline').add(conditional).add(integration);

async function commandFn(entity: Step) {
  if (entity instanceof CommandStep) {
    for (let i = 0; i < entity.command.length; i++) {
      let command = entity.command[i];
      if (command.timeout !== 0 && command.timeout !== Infinity) {
        entity.command[i] = new TimeoutCommand(command);
      }
    }
  }
}

new YamlSerializer({ explicitDependencies: true, mutator: commandFn })
  .serialize(pipeline)
  .then(console.log);
