import { execSync } from 'child_process';
import { EOL } from 'os';
import { extname } from 'path';
import { Command, CommandStep, Conditional, Pipeline, Step } from '../src';
import { YamlSerializer } from '../src/serializers/yaml';

/**
 * This Conditional will accept when there is at least one changed file ending in .feature
 */
class FeatureFileChangedConditional<T extends Pipeline | Step>
    implements Conditional<T> {
    constructor(private readonly step: T) {}

    get() {
        return this.step;
    }

    accept() {
        const changedFiles = execSync(
            'git --no-pager diff master --name-only --no-renames',
            { encoding: 'utf8' },
        ).split(EOL);
        for (const changedFile of changedFiles) {
            if (extname(changedFile) === '.feature') {
                return true;
            }
        }
        return false;
    }
}

const install = new Command('yarn', 2);

const lint = new CommandStep([install, new Command('yarn lint', 1)]);

const test = new CommandStep([install, new Command('yarn test', 2)]).dependsOn(
    lint,
);
const build = new CommandStep([install, new Command('yarn build', 5)]);

const integration = new CommandStep([
    install,
    new Command('yarn integration', 10),
]).dependsOn(build);

const pipeline = new Pipeline('My pipeline')
    .add(test)
    .add(new FeatureFileChangedConditional(integration));

console.log(new YamlSerializer().serialize(pipeline));

// Will print:

// steps:
//   - command:
//       - yarn
//       - yarn lint
//     timeout_in_minutes: 3
//   - wait: ~
//   - command:
//       - yarn
//       - yarn test
//     timeout_in_minutes: 4

// You can see the integration test step was omitted because we don't actually have any changed .feature files against master.
// Touch the feature file in this directory to see the output including the integration tests!
