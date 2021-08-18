import {
  Command,
  CommandStep,
  Pipeline,
  Step,
  Conditional,
  walk,
  evaluatePipeline,
} from '../src';
import { YamlSerializer } from '../src/serializers/yaml';
import { JsonSerializer } from '../src/serializers/json';

class TimeoutCommand extends Command {
  constructor(private retries: number, command: Command) {
    super(command.toString(), command.timeout * (retries + 1));
  }

  public serialize(): string {
    return `./timeout ${this.timeout} ${this.command}`;
  }

  public toString(): string {
    return `${this.command} [retry = ${this.retries}]`;
  }
}

class TestConditional<T extends Step> extends Conditional<T> {
  accept() {
    return true;
  }
}

const install = new Command('yarn', 10);

const lint = new CommandStep([install, new Command('yarn lint', 5)]).withKey(
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

function commandFn(entity: Command): Command {
  if (entity.timeout !== 0 && entity.timeout !== Infinity) {
    return new TimeoutCommand(1, entity);
  }

  return entity;
}
new JsonSerializer({ explicitDependencies: true })
  .serialize(pipeline)
  .then((p) => {
    console.log(p);
    return evaluatePipeline(pipeline);
  })
  .then((p) => walk(p, { commandFn: commandFn }))
  .then((p) => new JsonSerializer({ explicitDependencies: true }).serialize(p))
  .then(console.log);

// evaluatePipeline(pipeline).then((p) =>
//   walk(p, { commandFn: commandFn }).then((p) => {
//     new JsonSerializer({ explicitDependencies: true })
//       .serialize(p)
//       .then(console.log);
//   }),
// );
