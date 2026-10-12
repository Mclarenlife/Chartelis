// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument, isDirty } from './document';
import { emptySession, restoreWorkspace, storeWorkspace, WORKSPACE_KEY } from './workspace';

beforeEach(() => localStorage.clear());
describe('workspace recovery', () => {
  it('restores document order, active document, file baseline, draft, mode, selection and scroll', () => {
    const file = { ...createDocument('已保存.md', '# saved'), path: 'C:\\notes\\已保存.md', diskContent: '# saved' };
    const draft = { ...createDocument('草稿.md'), markdown: '尚未保存' };
    const session = emptySession(); session.mode = 'source'; session.source = { cursor: { anchor: 2, head: 4 }, scroll: 381.5 };
    storeWorkspace({ version: 1, docs: [file, draft], activeId: draft.id, sessions: { [draft.id]: session } });
    const restored = restoreWorkspace();
    expect(restored.docs).toEqual([file, draft]);
    expect(restored.activeId).toBe(draft.id);
    expect(restored.sessions[draft.id]).toEqual(session);
    expect(isDirty(restored.docs[0])).toBe(false);
    expect(isDirty(restored.docs[1])).toBe(true);
  });
  it('does not resurrect documents removed from the workspace', () => {
    const doc = createDocument();
    storeWorkspace({ version: 1, docs: [doc], activeId: doc.id, sessions: {} });
    expect(restoreWorkspace().docs).toHaveLength(1);
    expect(restoreWorkspace().docs[0].id).toBe(doc.id);
  });
  it('validates corrupted state and migrates old recovery drafts', () => {
    localStorage.setItem(WORKSPACE_KEY, '{bad json');
    localStorage.setItem('chartelis.recovery.v1', JSON.stringify([{ name: '旧草稿.md', markdown: '仍然在这里' }]));
    expect(restoreWorkspace().docs[0].markdown).toBe('仍然在这里');
    const doc = createDocument();
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ version: 1, docs: [doc, doc, null], activeId: 'missing', sessions: { [doc.id]: { mode: 'bad', source: { scroll: -1, cursor: { anchor: 3.8, head: 'invalid' } } } } }));
    const result = restoreWorkspace();
    expect(result.docs).toHaveLength(1);
    expect(result.activeId).toBe(doc.id);
    expect(result.sessions[doc.id].source).toEqual({ scroll: 0, cursor: { anchor: 3, head: 0 } });
  });
  it('surfaces storage failures instead of pretending the workspace was saved', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(() => storeWorkspace({ version: 1, docs: [], activeId: '', sessions: {} })).toThrow();
    spy.mockRestore();
  });
});
