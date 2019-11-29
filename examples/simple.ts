import { Command, CommandStep, Pipeline } from '../src';
import { YamlSerializer } from '../src/serializers/yaml';

async function main() {
    const install = new Command('yarn', 2);

    const lint = new CommandStep([
        install,
        new Command('yarn lint', 1),
    ]).withKey('lint');
    const test = new CommandStep([install, new Command('yarn test', 2)])
        .withKey('test')
        .dependsOn(lint);
    const build = new CommandStep([install, new Command('yarn build', 5)])
        .withKey('build')
        .dependsOn(lint);
    const integration = new CommandStep([
        install,
        new Command('yarn integration', 10),
    ])
        .withKey('integration-test')
        .dependsOn(build);

    const pipeline = new Pipeline('My pipeline').add(test).add(integration);

    console.log(await new YamlSerializer().serialize(pipeline));
    // console.log(await new YamlSerializer({ explicitDependencies: true }).serialize(pipeline));
    // console.log(await new DotSerializer().serialize(pipeline));
}

main();
