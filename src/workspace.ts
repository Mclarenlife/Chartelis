import { createDocument, restoreDrafts, welcome, type DocumentEntry } from './document';

export interface CursorState { anchor: number; head: number }
export interface SessionSnapshot {
  mode: 'preview' | 'source';
  preview: { cursor: CursorState; scroll: number };
  source: { cursor: CursorState; scroll: number };
}
export interface Workspace {
  version: 1; activeId: string; docs: DocumentEntry[];
  sessions: Record<string, SessionSnapshot>;
}
export const WORKSPACE_KEY = 'chartelis.workspace.v1';
export function emptySession(): SessionSnapshot {
  return { mode: 'preview', preview: { cursor: { anchor: 0, head: 0 }, scroll: 0 }, source: { cursor: { anchor: 0, head: 0 }, scroll: 0 } };
}
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
export function sanitizeSession(value: any): SessionSnapshot {
  const view = (item: any) => ({ cursor: { anchor: Math.floor(finite(item?.cursor?.anchor)), head: Math.floor(finite(item?.cursor?.head)) }, scroll: finite(item?.scroll) });
  return { mode: value?.mode === 'source' ? 'source' : 'preview', preview: view(value?.preview), source: view(value?.source) };
}
export function storeWorkspace(workspace: Workspace) {
  // FileSystemFileHandle is not JSON serializable; desktop paths and conflict baselines are.
  const docs = workspace.docs.map(({ handle: _handle, ...doc }) => doc);
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ ...workspace, docs }));
}
export function restoreWorkspace(): Workspace {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null');
    if (saved?.version === 1 && Array.isArray(saved.docs)) {
      const seen = new Set<string>();
      const docs: DocumentEntry[] = saved.docs.filter((doc: any) => {
        if (!doc || typeof doc.id !== 'string' || seen.has(doc.id) || typeof doc.name !== 'string' || typeof doc.markdown !== 'string' || typeof doc.savedMarkdown !== 'string') return false;
        seen.add(doc.id); return true;
      }).map((doc: any) => ({ id: doc.id, name: doc.name, markdown: doc.markdown, savedMarkdown: doc.savedMarkdown,
        path: typeof doc.path === 'string' ? doc.path : undefined,
        diskContent: typeof doc.diskContent === 'string' ? doc.diskContent : undefined,
        bom: doc.bom === true, lineEnding: doc.lineEnding === '\r\n' ? '\r\n' : '\n' }));
      if (docs.length) return { version: 1, docs, activeId: docs.some(doc => doc.id === saved.activeId) ? saved.activeId : docs[0].id,
        sessions: Object.fromEntries(docs.map(doc => [doc.id, sanitizeSession(saved.sessions?.[doc.id])])) };
    }
  } catch { /* Recover older drafts when a workspace is unavailable or malformed. */ }
  const drafts = restoreDrafts();
  const docs = drafts.length ? drafts : [createDocument('初见 Chartelis.md', welcome)];
  return { version: 1, docs, activeId: docs[0].id, sessions: {} };
}
