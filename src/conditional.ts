import { DefaultStep } from './steps/base';

// export interface Conditional<DefaultStep> {
//     accept(): boolean;
//     getStep(): DefaultStep;
// }

export abstract class Conditional<T extends DefaultStep> {
    constructor(private readonly step: T) {}

    getStep() {
        return this.step;
    }

    abstract accept(): boolean;
}
