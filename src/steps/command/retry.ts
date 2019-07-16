import ow from 'ow';
import 'reflect-metadata';
import { Expose, Exclude, Transform } from 'class-transformer';
import { ExitStatus, exitStatusPredicate, Chainable } from '../base';
import { Step } from '../command';

export interface Retry<T> {
    automatic(statuses: boolean | Map<ExitStatus, number>): T;
    manual(allowed: boolean, permitOnPassed?: boolean, reason?: string): T;
}

@Exclude()
export class RetryImpl<T> extends Chainable<T> implements Retry<T> {
    @Expose({ name: 'manual' })
    @Transform((value: RetryManual) => (value.hasValue() ? value : undefined))
    private readonly _manual = new RetryManual();

    @Expose({ name: 'automatic' })
    @Transform((value: boolean | Map<ExitStatus, number>) => {
        if (!value) {
            return undefined;
        }
        if (typeof value === 'boolean') {
            return value;
        }
        return [...value.entries()].map(([exit_status, limit]) => ({
            exit_status,
            limit,
        }));
    })
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

    manual(
        allowed: boolean = true,
        permitOnPassed: boolean = false,
        reason?: string,
    ): T {
        ow(allowed, ow.boolean);
        ow(permitOnPassed, ow.boolean);
        ow(reason, ow.any(ow.undefined, ow.string.nonEmpty));

        this._manual.allowed = allowed;
        this._manual.permitOnPassed = permitOnPassed;
        this._manual.reason = reason;

        return this.parent;
    }
}

class RetryManual {
    @Transform((value: boolean) => (value ? undefined : false))
    allowed: boolean = true;

    @Expose({ name: 'permit_on_passed' })
    @Transform((value: boolean) => (value ? true : undefined))
    permitOnPassed: boolean = false;

    @Transform((value: string) => value || undefined)
    reason?: string;

    hasValue() {
        return !this.allowed || this.permitOnPassed;
    }
}
