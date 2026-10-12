import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from './document';

const mocks = vi.hoisted(() => ({ open: vi.fn(), save: vi.fn(), readTextFile: vi.fn(), writeTextFile: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open, save: mocks.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: mocks.readTextFile, writeTextFile: mocks.writeTextFile }));
import { ExternalChangeError, openDocument, saveDocument } from './files';

beforeEach(() => vi.resetAllMocks());
describe('native file adapter', () => {
  it('opens a user-selected Unicode path and records the on-disk baseline', async () => {
    mocks.open.mockResolvedValue('C:\\文稿\\今天.md');
    mocks.readTextFile.mockResolvedValue('# 你好\r\n');
    const doc = await openDocument();
    expect(doc).toMatchObject({ name: '今天.md', path: 'C:\\文稿\\今天.md', diskContent: '# 你好\r\n', lineEnding: '\r\n' });
  });
  it('does not write or claim success when the Save As dialog is cancelled', async () => {
    mocks.save.mockResolvedValue(null);
    expect(await saveDocument(createDocument(), true)).toBeNull();
    expect(mocks.writeTextFile).not.toHaveBeenCalled();
  });
  it('refuses to overwrite external edits', async () => {
    const doc = { ...createDocument('draft.md', 'before'), path: 'C:\\draft.md', diskContent: 'before', markdown: 'ours' };
    mocks.readTextFile.mockResolvedValue('external changes');
    await expect(saveDocument(doc, false)).rejects.toBeInstanceOf(ExternalChangeError);
    expect(mocks.writeTextFile).not.toHaveBeenCalled();
  });
  it('writes edits to the original path without showing another dialog', async () => {
    const doc = { ...createDocument('draft.md', 'before\r\n'), path: 'C:\\draft.md', diskContent: 'before\r\n', markdown: 'after\n' };
    mocks.readTextFile.mockResolvedValue(doc.diskContent);
    mocks.writeTextFile.mockResolvedValue(undefined);
    expect(await saveDocument(doc, false)).toMatchObject({ path: doc.path, diskContent: 'after\r\n' });
    expect(mocks.writeTextFile).toHaveBeenCalledWith(doc.path, 'after\r\n');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('preserves exact source bytes for unchanged files', async () => {
    const original = '- item\n\n\n<!-- preserved on a no-op save -->\n';
    const doc = { ...createDocument('draft.md', '* item\n'), path: 'C:\\draft.md', diskContent: original };
    mocks.readTextFile.mockResolvedValue(original);
    await saveDocument(doc, false);
    expect(mocks.writeTextFile).toHaveBeenCalledWith(doc.path, original);
  });
  it('propagates disk errors so the document stays unsaved', async () => {
    mocks.save.mockResolvedValue('C:\\new.md');
    mocks.writeTextFile.mockRejectedValue(new Error('disk full'));
    await expect(saveDocument(createDocument(), false)).rejects.toThrow('disk full');
  });
});
