import { Exclude } from 'class-transformer';
import ow from 'ow';
import { Chainable } from './base';

export interface KeyValue<T> {
    set(name: string, value: string): T;
}

@Exclude()
export class KeyValueImpl<T> extends Chainable<T> implements KeyValue<T> {
    public readonly vars: Map<string, string> = new Map();

    set(name: string, value: string): T {
        ow(name, ow.string.nonEmpty);
        ow(value, ow.string.nonEmpty);
        this.vars.set(name, value);
        return this.parent;
    }
}

// TODO: remove this once
// https://github.com/typestack/class-transformer/issues/274
// is fixed
export function transformKeyValueImpl(
    kv: KeyValueImpl<any>,
): Map<string, string> | undefined {
    return kv.vars.size ? kv.vars : undefined;
}
