import { Pipeline } from '../src';
import { Step, Command } from '../src/steps/command';
import { YamlSerializer } from '../src/serializers/yaml';
import { DotSerializer } from '../src/serializers/dot';

const yarnInstall = new Command('yarn', 2);

const lintStep = new Step([yarnInstall, new Command('yarn lint', 1)]);
const testStep = new Step([yarnInstall, new Command('yarn test', 5)]).dependsOn(
    lintStep,
);
const buildStep = new Step([
    yarnInstall,
    new Command('yarn build', 10),
]).dependsOn(lintStep);

const pipeline = new Pipeline('My pipeline').add(testStep).add(buildStep);

console.log(new YamlSerializer().serialize(pipeline));
// console.log(new DotSerializer().serialize(pipeline));
