import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DocumentEntry } from './document';
import { storeWorkspace, WORKSPACE_KEY } from './workspace';
import { t } from './i18n';

const prefix = WORKSPACE_KEY + '.window.';
const windowId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const label = isTauri() ? getCurrentWindow().label : new URLSearchParams(location.search).get('window') ?? '';
const id = label.replace(/^document-/, '');
export const workspaceKey = windowId.test(id) ? prefix + id : WORKSPACE_KEY;
export const secondaryWindow = workspaceKey !== WORKSPACE_KEY;

export async function openDocumentWindow(doc: DocumentEntry) {
  const id = crypto.randomUUID();
  const key = prefix + id;
  storeWorkspace({ version: 1, docs: [doc], activeId: doc.id, sessions: {} }, key);
  try {
    if (isTauri()) await invoke('open_document_window', { id });
    else {
      const url = new URL(location.href);
      url.searchParams.set('window', id);
      if (!window.open(url, 'document-' + id, 'popup')) throw new Error(t('请允许 Chartelis 打开新窗口'));
    }
  } catch (error) {
    localStorage.removeItem(key);
    throw error;
  }
}

// Snapshot the list at startup before new windows can be created. Each saved
// window owns its recovery record, even when the original window closes first.
export async function restoreDocumentWindows() {
  if (!isTauri() || secondaryWindow) return;
  const ids = Object.keys(localStorage).filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length)).filter(id => windowId.test(id));
  for (const id of ids) await invoke('open_document_window', { id });
}
