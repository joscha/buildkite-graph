import { Pipeline } from '../';
import { Serializer } from '.';

export class StructuralSerializer implements Serializer<string> {
    async serialize(p: Pipeline): Promise<string> {
        const steps = await p.toList();
        return steps.map(step => `* ${step.toString()}`).join('\n');
    }
}
