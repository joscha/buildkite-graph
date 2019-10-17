import { Exclude, Expose, Transform } from 'class-transformer';
import ow from 'ow';
import 'reflect-metadata';
import { KeyValue, KeyValueImpl, transformKeyValueImpl } from '../key_value';
import {
    Plugin,
    Plugins,
    PluginsImpl,
    transformPlugins,
} from './command/plugins';
import { ExitStatus, exitStatusPredicate, LabeledStep } from '../base';
import { Retry, RetryImpl } from './command/retry';

function assertTimeout(timeout: number): void {
    ow(timeout, ow.number.integerOrInfinite.positive);
}

function assertSkipValue(value: SkipValue): void {
    if (typeof value === 'string') {
        ow(value, ow.string.nonEmpty);
    }
}

type SkipValue = boolean | string;
export type SkipFunction = () => SkipValue;

export class Command {
    constructor(public command: string, public timeout: number = Infinity) {
        ow(command, ow.string);
        assertTimeout(timeout);
    }

    toString(): string {
        return this.command;
    }
}

type Agents = Map<string, string>;

@Exclude()
export class CommandStep extends LabeledStep {
    @Expose({ name: 'command' })
    @Transform((value: Command[]) => {
        if (!value || value.length === 0) {
            return undefined;
        }
        return value.length === 1
            ? value[0].command
            : value.map(c => c.command);
    })
    public readonly command: Command[] = [];

    @Expose()
    @Transform(transformKeyValueImpl)
    public readonly env: KeyValue<this>;

    private _id?: string;
    @Expose({ name: 'id' })
    private get id(): string | undefined {
        return this._id;
    }

    private _parallelism?: number;

    @Expose({ name: 'parallelism' })
    private get paralellism(): number | undefined {
        return this._parallelism;
    }

    @Expose()
    private concurrency?: number;

    @Expose({ name: 'concurrency_group' })
    private concurrencyGroup?: string;

    @Expose({ name: 'artifact_paths' })
    @Transform((paths: Set<string>) => (paths.size ? paths : undefined))
    private _artifactPaths: Set<string> = new Set();

    private _agents: Agents = new Map();

    @Expose()
    @Transform((agents: Agents) => (agents.size ? agents : undefined))
    get agents(): Agents {
        return this._agents;
    }

    private _timeout?: number;

    @Expose({ name: 'timeout_in_minutes' })
    get timeout(): number | undefined {
        if (this._timeout === Infinity || this._timeout === 0) {
            return undefined;
        } else if (this._timeout) {
            return this._timeout;
        }
        if (this.command) {
            const value = this.command.reduce((acc, command) => {
                acc += command.timeout;
                return acc;
            }, 0);
            if (value === Infinity || value === 0) {
                return undefined;
            } else if (value) {
                return value;
            }
        }
    }

    @Expose({ name: 'plugins' })
    @Transform(transformPlugins)
    public readonly plugins: Plugins<this> = new PluginsImpl(this);

    @Expose({ name: 'soft_fail' })
    @Transform((value: Set<ExitStatus>) => {
        if (!value.size) {
            return undefined;
        } else if (value.has('*')) {
            return true;
        } else {
            return [...value].map(s => ({
                // eslint-disable-next-line @typescript-eslint/camelcase
                exit_status: s,
            }));
        }
    })
    private _softFail: Set<ExitStatus> = new Set();

    @Expose({ name: 'skip' })
    @Transform((value: SkipValue | SkipFunction) => {
        if (typeof value === 'function') {
            value = value();
            assertSkipValue(value);
        }
        return value || undefined;
    })
    private _skip?: SkipValue | SkipFunction;

    @Expose()
    @Transform((value: RetryImpl<any>) =>
        value.hasValue() ? value : undefined,
    )
    public readonly retry: Retry<CommandStep> = new RetryImpl(this);

    constructor(plugin: Plugin, label?: string);
    constructor(command: string, label?: string);
    constructor(command: Command, label?: string);
    constructor(commands: (string | Plugin | Command)[], label?: string);
    constructor(
        command: string | Plugin | Command | (string | Plugin | Command)[],
        label?: string,
    ) {
        super();
        this.env = new KeyValueImpl(this);
        if (label) {
            this.withLabel(label);
        }
        if (Array.isArray(command)) {
            ow(command, ow.array.minLength(1));
            for (const c of command) {
                this.add(c);
            }
        } else {
            this.add(command);
        }
    }

    add(c: string | Plugin | Command): this {
        if (c instanceof Plugin) {
            this.plugins.add(c);
        } else if (typeof c === 'string') {
            this.command.push(new Command(c));
        } else if (c instanceof Command) {
            this.command.push(c);
        }
        return this;
    }

    /**
     *
     * @param timeout for the step in seconds.
     */
    withTimeout(timeout = Infinity): this {
        assertTimeout(timeout);
        this._timeout = timeout;
        return this;
    }

    withParallelism(parallelism: number): this {
        ow(parallelism, ow.number.integer.positive);
        this._parallelism = parallelism;
        return this;
    }

    withAgent(key: string, value: string): this {
        ow(key, ow.string.nonEmpty);
        ow(value, ow.string.nonEmpty);
        this._agents.set(key, value);
        return this;
    }

    withArtifactPath(...globs: string[]): this {
        ow(globs, ow.array.ofType(ow.string.nonEmpty));
        for (const glob of globs) {
            this._artifactPaths.add(glob);
        }
        return this;
    }

    withConcurrency(concurrency: number, group: string): this {
        ow(concurrency, ow.number.integer.positive);
        this.concurrency = concurrency;
        this.concurrencyGroup = group;
        return this;
    }

    withId(identifier: string): this {
        ow(identifier, ow.string.nonEmpty);
        this._id = identifier;
        return this;
    }

    withSoftFail(fail: ExitStatus | true): this {
        if (fail !== true) {
            ow(fail, exitStatusPredicate);
        }
        this._softFail.add(fail === true ? '*' : fail);
        return this;
    }

    skip(skip: SkipValue | SkipFunction): this {
        if (typeof skip !== 'function') {
            assertSkipValue(skip);
        }

        this._skip = skip;
        return this;
    }

    toString(): string {
        return (
            this.label ||
            (this.command
                ? `<${this.command.join(' && ') || '(empty)'}>`
                : this.plugins.toString())
        );
    }
}
