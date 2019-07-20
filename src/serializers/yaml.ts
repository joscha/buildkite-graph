import { Serializer } from '../serializer';
import { Pipeline } from '../';
import * as jsyaml from 'js-yaml';
import { JsonSerializer } from './json';

export class YamlSerializer extends JsonSerializer
    implements Serializer<string> {
    serialize(e: Pipeline) {
        return jsyaml.safeDump(super.serialize(e), {
            skipInvalid: true,
            styles: {
                '!!null': 'canonical', // dump null as ~
            },
        });
    }
}
