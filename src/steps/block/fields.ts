import ow from 'ow';
import { Chainable } from '../../base';
import { Serializable } from '../../index';

abstract class Field implements Serializable {
    constructor(
        public readonly key: string,
        public readonly hint?: string,
        public readonly required = false,
    ) {
        ow(key, ow.string.nonEmpty);
        ow(key, ow.string.matches(/[0-9a-z-\/]+/i));
    }

    async toJson(): Promise<Record<string, unknown>> {
        return {
            key: this.key,
            hint: this.hint,
            required: this.required ? undefined : false,
        };
    }
}

export class TextField extends Field {
    constructor(
        key: string,
        private readonly label: string,
        hint?: string,
        required = true,
        private readonly defaultValue?: string,
    ) {
        super(key, hint, required);
    }

    override async toJson(): Promise<Record<string, unknown>> {
        return {
            ...(await super.toJson()),
            text: this.label,
            default: this.defaultValue,
        };
    }
}
export class Option implements Serializable {
    constructor(
        private readonly label: string,
        private readonly value: string,
    ) {
        ow(label, ow.string.nonEmpty);
        ow(value, ow.string.nonEmpty);
    }

    async toJson(): Promise<Record<string, unknown>> {
        return {
            label: this.label,
            value: this.value,
        };
    }
}

export class SelectField extends Field {
    private options: Option[] = [];

    constructor(
        key: string,
        label: string,
        hint?: string,
        required?: boolean,
        multiple?: false,
        defaultValue?: string,
    );
    constructor(
        key: string,
        label: string,
        hint?: string,
        required?: boolean,
        multiple?: true,
        defaultValue?: string | string[],
    );
    constructor(
        key: string,
        private readonly label: string,
        hint?: string,
        required = true,
        private readonly multiple = false,
        private readonly defaultValue?: string | string[],
    ) {
        super(key, hint, required);
    }

    addOption(option: Option): this {
        this.options.push(option);
        return this;
    }

    override async toJson(): Promise<Record<string, unknown>> {
        return {
            ...(await super.toJson()),
            options: await Promise.all(this.options.map((o) => o.toJson())),
            select: this.label,
            default: this.defaultValue,
            multiple: this.multiple || undefined,
        };
    }
}
export interface Fields<T> {
    add(field: Field): T;
}

export class FieldsImpl<T>
    extends Chainable<T>
    implements Fields<T>, Serializable
{
    fields: Map<string, Field> = new Map();
    add(field: Field): T {
        this.fields.set(field.key, field);
        return this.parent;
    }
    hasFields(): boolean {
        return this.fields.size > 0;
    }

    async toJson(): Promise<Record<string, unknown>[] | undefined> {
        if (!this.hasFields()) {
            return undefined;
        }
        return await Promise.all(
            [...this.fields.values()].map((f) => f.toJson()),
        );
    }
}
