import { Pipeline } from 'src';
import { Step, Command } from 'src/steps/command';

const yarnInstall = new Command('yarn', 2);

const lintStep = new Step([yarnInstall, new Command('yarn lint', 1)]);
const testStep = new Step([yarnInstall, new Command('yarn test', 5)]).dependsOn(
    lintStep,
);
const buildStep = new Step([
    yarnInstall,
    new Command('yarn build', 10),
]).dependsOn(lintStep);

new Pipeline('My pipeline').add(testStep).add(buildStep);
