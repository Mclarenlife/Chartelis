import { t, useLanguage } from './i18n';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { findText, type SearchEditor } from './search';
import { StateEffect, StateField, EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, Decoration, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, historyKeymap, undo, redo, undoDepth, redoDepth, isolateHistory } from '@codemirror/commands';
import { defaultHighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language';
import { createSourceState, sourceReplacement, sourceHeadings } from './source-state';
import type { Heading } from './Editor';
import type { CursorState } from './workspace';
import { formatSource, type FormatAction, type FormatValue } from './formatting';
import { colorSource } from './text-color';
import { visualLineRange } from './focus-line';

const searchEffect = StateEffect.define<DecorationSet>();
const searchField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (value, tr) => tr.effects.find(effect => effect.is(searchEffect))?.value as DecorationSet ?? value.map(tr.changes),
  provide: field => EditorView.decorations.from(field),
});
const focusEffect = StateEffect.define<DecorationSet>();
const focusField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) { return tr.effects.find(effect => effect.is(focusEffect))?.value as DecorationSet ?? value.map(tr.changes); },
  provide: field => EditorView.decorations.from(field),
});

export interface SourceHandle extends SearchEditor { color(value: string): void; selectionText(): string; replaceSelection(text: string): void; selectAll(): void;
  getMarkdown(): string;
  replaceMarkdown(markdown: string): void;
  getHeadings(): Heading[];
  focus(): void;
  scrollTo(pos: number): void;
  getCursor(): CursorState; setCursor(cursor: CursorState): void; undo(): void; redo(): void; history(): { undo: boolean; redo: boolean }; format(action: FormatAction, value?: FormatValue): void;
}
interface Props { readOnly?: boolean; initialValue: string; focusMode?: boolean; active?: boolean; onState?(): void; onChange(markdown: string): void; onReady(): void }

