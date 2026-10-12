import { describe, expect, it } from 'vitest';
import { createDocument, encodeDocument, isDirty, markSaved, safeFileName } from './document';

describe('document save lifecycle', () => {
  it('preserves Windows line endings and UTF-8 BOM when serializing edited text', () => {
    const doc = createDocument('Windows.md', '\uFEFF# 标题\r\n\r\n正文\r\n');
    expect(encodeDocument(doc, '# 标题\n\n修改内容\n')).toBe('\uFEFF# 标题\r\n\r\n修改内容\r\n');
  });
  it('does not mark newer edits as saved when an older async save finishes', () => {
    const doc = { ...createDocument('草稿.md', '原文'), markdown: '保存期间的新修改' };
    const result = markSaved(doc, '保存开始时的快照', { path: '/draft.md' });
    expect(result.markdown).toBe('保存期间的新修改');
    expect(isDirty(result)).toBe(true);
    expect(result.savedMarkdown).toBe('保存开始时的快照');
  });
  it('marks a successfully persisted snapshot clean', () => {
    const doc = { ...createDocument(), markdown: '# Hello' };
    expect(isDirty(markSaved(doc, '# Hello', { path: '/draft.md' }))).toBe(false);
  });
  it('provides a usable Markdown filename', () => {
    expect(safeFileName('日记:今天/')).toBe('日记今天.md');
    expect(safeFileName('notes.markdown')).toBe('notes.markdown');
    expect(safeFileName('...')).toBe('未命名.md');
  });
});
