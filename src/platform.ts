import { isTauri } from '@tauri-apps/api/core';

export const macDesktop = isTauri() && /Mac/i.test(navigator.platform);
// AppKit supplies the panel title and button labels in the user's system language.
export const nativeDialogTitle = (title: string) => macDesktop ? undefined : title;
