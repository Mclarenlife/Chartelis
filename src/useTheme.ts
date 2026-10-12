import { useEffect, useState } from 'react';
import { resolveTheme } from './preferences';
import { desktop } from './files';
import { themeTokens, type PluginTheme } from './plugins';

export function useTheme(preference: string, pluginTheme?: PluginTheme) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(media.matches);
    media.addEventListener('change', changed); changed();
    return () => media.removeEventListener('change', changed);
  }, []);
  const theme = pluginTheme?.appearance ?? resolveTheme(preference, systemDark);
  const dark = theme === 'dark' || theme === 'midnight';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    for (const token of themeTokens) {
      if (pluginTheme) document.documentElement.style.setProperty(`--${token}`, pluginTheme.colors[token]);
      else document.documentElement.style.removeProperty(`--${token}`);
    }
    return () => { for (const token of themeTokens) document.documentElement.style.removeProperty(`--${token}`); };
  }, [theme, dark, pluginTheme]);
  useEffect(() => {
    // Reset the native override for system mode; a forced native theme would
    // otherwise pin prefers-color-scheme and stop following the OS.
    if (desktop) void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().setTheme(preference === 'system' ? null : dark ? 'dark' : 'light')).catch(() => {});
  }, [preference, dark]);
  return { theme, dark };
}
