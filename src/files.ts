import { isTauri } from '@tauri-apps/api/core';
import { macDesktop, nativeDialogTitle } from './platform';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { createDocument, encodeDocument, isDirty, safeFileName, type BrowserFileHandle, type DocumentEntry } from './document';

export const desktop = isTauri();
export async function openPath(path: string): Promise<DocumentEntry> {
  const text = await readTextFile(path);
  return { ...createDocument(path.split(/[\\/]/).pop(), text), path, diskContent: text };
}
export async function readDocument(doc: DocumentEntry) {
  if (desktop && doc.path) return readTextFile(doc.path);
  if (doc.handle) return (await doc.handle.getFile()).text();
  throw new Error('请先打开或保存到本地文件');
}
export interface FolderItem { name: string; path: string; directory: boolean }
export async function folderItems(path: string): Promise<FolderItem[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs');
  return (await readDir(path)).filter(item => !item.isSymlink && (item.isDirectory || /\.(md|markdown|mdown|txt)$/i.test(item.name)))
    .map(item => ({ name: item.name, path: `${path.replace(/[\\/]$/, '')}/${item.name}`, directory: item.isDirectory }))
    .sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
}
export async function chooseFolder() { return open({ directory: true, multiple: false, title: nativeDialogTitle('打开文稿文件夹'), recursive: true }); }
const filters = [{ name: macDesktop ? 'Markdown' : 'Markdown 文稿', extensions: ['md', 'markdown', 'mdown', 'txt'] }];
const pickerTypes = [{ description: 'Markdown 文稿', accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.txt'] } }];
type PickerWindow = Window & {
  showOpenFilePicker?: (options: unknown) => Promise<BrowserFileHandle[]>;
  showSaveFilePicker?: (options: unknown) => Promise<BrowserFileHandle>;
};

export function isCancelled(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function openDocument(): Promise<DocumentEntry | null> {
  if (desktop) {
    const path = await open({ multiple: false, directory: false, filters, title: nativeDialogTitle('打开 Markdown 文稿') });
    if (!path) return null;
    const text = await readTextFile(path);
    return { ...createDocument(path.split(/[\\/]/).pop(), text), path, diskContent: text };
  }
  const picker = window as PickerWindow;
  if (picker.showOpenFilePicker) {
    const [handle] = await picker.showOpenFilePicker({ multiple: false, types: pickerTypes });
    const text = await (await handle.getFile()).text();
    return { ...createDocument(handle.name, text), handle, diskContent: text };
  }
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.txt,text/markdown,text/plain';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? createDocument(file.name, await file.text()) : null);
    };
    input.click();
  });
}

export class ExternalChangeError extends Error {
  constructor() { super('此文件已被其他应用修改。为保留两个版本，请使用“另存为”。'); }
}

export async function saveDocument(doc: DocumentEntry, saveAs: boolean): Promise<(Partial<DocumentEntry> & { exported?: boolean }) | null> {
  // A no-op save must not normalize a file the user has not edited.
  const content = !isDirty(doc) && doc.diskContent !== undefined ? doc.diskContent : encodeDocument(doc);
  if (desktop) {
    const path = saveAs || !doc.path
      ? await save({ defaultPath: doc.path || safeFileName(doc.name), filters, title: nativeDialogTitle('保存文稿') })
      : doc.path;
    if (!path) return null;
    if (path === doc.path && doc.diskContent !== undefined && await readTextFile(path) !== doc.diskContent) {
      throw new ExternalChangeError();
    }
    await writeTextFile(path, content);
    return { path, name: path.split(/[\\/]/).pop()!, diskContent: content };
  }
  const picker = window as PickerWindow;
  if (picker.showSaveFilePicker) {
    const handle = !saveAs && doc.handle ? doc.handle : await picker.showSaveFilePicker({ suggestedName: safeFileName(doc.name), types: pickerTypes });
    if (handle === doc.handle && doc.diskContent !== undefined && await (await handle.getFile()).text() !== doc.diskContent) {
      throw new ExternalChangeError();
    }
    const writable = await handle.createWritable();
    try { await writable.write(content); await writable.close(); }
    catch (error) { await writable.abort().catch(() => {}); throw error; }
    return { handle, name: handle.name, diskContent: content };
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName(doc.name);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  // A download cannot confirm that the user saved the file. Keep the recovery draft.
  return { exported: true };
}
