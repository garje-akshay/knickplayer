import { useState, useCallback, useRef } from 'react';

/**
 * usePlugins — Extension/plugin system for KnickPlayer.
 *
 * Plugins are ES modules loaded via dynamic import() that export a register(api) function.
 * The API surface exposes player events and menu registration.
 *
 * Plugin lifecycle:
 *   1. install(url) — downloads and registers the plugin
 *   2. The plugin's register() function receives an API object
 *   3. Plugins can hook into player events (onPlay, onPause, onTimeUpdate, etc.)
 *   4. Plugins can register custom menu items
 *   5. uninstall(id) — removes the plugin
 */

const STORAGE_KEY = 'kp-plugins';

function loadSavedPlugins() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function savePlugins(plugins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      plugins.map(p => ({ id: p.id, url: p.url, name: p.name, description: p.description, version: p.version, enabled: p.enabled }))
    ));
  } catch {}
}

export default function usePlugins() {
  const [plugins, setPlugins] = useState(() => loadSavedPlugins());
  const [error, setError] = useState(null);
  const instancesRef = useRef(new Map()); // id -> { api, hooks }

  // Create the API surface for a plugin
  const createPluginAPI = useCallback((id) => {
    const api = {
      id,
      name: 'Unnamed Plugin',
      description: '',
      version: '1.0.0',
      // Event hooks — plugins override these
      onPlay: null,
      onPause: null,
      onStop: null,
      onTimeUpdate: null,
      onVolumeChange: null,
      onMediaLoad: null,
      onEnded: null,
      // Menu items the plugin wants to add
      menuItems: [],
      getMenuItems: () => api.menuItems,
      addMenuItem: (item) => { api.menuItems.push({ ...item, pluginId: id }); },
      // Logging
      log: (...args) => console.log(`[Plugin:${api.name}]`, ...args),
    };
    return api;
  }, []);

  const install = useCallback(async (url) => {
    setError(null);
    try {
      const id = 'plugin-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const api = createPluginAPI(id);

      // Dynamic import of the plugin module
      const module = await import(/* @vite-ignore */ url);
      if (typeof module.register !== 'function') {
        throw new Error('Plugin must export a register(api) function');
      }

      module.register(api);
      instancesRef.current.set(id, { api, module });

      const pluginData = {
        id, url,
        name: api.name,
        description: api.description,
        version: api.version,
        enabled: true,
      };

      setPlugins(prev => {
        const next = [...prev, pluginData];
        savePlugins(next);
        return next;
      });

      return pluginData;
    } catch (e) {
      setError(`Failed to install plugin: ${e.message}`);
      return null;
    }
  }, [createPluginAPI]);

  const uninstall = useCallback((id) => {
    instancesRef.current.delete(id);
    setPlugins(prev => {
      const next = prev.filter(p => p.id !== id);
      savePlugins(next);
      return next;
    });
  }, []);

  const toggle = useCallback((id) => {
    setPlugins(prev => {
      const next = prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p);
      savePlugins(next);
      return next;
    });
  }, []);

  // Fire an event to all enabled plugins
  const emit = useCallback((event, ...args) => {
    for (const [id, instance] of instancesRef.current) {
      const plugin = plugins.find(p => p.id === id);
      if (!plugin?.enabled) continue;
      const handler = instance.api[event];
      if (typeof handler === 'function') {
        try { handler(...args); } catch (e) {
          console.warn(`Plugin ${instance.api.name} error on ${event}:`, e);
        }
      }
    }
  }, [plugins]);

  // Get all menu items from enabled plugins
  const getPluginMenuItems = useCallback(() => {
    const items = [];
    for (const [id, instance] of instancesRef.current) {
      const plugin = plugins.find(p => p.id === id);
      if (!plugin?.enabled) continue;
      items.push(...instance.api.getMenuItems());
    }
    return items;
  }, [plugins]);

  // Re-initialize saved plugins on demand
  const initSavedPlugins = useCallback(async () => {
    for (const plugin of plugins) {
      if (plugin.enabled && !instancesRef.current.has(plugin.id)) {
        try {
          const api = createPluginAPI(plugin.id);
          const module = await import(/* @vite-ignore */ plugin.url);
          if (typeof module.register === 'function') {
            module.register(api);
            instancesRef.current.set(plugin.id, { api, module });
          }
        } catch (e) {
          console.warn(`Failed to load plugin ${plugin.name}:`, e);
        }
      }
    }
  }, [plugins, createPluginAPI]);

  return {
    plugins, error,
    install, uninstall, toggle,
    emit, getPluginMenuItems, initSavedPlugins,
  };
}
