import ow from 'ow';
import { KeyValue, KeyValueImpl } from '../key_value';
import {
  Plugin,
  Plugins,
  PluginsImpl,
  transformPlugins,
} from './command/plugins';
import {
  ExitStatus,
  exitStatusPredicate,
  LabeledStep,
  mapToObject,
} from '../base';
import { Retry, RetryImpl } from './command/retry';
import type { ToJsonSerializationOptions } from '../serialization';
import { toJsonSerializationDefaultOptions } from '../serialization';

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

const transformCommandKey: unique symbol = Symbol('transformCommand');
export class Command {
  private static [transformCommandKey] = (
    value: Command[],
  ): undefined | string | string[] => {
    if (!value || value.length === 0) {
      return undefined;
    }
    return value.length === 1
      ? value[0].serialize()
      : value.map((c) => c.serialize());
  };

  constructor(public command: string, public timeout: number = Infinity) {
    ow(command, ow.string);
    assertTimeout(timeout);
  }

  toString(): string {
    return this.command;
  }

  public serialize(): string {
    return this.toString();
  }
}

type Agents = Map<string, string>;

const transformSoftFail = (
  value: Set<ExitStatus>,
): undefined | boolean | { exit_status: ExitStatus }[] => {
  if (!value.size) {
    return undefined;
  } else if (value.has('*')) {
    return true;
  } else {
    return [...value].map((s) => ({
      exit_status: s,
    }));
  }
};

const transformSkipValue = (
  value: SkipValue | SkipFunction,
): SkipValue | SkipFunction | undefined => {
  if (typeof value === 'function') {
    value = value();
    assertSkipValue(value);
  }
  return value || undefined;
};

type ConcurrencyMethod = 'eager' | 'ordered';

type CommandProperty =
  | 'command'
  | 'priority'
  | 'parallelism'
  | 'concurrency'
  | 'concurrency_group'
  | 'concurrency_method'
  | 'artifact_paths'
  | 'agents'
  | 'timeout_in_minutes'
  | 'soft_fail'
  | 'plugins'
  | 'skip'
  | 'retry'
  | 'env';
export class CommandStep extends LabeledStep {
  public readonly command: Command[] = [];
  public readonly env: KeyValue<this>;
  public readonly overrides: Map<string, string> = new Map();

  private _parallelism?: number;
  private get parallelism(): number | undefined {
    return this._parallelism === 1 ? undefined : this._parallelism;
  }

  private concurrency?: number;
  private concurrencyGroup?: string;
  private _concurrencyMethod?: ConcurrencyMethod;
  private get concurrencyMethod(): ConcurrencyMethod | undefined {
    return this._concurrencyMethod !== 'ordered'
      ? this._concurrencyMethod
      : undefined;
  }
  private _artifactPaths: Set<string> = new Set();
  private _agents: Agents = new Map();
  get agents(): Agents {
    return this._agents;
  }
  private _timeout?: number;
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
  private _priority?: number;
  get priority(): number | undefined {
    if (this._priority === 0) {
      return undefined;
    }
    return this._priority;
  }

  public readonly plugins: Plugins<this> = new PluginsImpl(this);
  private _softFail: Set<ExitStatus> = new Set();
  private _skip?: SkipValue | SkipFunction;
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

  /**
   * See: https://github.com/buildkite/docs/pull/1087
   *
   * @param priority the relative priority of this command step; defaults to 0
   */
  withPriority(priority = 0): this {
    ow(priority, ow.number.integer);
    this._priority = priority;
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

  withConcurrencyMethod(method: ConcurrencyMethod): this {
    ow(method, ow.string.oneOf(['eager', 'ordered']));
    this._concurrencyMethod = method;
    return this;
  }

  withSoftFail(fail: ExitStatus | true): this {
    if (fail !== true) {
      ow(fail, exitStatusPredicate);
    }
    this._softFail.add(fail === true ? '*' : fail);
    return this;
  }

  /**
   * Allows to override the value of a property of the command.
   * The override needs to follow the syntax for a Buildkite-supported
   * environment variable (supporting fallbacks, etc.).
   *
   * E.g. `withParameterOverride('priority', '${CUSTOM_PRIORITY}')` would
   * then yield `priority: ${CUSTOM_PRIORITY}` in the resulting serialization.
   * The value is used verbatim.
   */
  withParameterOverride(key: CommandProperty, value: string): this {
    ow(key, ow.string.nonEmpty);
    ow(value, ow.string.nonEmpty.startsWith('$'));
    this.overrides.set(key, value);
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
      (this.label ||
        (this.command
          ? `<${this.command.join(' && ') || '(empty)'}>`
          : this.plugins.toString())) +
      (this.parallelism ? ` [x ${this.parallelism}]` : '')
    );
  }

  private valueWithOverride<T>(value: T, key: CommandProperty): string | T {
    if (this.overrides.has(key)) {
      return this.overrides.get(key) as string;
    }
    return value;
  }

  async toJson(
    opts: ToJsonSerializationOptions = toJsonSerializationDefaultOptions,
  ): Promise<Record<CommandProperty, unknown>> {
    // Need to pull out one of env/retry to get around a weird Typescript v4.0 bug.
    // When both env and retry were specified inside the return object,
    // the contents of retry were being copied to env.
    const env = await (this.env as KeyValueImpl<this>).toJson();
    const retry = await (this.retry as RetryImpl<this>).toJson();
    return {
      ...(await super.toJson(opts)),
      command: this.valueWithOverride(
        Command[transformCommandKey](this.command),
        'command',
      ),
      priority: this.valueWithOverride(this.priority, 'priority'),
      env: this.valueWithOverride(env, 'env'),
      parallelism: this.valueWithOverride(this.parallelism, 'parallelism'),
      concurrency: this.valueWithOverride(this.concurrency, 'concurrency'),
      concurrency_group: this.valueWithOverride(
        this.concurrencyGroup,
        'concurrency_group',
      ),
      concurrency_method: this.valueWithOverride(
        this.concurrencyMethod,
        'concurrency_method',
      ),
      artifact_paths: this.valueWithOverride(
        this._artifactPaths.size ? Array.from(this._artifactPaths) : undefined,
        'artifact_paths',
      ),
      agents: this.valueWithOverride(
        this.agents.size ? mapToObject(this.agents) : undefined,
        'agents',
      ),
      timeout_in_minutes: this.valueWithOverride(
        this.timeout,
        'timeout_in_minutes',
      ),
      plugins: this.valueWithOverride(
        transformPlugins(this.plugins as PluginsImpl<this>),
        'plugins',
      ),
      soft_fail: this.valueWithOverride(
        transformSoftFail(this._softFail),
        'soft_fail',
      ),
      skip: this.valueWithOverride(
        this._skip ? transformSkipValue(this._skip) : undefined,
        'skip',
      ),
      retry: this.valueWithOverride(retry, 'retry'),
    };
  }
}
