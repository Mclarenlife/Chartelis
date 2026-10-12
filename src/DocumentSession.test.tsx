// @vitest-environment jsdom
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { undo, redo, undoDepth } from '@codemirror/commands';
import DocumentSession, { type SessionHandle } from './DocumentSession';
import MarkdownEditor, { type EditorHandle } from './Editor';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
// JSDOM has no layout engine; selection/scroll behavior is also checked in a real browser.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
let root: Root;
let host: HTMLDivElement;
const first = createRef<SessionHandle>();
const second = createRef<SessionHandle>();
const changed = vi.fn();
const failed = vi.fn();
const original = '# Title\n\n* item\n\n<!-- untouched -->\n';
function render(active = 'first') {
  root.render(<>
    <DocumentSession ref={first} initialValue={original} active={active === 'first'} font="serif" onChange={changed} onOutline={() => {}} onMode={() => {}} onError={failed} />
    <DocumentSession ref={second} initialValue="second" active={active === 'second'} font="serif" onChange={() => {}} onOutline={() => {}} onMode={() => {}} onError={failed} />
  </>);
}
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); }
function sourceView() { return EditorView.findFromDOM(host.querySelector('.document-session:not([hidden]) .cm-editor')!)!; }

beforeEach(async () => {
  changed.mockClear(); failed.mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => render());
  await settle();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('document session integration', () => {
  it('renders and edits LaTeX nodes, preserving formula syntax through undo and modes', async () => {
    const text = '# Math\n\nInline $x^2$ and text.\n\n$$\n\\frac{a}{b}\n$$\n';
    await act(async () => root.render(<DocumentSession ref={first} initialValue={text} active font="serif" onChange={changed} onOutline={() => {}} onMode={() => {}} onError={failed} />));
    // Changing the initial prop does not reset an existing retained session.
    await act(async () => first.current!.replaceMarkdown(text));
    await settle();
    expect(host.querySelectorAll('.math-node .katex').length).toBe(2);
    const input = host.querySelector<HTMLTextAreaElement>('.math-block textarea')!;
    await act(async () => { input.value = '\\sum_{i=1}^n i'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(first.current!.getMarkdown()).toContain('\\sum_{i=1}^n i');
    await act(async () => first.current!.undo());
    expect(first.current!.getMarkdown()).toContain('\\frac{a}{b}');
    const before = first.current!.getMarkdown();
    await act(async () => first.current!.setMode('source'));
    await act(async () => first.current!.setMode('preview'));
    expect(first.current!.getMarkdown()).toBe(before);
    expect(failed).not.toHaveBeenCalled();
  });
  it('blocks menu mutations in read-only mode and resumes without losing the session', async () => {
    const draw = (readOnly: boolean) => <DocumentSession ref={first} initialValue={original} readOnly={readOnly} active font="serif" onChange={changed} onOutline={() => {}} onMode={() => {}} onError={failed} />;
    await act(async () => root.render(draw(true)));
    const before = first.current!.getMarkdown();
    await act(async () => { first.current!.selectAll(); first.current!.replaceSelection('lost'); first.current!.format('bold'); });
    expect(first.current!.getMarkdown()).toBe(before);
    await act(async () => root.render(draw(false)));
    await act(async () => { first.current!.selectAll(); first.current!.replaceSelection('new text'); });
    expect(first.current!.getMarkdown()).toContain('new text');
  });
  it('restores source cursor and mode after destroying and recreating a session', async () => {
    await act(async () => first.current!.setMode('source'));
    const view = sourceView();
    await act(async () => view.dispatch({ changes: { from: 2, insert: '恢复' }, selection: { anchor: 3, head: 6 } }));
    const snapshot = first.current!.snapshot();
    const markdown = first.current!.getMarkdown();
    await act(async () => root.render(null));
    await act(async () => root.render(<DocumentSession ref={first} initialSession={snapshot} initialValue={markdown} active font="serif" onChange={changed} onOutline={() => {}} onMode={() => {}} onError={failed} />));
    await settle();
    expect(first.current!.snapshot().mode).toBe('source');
    expect(first.current!.snapshot().source.cursor).toEqual({ anchor: 3, head: 6 });
    expect(first.current!.getMarkdown()).toBe(markdown);
  });

  it('applies preview highlight and table insertion with valid Markdown serialization', async () => {
    const editor = createRef<EditorHandle>();
    await act(async () => root.render(<MarkdownEditor ref={editor} initialValue="hello world" active onChange={changed} onReady={() => {}} onOutline={() => {}} onError={failed} />));
    await settle();
    await act(async () => { editor.current!.setCursor({ anchor: 1, head: 6 }); editor.current!.format('highlight'); });
    expect(editor.current!.getMarkdown()).toContain('==hello==');
    expect(host.querySelector('mark')?.textContent).toBe('hello');
    await act(async () => editor.current!.format('table'));
    expect(host.querySelectorAll('td').length).toBeGreaterThan(0);
    expect(failed).not.toHaveBeenCalled();
  });
  it('preserves exact Markdown across repeated view-only mode switches', async () => {
    for (let i = 0; i < 3; i++) {
      await act(async () => first.current!.setMode('source'));
      await act(async () => first.current!.setMode('preview'));
    }
    expect(first.current!.getMarkdown()).toBe(original);
    expect(changed).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it('retains the same views, source selection, scroll offset, and undo/redo while switching documents', async () => {
    await act(async () => first.current!.setMode('source'));
    const view = sourceView();
    const preview = host.querySelector('.ProseMirror');
    await act(async () => view.dispatch({ changes: { from: 2, insert: 'new ' }, selection: { anchor: 6, head: 9 } }));
    const scroller = host.querySelector<HTMLDivElement>('.source-scroll')!;
    scroller.scrollTop = 320;
    scroller.dispatchEvent(new Event('scroll'));
    await act(async () => render('second'));
    await settle();
    await act(async () => render('first'));
    await settle();
    expect(sourceView()).toBe(view);
    expect(host.querySelector('.ProseMirror')).toBe(preview);
    expect(view.state.selection.main.anchor).toBe(6);
    expect(view.state.selection.main.head).toBe(9);
    expect(scroller.scrollTop).toBe(320);
    await act(async () => { undo(view); });
    expect(first.current!.getMarkdown()).toBe(original);
    await act(async () => { redo(view); });
    expect(first.current!.getMarkdown()).toContain('# new Title');
  });

  it('syncs source edits to preview without resetting source history or dropping raw text', async () => {
    await act(async () => first.current!.setMode('source'));
    const view = sourceView();
    await act(async () => view.dispatch({ changes: { from: 2, to: 7, insert: '中文标题' } }));
    const before = first.current!.getMarkdown();
    await act(async () => first.current!.setMode('preview'));
    expect(host.querySelector('h1')?.textContent).toBe('中文标题');
    await act(async () => first.current!.setMode('source'));
    expect(first.current!.getMarkdown()).toBe(before);
    expect(undoDepth(view.state)).toBe(1);
    await act(async () => { undo(view); });
    expect(first.current!.getMarkdown()).toBe(original);
    expect(failed).not.toHaveBeenCalled();
  });

  it('preserves preview undo history after switching to a different document', async () => {
    await act(async () => first.current!.setMode('source'));
    await act(async () => sourceView().dispatch({ changes: { from: 2, to: 7, insert: 'Changed' } }));
    await act(async () => first.current!.setMode('preview'));
    await act(async () => render('second'));
    await act(async () => render('first'));
    const editor = host.querySelector<HTMLElement>('.ProseMirror')!;
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', keyCode: 90, ctrlKey: true, bubbles: true })));
    expect(host.querySelector('h1')?.textContent).toBe('Title');
    expect(first.current!.getMarkdown()).toBe(original);
    expect(second.current!.getMarkdown()).toBe('second');
    expect(failed).not.toHaveBeenCalled();
  });
});
