import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx, parserCtx, editorViewOptionsCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { commonmark, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, wrapInHeadingCommand, wrapInBlockquoteCommand, wrapInBulletListCommand, wrapInOrderedListCommand, turnIntoTextCommand, createCodeBlockCommand, insertHrCommand } from '@milkdown/kit/preset/commonmark';
import { gfm, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { closeHistory, undo, redo, undoDepth, redoDepth } from '@milkdown/kit/prose/history';
import { toggleMark } from '@milkdown/kit/prose/commands';
import { $prose, callCommand, insert } from '@milkdown/kit/utils';
import { highlightMark, highlightRemark } from './highlight';
import { mathPlugins } from './math';
import { defaultToolbar } from './preferences';
import FormatToolbar from './FormatToolbar';
import { richFocus } from './rich-focus';
import { formatSource, type FormatAction, type FormatValue } from './formatting';
import type { CursorState } from './workspace';
import { Plugin, TextSelection, AllSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { AnimatePresence, motion } from 'motion/react';
import '@milkdown/kit/prose/view/style/prosemirror.css';

export interface Heading { text: string; level: number; pos: number }
export interface EditorHandle { selectionText(): string; replaceSelection(text: string): void; selectAll(): void; getMarkdown(): string; replaceMarkdown(markdown: string): string; focus(): void; scrollTo(pos: number): void;
  getCursor(): CursorState; setCursor(cursor: CursorState): void; undo(): void; redo(): void; history(): { undo: boolean; redo: boolean }; format(action: FormatAction, value?: FormatValue): void;
}
interface Props {
  initialValue: string;
  active: boolean;
  focusMode?: boolean; readOnly?: boolean; toolbar?: FormatAction[]; onFormat?(action: FormatAction): void;
  onState?(): void;
  onChange(markdown: string): void;
  onReady(markdown: string): void;
  onOutline(headings: Heading[]): void;
  onError(message: string): void;
}
interface SelectionBubble { x: number; y: number; marks: string[] }

const MarkdownEditor = forwardRef<EditorHandle, Props>(function MarkdownEditor(props, ref) {
  const mount = useRef<HTMLDivElement>(null);
  const instance = useRef<Editor | null>(null);
  const syncing = useRef(false);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [ready, setReady] = useState(false);
  const [bubble, setBubble] = useState<SelectionBubble | null>(null);
  useEffect(() => { instance.current?.action(ctx => { const view = ctx.get(editorViewCtx); view.dispatch(view.state.tr.setMeta('focus-refresh', true)); }); }, [props.focusMode, props.active, props.readOnly]);

  useImperativeHandle(ref, () => ({
    selectionText: () => instance.current?.action(ctx => { const view = ctx.get(editorViewCtx); return view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, '\n'); }) ?? '',
    replaceSelection: text => instance.current?.action(ctx => { if (callbacks.current.readOnly) return; const view = ctx.get(editorViewCtx); view.dispatch(closeHistory(view.state.tr).insertText(text)); view.focus(); }),
    selectAll: () => instance.current?.action(ctx => { const view = ctx.get(editorViewCtx); view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc))); view.focus(); }),
    getCursor: () => instance.current?.action(ctx => { const { anchor, head } = ctx.get(editorViewCtx).state.selection; return { anchor, head }; }) ?? { anchor: 0, head: 0 },
    setCursor: cursor => instance.current?.action(ctx => {
      const view = ctx.get(editorViewCtx), max = view.state.doc.content.size;
      const anchor = TextSelection.near(view.state.doc.resolve(Math.min(max, cursor.anchor))).anchor;
      const head = TextSelection.near(view.state.doc.resolve(Math.min(max, cursor.head))).head;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, head)));
    }),
    undo: () => instance.current?.action(ctx => { const view = ctx.get(editorViewCtx); if (!callbacks.current.readOnly) undo(view.state, view.dispatch); view.focus(); }),
    redo: () => instance.current?.action(ctx => { const view = ctx.get(editorViewCtx); if (!callbacks.current.readOnly) redo(view.state, view.dispatch); view.focus(); }),
    history: () => instance.current?.action(ctx => ({ undo: undoDepth(ctx.get(editorViewCtx).state) > 0, redo: redoDepth(ctx.get(editorViewCtx).state) > 0 })) ?? { undo: false, redo: false },
    format: (action, value) => instance.current?.action(ctx => {
      if (callbacks.current.readOnly) return;
      const view = ctx.get(editorViewCtx);
      const commands = { bold: toggleStrongCommand, italic: toggleEmphasisCommand, strike: toggleStrikethroughCommand, inlineCode: toggleInlineCodeCommand, quote: wrapInBlockquoteCommand, bullet: wrapInBulletListCommand, ordered: wrapInOrderedListCommand, paragraph: turnIntoTextCommand, code: createCodeBlockCommand, rule: insertHrCommand };
      if (action in commands) callCommand(commands[action as keyof typeof commands].key)(ctx);
      else if (/^h[1-6]$/.test(action)) callCommand(wrapInHeadingCommand.key, Number(action[1]))(ctx);
      else if (action === 'highlight') toggleMark(view.state.schema.marks.highlight)(view.state, view.dispatch);
      else {
        const selected = view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, '\n');
        const formatted = formatSource(selected, 0, selected.length, action, value);
        insert(formatted.insert, action === 'link')(ctx);
      }
      view.focus();
    }),
    getMarkdown: () => instance.current?.action(ctx => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc)) ?? callbacks.current.initialValue,
    replaceMarkdown: markdown => instance.current?.action(ctx => {
      const view = ctx.get(editorViewCtx);
      const next = ctx.get(parserCtx)(markdown.replace(/^\uFEFF/, ''));
      if (!next) throw new Error('无法解析 Markdown');
      const from = view.state.doc.content.findDiffStart(next.content);
      if (from !== null) {
        const end = view.state.doc.content.findDiffEnd(next.content)!;
        const overlap = Math.max(0, from - Math.min(end.a, end.b));
        syncing.current = true;
        try {
          view.dispatch(closeHistory(view.state.tr).replace(from, end.a + overlap, next.slice(from, end.b + overlap)));
          view.dispatch(closeHistory(view.state.tr));
        } finally { syncing.current = false; }
      }
      return ctx.get(serializerCtx)(view.state.doc);
    }) ?? markdown,
    focus: () => instance.current?.action(ctx => ctx.get(editorViewCtx).focus()),
    scrollTo: pos => instance.current?.action(ctx => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos))).scrollIntoView());
      view.focus();
    }),
  }), []);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const host = document.createElement('div');
    mount.current!.appendChild(host);
    const updateBubble = (view: EditorView) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (cancelled || view.isDestroyed) return;
        const { selection, doc } = view.state;
        if (!callbacks.current.active || selection.empty || !view.hasFocus() || view.composing || !(selection instanceof TextSelection)) {
          setBubble(null); return;
        }
        const start = view.coordsAtPos(selection.from);
        const end = view.coordsAtPos(selection.to);
        const scrollRect = host.closest('.writing-scroll')!.getBoundingClientRect();
        if (start.top < scrollRect.top + 8 || start.top > scrollRect.bottom) { setBubble(null); return; }
        const marks = Object.keys(view.state.schema.marks).filter(name => doc.rangeHasMark(selection.from, selection.to, view.state.schema.marks[name]));
        const halfWidth = Math.min((callbacks.current.toolbar ?? defaultToolbar).length * 41 + 9, window.innerWidth - 24) / 2 + 8;
        setBubble({ x: Math.max(halfWidth, Math.min(window.innerWidth - halfWidth, (start.left + end.right) / 2)), y: Math.max(scrollRect.top + 8, start.top - 54), marks });
      });
    };
    const updateOutline = (view: EditorView) => {
      const headings: Heading[] = [];
      view.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') headings.push({ text: node.textContent, level: node.attrs.level as number, pos });
      });
      callbacks.current.onOutline(headings);
    };
    const ui = $prose(() => new Plugin({
      props: {
        attributes: { 'aria-label': 'Markdown 编辑器', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'false' },
        decorations(state) {
          if (state.doc.childCount === 1 && state.doc.firstChild?.type.name === 'paragraph' && !state.doc.firstChild.content.size) {
            return DecorationSet.create(state.doc, [Decoration.node(0, state.doc.firstChild.nodeSize, { class: 'empty-editor', 'data-placeholder': '写下第一句话，让想法慢慢生长…' })]);
          }
          return DecorationSet.empty;
        },
        handleDOMEvents: {
          contextmenu: (view, event) => {
            if (view.state.selection.empty) {
              const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (hit) view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(hit.pos))));
            }
            return false;
          },
          blur: () => { if (!cancelled) setBubble(null); return false; },
          focus: view => { updateBubble(view); return false; },
          compositionstart: () => { setBubble(null); return false; },
        },
        handleClick: (_view, _pos, event) => !!(event.target as HTMLElement).closest('a'),
      },
      view: view => {
        const onScroll = () => updateBubble(view);
        window.addEventListener('resize', onScroll);
        document.addEventListener('scroll', onScroll, true);
        updateOutline(view);
        return {
          update(view, previous) {
            updateBubble(view);
            callbacks.current.onState?.();
            if (!previous.doc.eq(view.state.doc)) {
              updateOutline(view);
              // Deliver synchronously so a delayed callback cannot overwrite a mode switch.
              if (!syncing.current && instance.current) callbacks.current.onChange(instance.current.action(ctx => ctx.get(serializerCtx)(view.state.doc)));
            }
          },
          destroy() {
            window.removeEventListener('resize', onScroll);
            document.removeEventListener('scroll', onScroll, true);
          },
        };
      },
    }));
    const editor = Editor.make().config(ctx => {
      ctx.set(rootCtx, host);
      ctx.set(defaultValueCtx, props.initialValue.replace(/^\uFEFF/, ''));
      ctx.update(editorViewOptionsCtx, options => ({ ...options, editable: () => !cancelled && !callbacks.current.readOnly }));
      ctx.update(remarkStringifyOptionsCtx, options => ({ ...options, handlers: { ...options.handlers, highlight: (node: any, _parent: any, state: any, info: any) => '==' + state.containerPhrasing(node, info) + '==' } }));
    }).use(commonmark).use(gfm).use(history).use(clipboard).use(mathPlugins).use(highlightRemark).use(highlightMark).use(ui).use(richFocus(() => !!callbacks.current.focusMode && callbacks.current.active));

    const creation = editor.create().then(() => {
      if (cancelled) return;
      instance.current = editor;
      callbacks.current.onReady(editor.action(ctx => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc)));
      setReady(true);
    }).catch(error => {
      if (!cancelled) callbacks.current.onError(`编辑器加载失败：${String(error)}`);
    });
    return () => {
      cancelled = true;
      instance.current = null;
      cancelAnimationFrame(frame);
      host.remove();
      void creation.then(() => editor.destroy()).catch(() => {});
    };
  }, []);

  const actions = props.toolbar ?? defaultToolbar;

  return <>
    <div className={`editor-mount ${ready ? 'is-ready' : ''}`} ref={mount} />
    {!ready && <div className="editor-loading">正在铺开稿纸…</div>}
    <AnimatePresence>
      {bubble && props.active && !props.readOnly && actions.length > 0 && <motion.div className="floating-toolbar" style={{ left: bubble.x, top: bubble.y, x: '-50%' }} initial={{ opacity: 0, y: 5, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 3, scale: .98 }} transition={{ duration: .16 }}>
        <FormatToolbar actions={actions} marks={bubble.marks} onSelect={action => props.onFormat?.(action)} />
      </motion.div>}
    </AnimatePresence>
  </>;
});

export default MarkdownEditor;
