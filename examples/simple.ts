import { Pipeline } from '../src';
import { Step, Command } from '../src/steps/command';
import { YamlSerializer } from '../src/serializers/yaml';
import { DotSerializer } from '../src/serializers/dot';

const install = new Command('yarn', 2);

const lint = new Step([install, new Command('yarn lint', 1)]);
const test = new Step([install, new Command('yarn test', 2)]).dependsOn(lint);
const build = new Step([install, new Command('yarn build', 5)]).dependsOn(lint);
const integration = new Step([
    install,
    new Command('yarn integration', 10),
]).dependsOn(build);

const pipeline = new Pipeline('My pipeline').add(test).add(integration);

console.log(new YamlSerializer().serialize(pipeline));
// console.log(new DotSerializer().serialize(pipeline));
