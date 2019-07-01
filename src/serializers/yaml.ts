import { Serializer } from '../serializer';
import { Entity } from '../';
import * as jsyaml from 'js-yaml';
import { JsonSerializer } from './json';

export class YamlSerializer implements Serializer<string> {
    serialize(e: Entity) {
        let json = new JsonSerializer().serialize(e);
        // get rid of undefined values
        json = JSON.parse(JSON.stringify(json));
        return jsyaml.safeDump(json, {
            skipInvalid: true,
            styles: {
                '!!null': 'canonical', // dump null as ~
            },
        });
    }
}
