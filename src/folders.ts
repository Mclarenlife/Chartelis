import { t } from './i18n';
import { desktop, chooseFolder, folderItems, openPath } from './files';
import { createDocument, type BrowserFileHandle } from './document';

export interface DirectoryHandle {
  kind: 'directory'; name: string;
  values(): AsyncIterable<DirectoryHandle | (BrowserFileHandle & { kind: 'file' })>;
}
export interface FolderLocation { name: string; path?: string; handle?: DirectoryHandle }
export interface WorkspaceFile { name: string; key: string; path?: string; directory: boolean; folder?: DirectoryHandle; file?: BrowserFileHandle }
export interface FolderView { trail: FolderLocation[]; items: WorkspaceFile[] }
export async function chooseWorkspaceFolder(): Promise<FolderLocation | null> {
  if (desktop) {
    const path = await chooseFolder();
    return path ? { name: path.split(/[\\/]/).filter(Boolean).pop() || path, path } : null;
  }
  const picker = window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> };
  if (!picker.showDirectoryPicker) throw new Error(t('当前浏览器不支持文件夹访问，请使用桌面版或支持此功能的浏览器'));
  const handle = await picker.showDirectoryPicker();
  return { name: handle.name, handle };
}
export async function readWorkspaceFolder(trail: FolderLocation[]): Promise<FolderView> {
  const current = trail.at(-1)!;
  if (current.path) return { trail, items: (await folderItems(current.path)).map(item => ({ ...item, key: item.path })) };
  const items: WorkspaceFile[] = [];
  for await (const handle of current.handle!.values()) {
    if (handle.kind === 'directory') items.push({ name: handle.name, key: handle.name, directory: true, folder: handle });
    else if (/\.(md|markdown|mdown|txt)$/i.test(handle.name)) items.push({ name: handle.name, key: handle.name, directory: false, file: handle });
  }
  items.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
  return { trail, items };
}
export async function openWorkspaceFile(item: WorkspaceFile) {
  if (item.path) return openPath(item.path);
  const text = await (await item.file!.getFile()).text();
  return { ...createDocument(item.name, text), handle: item.file, diskContent: text };
}
