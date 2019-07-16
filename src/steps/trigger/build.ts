import { Expose, Exclude, Transform } from 'class-transformer';
import { KeyValue, KeyValueImpl, transformKeyValueImpl } from '../../key_value';

export interface Build<T> {
    env: KeyValue<T>;
    metadata: KeyValue<T>;
    withMessage(message: string): T;
    withCommit(commit: string): T;
    withBranch(branch: string): T;
}
@Exclude()
export class BuildImpl<T> implements Build<T> {
    @Expose({ name: 'message' })
    private _message?: string;
    @Expose({ name: 'commit' })
    private _commit?: string;
    @Expose({ name: 'branch' })
    private _branch?: string;
    @Expose()
    @Transform(transformKeyValueImpl)
    public readonly env: KeyValue<T>;
    @Expose({ name: 'meta_data' })
    @Transform(transformKeyValueImpl)
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
    hasData() {
        return (
            this._branch ||
            this._commit ||
            typeof this._message !== 'undefined' ||
            (this.env as KeyValueImpl<T>).vars.size ||
            (this.metadata as KeyValueImpl<T>).vars.size
        );
    }
}
