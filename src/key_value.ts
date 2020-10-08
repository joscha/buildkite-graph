import ow from 'ow';
import { Chainable, mapToObject } from './base';
import { Serializable } from './index';

export interface KeyValue<T> {
    set(name: string, value: string): T;
}

export class KeyValueImpl<T>
    extends Chainable<T>
    implements KeyValue<T>, Serializable {
    public readonly vars: Map<string, string> = new Map();

    set(name: string, value: string): T {
        ow(name, ow.string.nonEmpty);
        ow(value, ow.string.nonEmpty);
        this.vars.set(name, value);
        return this.parent;
    }

    async toJson(): Promise<Record<string, unknown> | undefined> {
        return this.vars.size ? mapToObject(this.vars) : undefined;
    }
}
