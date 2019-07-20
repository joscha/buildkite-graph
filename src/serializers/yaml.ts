import * as jsyaml from 'js-yaml';
import { Pipeline } from '../';
import { Serializer } from '../serializer';
import { JsonSerializer } from './json';

export class YamlSerializer implements Serializer<string> {
    private readonly jsonSerializer = new JsonSerializer();

    serialize(e: Pipeline): string {
        return jsyaml.safeDump(this.jsonSerializer.serialize(e), {
            skipInvalid: true,
            styles: {
                '!!null': 'canonical', // dump null as ~
            },
        });
    }
}
