import ow from 'ow';
import { Chainable } from '../../base';

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

export function transformPlugins(value: PluginsImpl<any>): object | undefined {
    if (!value.plugins.length) {
        return undefined;
    }

    return value.plugins.map(plugin => {
        return {
            [plugin.pluginNameOrPath]: plugin.configuration || null,
        };
    });
}

export class PluginsImpl<T> extends Chainable<T> implements Plugins<T> {
    public plugins: Plugin[] = [];

    add(plugin: Plugin): T {
        this.plugins.push(plugin);
        return this.parent;
    }
}
