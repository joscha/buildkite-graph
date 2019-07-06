import { Serializer } from '../serializer';
import { Entity } from '../';
import * as jsyaml from 'js-yaml';
import { JsonSerializer } from './json';

export class YamlSerializer implements Serializer<string> {
    serialize(e: Entity) {
        let json = new JsonSerializer().serialize(e);
        // Workaround to get rid of undefined values
        // see https://github.com/nodeca/js-yaml/issues/356
        json = JSON.parse(JSON.stringify(json));
        return jsyaml.safeDump(json, {
            skipInvalid: true,
            styles: {
                '!!null': 'canonical', // dump null as ~
            },
        });
    }
}
