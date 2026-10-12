import { desktop } from './files';
export async function writeClipboard(text: string) {
  if (desktop) return (await import('@tauri-apps/plugin-clipboard-manager')).writeText(text);
  return navigator.clipboard.writeText(text);
}
export async function readClipboard() {
  if (desktop) return (await import('@tauri-apps/plugin-clipboard-manager')).readText();
  return navigator.clipboard.readText();
}
