import { Command, CommandStep, Pipeline } from '../src';
import { YamlSerializer } from '../src/serializers/yaml';

class RetryCommand extends Command {
    constructor(private retries: number, command: Command) {
        super(command.toString(), command.timeout * (retries + 1));
    }

    protected serialize(): string {
        return new Array(this.retries + 1).fill(this.command).join(' || ');
    }

    public toString(): string {
        return `${this.command} [retry = ${this.retries}]`;
    }
}

const install = new Command('yarn');

const test = new CommandStep([
    install,
    new RetryCommand(1, new Command('yarn test-integration')),
]).withKey('test');

const pipeline = new Pipeline('My pipeline').add(test);

new YamlSerializer({ explicitDependencies: true })
    .serialize(pipeline)
    .then(console.log);
