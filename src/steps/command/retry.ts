import ow from 'ow';
import { Chainable, ExitStatus, exitStatusPredicate } from '../../base';
import { Serializable } from '../../index';

export interface Retry<T> {
    automatic(statuses: boolean | Map<ExitStatus, number>): T;
    manual(allowed: boolean, permitOnPassed?: boolean, reason?: string): T;
}

class RetryManual {
    allowed = true;
    permitOnPassed = false;
    reason?: string;

    hasValue(): boolean {
        return !this.allowed || this.permitOnPassed;
    }

    async toJson(): Promise<object | undefined> {
        if (!this.hasValue()) {
            return undefined;
        }
        return {
            allowed: this.allowed ? undefined : false,
            // eslint-disable-next-line @typescript-eslint/camelcase
            permit_on_passed: this.permitOnPassed || undefined,
            reason: this.reason || undefined,
        };
    }
}

const transformAutomatic = (
    value: boolean | Map<ExitStatus, number>,
): undefined | boolean | { exit_status: ExitStatus; limit: number }[] => {
    if (!value) {
        return undefined;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return [...value.entries()].map(([s, limit]) => ({
        // eslint-disable-next-line @typescript-eslint/camelcase
        exit_status: s,
        limit,
    }));
};

export class RetryImpl<T> extends Chainable<T>
    implements Retry<T>, Serializable {
    async toJson(): Promise<object | undefined> {
        if (!this.hasValue()) {
            return undefined;
        }
        return {
            manual: await this._manual.toJson(),
            automatic: transformAutomatic(this._automatic),
        };
    }

    private readonly _manual = new RetryManual();
    private _automatic: boolean | Map<ExitStatus, number> = false;

    hasValue(): boolean {
        return !!(this._manual.hasValue() || this._automatic);
    }

    automatic(statuses: boolean | Map<ExitStatus, number> = true): T {
        if (typeof statuses !== 'boolean') {
            ow(statuses, ow.map.nonEmpty);
            ow(statuses, ow.map.valuesOfType(ow.number.integer.positive));
            ow(statuses, ow.map.valuesOfType(exitStatusPredicate as any)); // Fix predicate type

            this._automatic =
                typeof this._automatic === 'boolean'
                    ? new Map()
                    : this._automatic;

            for (const [exitStatus, limit] of statuses) {
                this._automatic.set(exitStatus, limit);
            }
        } else {
            this._automatic = statuses;
        }
        return this.parent;
    }

    manual(allowed = true, permitOnPassed = false, reason?: string): T {
        ow(allowed, ow.boolean);
        ow(permitOnPassed, ow.boolean);
        ow(reason, ow.any(ow.undefined, ow.string.nonEmpty));

        this._manual.allowed = allowed;
        this._manual.permitOnPassed = permitOnPassed;
        this._manual.reason = reason;

        return this.parent;
    }
}
