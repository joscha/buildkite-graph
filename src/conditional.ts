import { Step, Pipeline } from '.';

export type Generator<T> = () => T;

export interface Conditional<T extends Step | Pipeline> {
    get(): T;
    accept(): boolean;
}
