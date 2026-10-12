import { describe, expect, it } from 'vitest';
import { undo, redo, undoDepth } from '@codemirror/commands';
import { createSourceState, sourceHeadings, sourceReplacement } from './source-state';

describe('source editing sessions', () => {
  it('keeps selection and history when another document is edited', () => {
    let first = createSourceState('alpha beta');
    first = first.update({ changes: { from: 6, insert: 'new ' }, selection: { anchor: 10 } }).state;
    let second = createSourceState('second');
    second = second.update({ changes: { from: 6, insert: ' document' } }).state;
    expect(first.selection.main.anchor).toBe(10);
    expect(undoDepth(first)).toBe(1);
    undo({ state: first, dispatch: tr => { first = tr.state; } });
    expect(first.doc.toString()).toBe('alpha beta');
    expect(second.doc.toString()).toBe('second document');
    redo({ state: first, dispatch: tr => { first = tr.state; } });
    expect(first.doc.toString()).toBe('alpha new beta');
  });

  it('syncs preview edits as a separate undo step without discarding earlier history', () => {
    let state = createSourceState('first');
    state = state.update({ changes: { from: 5, insert: ' draft' }, selection: { anchor: 3 } }).state;
    state = state.update(sourceReplacement(state.doc.toString(), '# first draft')!).state;
    expect(state.selection.main.anchor).toBe(5);
    expect(undoDepth(state)).toBe(2);
    undo({ state, dispatch: tr => { state = tr.state; } });
    expect(state.doc.toString()).toBe('first draft');
    undo({ state, dispatch: tr => { state = tr.state; } });
    expect(state.doc.toString()).toBe('first');
  });

  it('does not add a history entry for an unchanged mode round trip', () => {
    const original = '* item\n\n<!-- raw -->\n';
    expect(sourceReplacement(original, original)).toBeNull();
  });

  it('handles insertion, removal, empty documents, and Unicode replacements', () => {
    for (const [before, after] of [['', '# 新文稿'], ['abc', ''], ['abc', 'abXYZc'], ['😀中文', '😀新中文'], ['same middle end', 'same replacement end']]) {
      const state = createSourceState(before).update(sourceReplacement(before, after)!).state;
      expect(state.doc.toString()).toBe(after);
    }
  });

  it('builds a source outline excluding code fences and recognizing Setext headings', () => {
    const text = '# One\n\n```md\n# Not a heading\n```\n\nTwo\n---\n\n## Three ##\n';
    expect(sourceHeadings(createSourceState(text))).toEqual([
      { text: 'One', level: 1, pos: 0 },
      { text: 'Two', level: 2, pos: text.indexOf('Two') },
      { text: 'Three', level: 2, pos: text.indexOf('## Three') },
    ]);
  });
});
