import ow from 'ow';
import 'reflect-metadata';
import { Exclude } from 'class-transformer';
import { Chainable } from './steps/base';

export class Plugin {
    constructor(
        public readonly pluginNameOrPath: string,
        public readonly configuration?: object,
    ) {
        ow(pluginNameOrPath, ow.string.not.empty);
    }
}

export interface Plugins<T> {
    add(plugin: Plugin): T;
}

export function transformPlugins(value: PluginsImpl<any>) {
    if (!value.plugins.length) {
        return undefined;
    }

    return value.plugins.map(plugin => {
        return {
            [plugin.pluginNameOrPath]: plugin.configuration || null,
        };
    });
}

@Exclude()
export class PluginsImpl<T> extends Chainable<T> implements Plugins<T> {
    public plugins: Plugin[] = [];

    add(plugin: Plugin) {
        this.plugins.push(plugin);
        return this.parent;
    }
}
