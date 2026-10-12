import { useEffect, useState } from 'react';
import { resolveTheme } from './preferences';
import { desktop } from './files';

export function useTheme(preference: string) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const changed = () => setSystemDark(media.matches);
    media.addEventListener('change', changed); changed();
    return () => media.removeEventListener('change', changed);
  }, []);
  const theme = resolveTheme(preference, systemDark);
  const dark = theme === 'dark' || theme === 'midnight';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [theme, dark]);
  useEffect(() => {
    // Reset the native override for system mode; a forced native theme would
    // otherwise pin prefers-color-scheme and stop following the OS.
    if (desktop) void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().setTheme(preference === 'system' ? null : dark ? 'dark' : 'light')).catch(() => {});
  }, [preference, dark]);
  return { theme, dark };
}