const SourceEditor = forwardRef<SourceHandle, Props>(function SourceEditor(props, ref) {
  const mount = useRef<HTMLDivElement>(null);
  const instance = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const syncing = useRef(false);
  const editable = useRef(new Compartment());
  const localizedAttributes = useRef(new Compartment());
  const { resolved: language } = useLanguage();
  useEffect(() => { instance.current?.dispatch({ effects: localizedAttributes.current.reconfigure(EditorView.contentAttributes.of({ 'aria-label': t('Markdown 源码编辑器'), spellcheck: 'false' })) }); }, [language]);
  useEffect(() => { instance.current?.dispatch({ effects: editable.current.reconfigure(EditorState.readOnly.of(!!props.readOnly)) }); }, [props.readOnly]);
  const measure = useRef(() => {});
  useEffect(() => measure.current(), [props.focusMode, props.active]);
  useImperativeHandle(ref, () => ({
    color: value => {
      const view = instance.current; if (!view || callbacks.current.readOnly) return;
      const { from, to } = view.state.selection.main; const change = colorSource(view.state.doc.toString(), from, to, value);
      if (change) { view.dispatch({ changes: change, selection: { anchor: from, head: from + change.insert.length }, annotations: isolateHistory.of('full') }); view.focus(); }
    },
    selectionText: () => { const view = instance.current; return view ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to) : ''; },
    replaceSelection: text => { const view = instance.current; if (view && !callbacks.current.readOnly) { view.dispatch(view.state.replaceSelection(text), { annotations: isolateHistory.of('full'), scrollIntoView: true }); view.focus(); } },
    selectAll: () => { const view = instance.current; if (view) { view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } }); view.focus(); } },
    find: (query, sensitive) => findText(instance.current?.state.doc.toString() ?? '', query, sensitive),
    highlight: (matches, index, scroll) => {
      const view = instance.current; if (!view) return;
      view.dispatch({ effects: searchEffect.of(Decoration.set(matches.map((match, i) => Decoration.mark({ class: i === index ? 'search-hit search-current' : 'search-hit' }).range(match.from, match.to)))) });
      if (scroll && matches[index]) view.dispatch({ effects: EditorView.scrollIntoView(matches[index].from, { y: 'center' }) });
    },
    replaceMatches: (matches, text) => {
      const view = instance.current; if (!view || callbacks.current.readOnly || !matches.length) return;
      view.dispatch({ changes: matches.map(match => ({ ...match, insert: text })), annotations: isolateHistory.of('full') });
    },
    getCursor: () => { const selection = instance.current?.state.selection.main; return { anchor: selection?.anchor ?? 0, head: selection?.head ?? 0 }; },
    setCursor: cursor => { const view = instance.current; if (view) view.dispatch({ selection: { anchor: Math.min(view.state.doc.length, cursor.anchor), head: Math.min(view.state.doc.length, cursor.head) } }); },
    undo: () => { if (instance.current) { undo(instance.current); instance.current.focus(); } },
    redo: () => { if (instance.current) { redo(instance.current); instance.current.focus(); } },
    history: () => instance.current ? { undo: undoDepth(instance.current.state) > 0, redo: redoDepth(instance.current.state) > 0 } : { undo: false, redo: false },
    format: (action, value) => {
      const view = instance.current; if (!view || callbacks.current.readOnly) return;
      const selection = view.state.selection.main;
      const { from, to, insert, anchor, head } = formatSource(view.state.doc.toString(), selection.from, selection.to, action, value);
      view.dispatch({ changes: { from, to, insert }, selection: { anchor, head }, annotations: isolateHistory.of('full') }); view.focus();
    },
    getMarkdown: () => instance.current?.state.doc.toString() ?? callbacks.current.initialValue,
    replaceMarkdown(markdown) {
      const view = instance.current;
      if (!view) return;
      const change = sourceReplacement(view.state.doc.toString(), markdown.replace(/\r\n?/g, '\n'));
      if (!change) return;
      syncing.current = true;
      try { view.dispatch(change); } finally { syncing.current = false; }
    },
    getHeadings: () => instance.current ? sourceHeadings(instance.current.state) : [],
    focus: () => instance.current?.contentDOM.focus({ preventScroll: true }),
    scrollTo(pos) {
      const view = instance.current;
      if (!view) return;
      view.dispatch({ selection: { anchor: Math.min(pos, view.state.doc.length) }, scrollIntoView: true });
      view.focus();
    },
  }), []);
  useEffect(() => {
    let frame = 0, last = '';
    const base = createSourceState(props.initialValue);
    const state = base.update({ effects: StateEffect.appendConfig.of([
      editable.current.of(EditorState.readOnly.of(!!props.readOnly)), searchField,
      lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(), focusField,
      bracketMatching(), syntaxHighlighting(defaultHighlightStyle), EditorView.lineWrapping,
      keymap.of([{ key: 'Mod-Shift-z', run: redo }, ...historyKeymap, ...defaultKeymap]),
      localizedAttributes.current.of(EditorView.contentAttributes.of({ 'aria-label': t('Markdown 源码编辑器'), spellcheck: 'false' })),
      EditorView.updateListener.of(update => {
        if (update.docChanged && !syncing.current) callbacks.current.onChange(update.state.doc.toString());
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.geometryChanged) { callbacks.current.onState?.(); measure.current(); }
      }),
    ]) }).state;
    const view = new EditorView({ state, parent: mount.current! });
    instance.current = view;
    measure.current = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!view.dom.getClientRects().length) return;
        let from = 0, to = 0;
        if (callbacks.current.focusMode && callbacks.current.active) {
          const head = view.state.selection.main.head, line = view.state.doc.lineAt(head);
          try { ({ from, to } = visualLineRange(line.from, line.to, head, pos => view.coordsAtPos(pos) ?? { top: 0, bottom: 0 })); } catch { return; }
        }
        const signature = `${from}:${to}:${view.state.doc.length}:${callbacks.current.focusMode}`;
        if (signature === last) return; last = signature;
        view.dispatch({ effects: focusEffect.of(from < to ? Decoration.set([Decoration.mark({ class: 'focus-current' }).range(from, to)]) : Decoration.none) });
      });
    };
    const observer = new ResizeObserver(() => measure.current()); observer.observe(view.dom);
    measure.current();
    callbacks.current.onReady();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); measure.current = () => {}; instance.current = null; view.destroy(); };
  }, []);
  return <div className="source-editor" ref={mount} />;
});

export default SourceEditor;
