import { useState } from 'react';
import { loadPlugins, savePlugins, type InstalledPlugin, type PluginManifest } from './plugins';

export function usePlugins() {
  const [initial] = useState(loadPlugins);
  const [plugins, setPlugins] = useState(initial.plugins);
  const [error, setError] = useState(initial.error);
  function commit(next: InstalledPlugin[]) {
    if (error) throw new Error(error);
    try { savePlugins(next); } catch { throw new Error('插件保存失败，可能是本地存储已满。原有插件未改变。'); }
    setPlugins(next);
  }
  return {
    plugins, error,
    install(manifest: PluginManifest) {
      if (!plugins.some(item => item.manifest.id === manifest.id) && plugins.length >= 20) throw new Error('最多安装 20 个插件');
      const previous = plugins.find(item => item.manifest.id === manifest.id);
      const entry = { manifest, enabled: previous?.enabled ?? true };
      commit(previous ? plugins.map(item => item === previous ? entry : item) : [...plugins, entry]);
    },
    toggle(id: string) { commit(plugins.map(item => item.manifest.id === id ? { ...item, enabled: !item.enabled } : item)); },
    remove(id: string) { commit(plugins.filter(item => item.manifest.id !== id)); },
    reset() { savePlugins([]); setPlugins([]); setError(undefined); },
  };
}
export type PluginManager = ReturnType<typeof usePlugins>;
