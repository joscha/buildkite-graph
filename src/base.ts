import ow from 'ow';
import { PotentialStep, Serializable } from './index';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseStep {}

// see https://github.com/microsoft/TypeScript/issues/22815#issuecomment-375766197
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Step extends BaseStep {}
export abstract class Step implements BaseStep, Serializable {
    public readonly dependencies: Set<PotentialStep> = new Set();

    /**
     * This marks the given step or conditional as a dependency to the current
     * step.
     * In case the dependency is a conditional, then that conditional will
     * always be added to the graph (e.g. the value of the accept function of that
     * conditional will be trumped by the fact that the current step depends on it)
     */
    dependsOn(...steps: PotentialStep[]): this {
        ow(steps, ow.array.ofType(ow.object.nonEmpty));
        // iterate in reverse so if dependencies are not added to the graph, yet
        // they will be added in the order they are given as dependencies
        for (let i = steps.length; i > 0; i--) {
            const step = steps[i - 1];
            this.dependencies.add(step);
        }
        return this;
    }

    public always = false;

    alwaysExecute(): this {
        this.always = true;
        return this;
    }

    abstract toJson(): Promise<object>;
}

export class BranchLimitedStep extends Step {
    private branches: Set<string> = new Set();

    withBranch(pattern: string): this {
        ow(pattern, ow.string.nonEmpty);
        this.branches.add(pattern);
        return this;
    }

    async toJson() {
        return {
            branches: this.branches.size
                ? [...this.branches].sort().join(' ')
                : undefined,
        };
    }
}

export class LabeledStep extends BranchLimitedStep {
    private _label?: string;

    protected get label(): string | undefined {
        return this._label;
    }

    withLabel(label: string): this {
        this._label = label;
        return this;
    }

    async toJson() {
        return {
            ...(await super.toJson()),
            label: this.label,
        };
    }
}

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

export function mapToObject<T>(m: Map<string, T>) {
    return Array.from(m).reduce<Record<string, T>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
    }, {});
}
