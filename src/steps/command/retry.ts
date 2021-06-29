import ow from 'ow';
import { Chainable, ExitStatus, exitStatusPredicate } from '../../base';
import { Serializable } from '../../index';

type Statuses = boolean | number | Map<ExitStatus, number>;

export interface Retry<T> {
  automatic(statuses: Statuses): T;
  manual(allowed: boolean, permitOnPassed?: boolean, reason?: string): T;
  getAutomaticValue(): Map<ExitStatus, number>;
}

class RetryManual implements Serializable {
  allowed = true;
  permitOnPassed = false;
  reason?: string;

  hasValue(): boolean {
    return !this.allowed || this.permitOnPassed;
  }

  async toJson(): Promise<Record<string, unknown> | undefined> {
    if (!this.hasValue()) {
      return undefined;
    }
    return {
      allowed: this.allowed ? undefined : false,
      permit_on_passed: this.permitOnPassed || undefined,
      reason: this.reason || undefined,
    };
  }
}

const transformAutomatic = (
  value: Statuses,
):
  | undefined
  | boolean
  | { limit: number }
  | { exit_status?: ExitStatus; limit: number }[] => {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  } else if (typeof value === 'number') {
    return { limit: value };
  }
  if (value.size === 1 && value.has('*') && value.get('*')) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      limit: value.get('*')!,
    };
  } else {
    return [...value.entries()].map(([s, limit]) => ({
      exit_status: s,
      limit,
    }));
  }
};

export class RetryImpl<T>
  extends Chainable<T>
  implements Retry<T>, Serializable
{
  async toJson(): Promise<Record<string, unknown> | undefined> {
    if (!this.hasValue()) {
      return undefined;
    }
    return {
      manual: await this._manual.toJson(),
      automatic: transformAutomatic(this._automatic),
    };
  }

  private readonly _manual = new RetryManual();
  private _automatic: Statuses = false;

  hasValue(): boolean {
    return !!(this._manual.hasValue() || this._automatic);
  }

  getAutomaticValue(): Map<ExitStatus, number> {
    switch (typeof this._automatic) {
      case 'boolean':
        return this._automatic ? new Map([['*', 2]]) : new Map();
      case 'number':
        return new Map([['*', this._automatic]]);
      default:
        return this._automatic;
    }
  }

  automatic(statuses: Statuses = true): T {
    if (typeof statuses === 'object') {
      ow(statuses, ow.map.nonEmpty);
      ow(statuses, ow.map.valuesOfType(ow.number.integer.positive));
      ow(statuses, ow.map.valuesOfType(exitStatusPredicate as any)); // Fix predicate type

      this._automatic =
        typeof this._automatic !== 'object' ? new Map() : this._automatic;

      for (const [exitStatus, limit] of statuses) {
        this._automatic.set(exitStatus, limit);
      }
    } else if (typeof statuses === 'number') {
      ow(statuses, ow.number.positive);
      this._automatic = statuses;
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
