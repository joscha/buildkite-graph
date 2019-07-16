import ow from 'ow';
import 'reflect-metadata';
import { Expose, Exclude, Transform } from 'class-transformer';

export interface BaseStep {}

// see https://github.com/microsoft/TypeScript/issues/22815#issuecomment-375766197
export interface DefaultStep extends BaseStep {}
export abstract class DefaultStep implements BaseStep {
    @Exclude()
    public readonly dependencies: Set<DefaultStep> = new Set();

    dependsOn(step: DefaultStep): this {
        this.dependencies.add(step);
        return this;
    }

    @Exclude()
    public always: boolean = false;

    alwaysExecute() {
        this.always = true;
        return this;
    }
}

@Exclude()
export class BranchLimitedStep extends DefaultStep {
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
    get label() {
        return this._label;
    }

    withLabel(label: string) {
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
