import { KeyValue, KeyValueImpl } from '../../key_value';
import { Serializable } from '../../index';

export interface Build<T> {
    env: KeyValue<T>;
    metadata: KeyValue<T>;
    withMessage(message: string): T;
    withCommit(commit: string): T;
    withBranch(branch: string): T;
}

export class BuildImpl<T> implements Build<T>, Serializable {
    private _message?: string;
    private _commit?: string;
    private _branch?: string;
    public readonly env: KeyValue<T>;
    public readonly metadata: KeyValue<T>;
    constructor(private readonly triggerStep: T) {
        this.env = new KeyValueImpl(triggerStep);
        this.metadata = new KeyValueImpl(triggerStep);
    }
    withMessage(message: string): T {
        this._message = message;
        return this.triggerStep;
    }
    withCommit(commit: string): T {
        this._commit = commit;
        return this.triggerStep;
    }
    withBranch(branch: string): T {
        this._branch = branch;
        return this.triggerStep;
    }
    hasData(): boolean {
        return !!(
            this._branch ||
            this._commit ||
            typeof this._message !== 'undefined' ||
            (this.env as KeyValueImpl<T>).vars.size ||
            (this.metadata as KeyValueImpl<T>).vars.size
        );
    }

    async toJson(): Promise<Record<string, unknown> | undefined> {
        if (!this.hasData()) {
            return undefined;
        }
        return {
            message: this._message,
            commit: this._commit,
            branch: this._branch,
            env: await (this.env as KeyValueImpl<T>).toJson(),
            meta_data: await (this.metadata as KeyValueImpl<T>).toJson(),
        };
    }
}
