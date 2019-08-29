import { Exclude, Expose, Transform } from 'class-transformer';
import ow from 'ow';
import 'reflect-metadata';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseStep {}

// see https://github.com/microsoft/TypeScript/issues/22815#issuecomment-375766197
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Step extends BaseStep {}
export abstract class Step implements BaseStep {
    @Exclude()
    public readonly dependencies: Set<Step> = new Set();

    dependsOn(step: Step): this {
        this.dependencies.add(step);
        return this;
    }

    @Exclude()
    public always = false;

    alwaysExecute(): this {
        this.always = true;
        return this;
    }
}

@Exclude()
export class BranchLimitedStep extends Step {
    @Expose({ name: 'branches' })
    @Transform((branches: Set<string>) =>
        branches.size ? [...branches].sort().join(' ') : undefined,
    )
    private _branches: Set<string> = new Set();

    withBranch(pattern: string): this {
        ow(pattern, ow.string.nonEmpty);
        this._branches.add(pattern);
        return this;
    }
}

export class LabeledStep extends BranchLimitedStep {
    private _label?: string;

    @Expose()
    protected get label(): string | undefined {
        return this._label;
    }

    withLabel(label: string): this {
        this._label = label;
        return this;
    }
}

@Exclude()
export abstract class Chainable<T> {
    constructor(protected readonly parent: T) {
        this.parent = parent;
    }
}

export type ExitStatus = number | '*';

export const exitStatusPredicate = ow.any(
    ow.string.equals('*'),
    ow.number.integer,
);
