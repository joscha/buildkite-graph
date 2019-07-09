import { Serializer } from '../serializer';
import { Entity } from '../';
import * as jsyaml from 'js-yaml';
import { JsonSerializer } from './json';

export class YamlSerializer extends JsonSerializer
    implements Serializer<string> {
    serialize(e: Entity) {
        return jsyaml.safeDump(super.serialize(e), {
            skipInvalid: true,
            styles: {
                '!!null': 'canonical', // dump null as ~
            },
        });
    }
}
