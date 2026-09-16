import type { PluginRegistry } from './types.js';

/** Simple id → plugin map. One place to add a plugin: drop a file + register in an index. */
export function createRegistry<T extends { id: string }>(): PluginRegistry<T> {
  const map = new Map<string, T>();

  const api: PluginRegistry<T> = {
    register(plugin: T) {
      if (map.has(plugin.id)) {
        throw new Error(`Plugin already registered: ${plugin.id}`);
      }
      map.set(plugin.id, plugin);
      return api;
    },
    get(id: string) {
      return map.get(id);
    },
    list() {
      return [...map.values()];
    },
    has(id: string) {
      return map.has(id);
    },
  };

  return api;
}
