import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import MarkdownEditor, { type EditorHandle, type Heading } from './Editor';
import SourceEditor, { type SourceHandle } from './SourceEditor';
import { emptySession, type SessionSnapshot } from './workspace';
import type { FormatAction } from './formatting';
import FormatMenu, { LinkDialog } from './FormatMenu';
import SearchBar from './SearchBar';

export type EditorMode = 'preview' | 'source';
export interface SessionHandle { focus(): void; selectionText(): string; replaceSelection(text: string): void; selectAll(): void; format(action: FormatAction): void; search(): void; replaceMarkdown(text: string): void; getMarkdown(): string; setMode(mode: EditorMode): void; scrollTo(pos: number): void; snapshot(): SessionSnapshot; undo(): void; redo(): void; history(): { undo: boolean; redo: boolean } }
interface Props {
  initialValue: string; active: boolean; font: string;
  readOnly?: boolean; toolbar?: FormatAction[];
  initialSession?: SessionSnapshot; focusMode?: boolean; onState?(): void;
  onChange(markdown: string): void;
  onOutline(headings: Heading[]): void;
  onMode(mode: EditorMode): void;
  onError(message: string): void;
}

// Sessions live until their document is closed. Hiding a session never destroys its views.
const DocumentSession = forwardRef<SessionHandle, Props>(function DocumentSession(props, ref) {
  const initial = useRef(props.initialSession ?? emptySession());
  const [mode, setMode] = useState<EditorMode>(initial.current.mode);
  const [ready, setReady] = useState(false);
  const [sourceCreated, setSourceCreated] = useState(initial.current.mode === 'source');
  const modeRef = useRef<EditorMode>(initial.current.mode);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [linkDialog, setLinkDialog] = useState<'link' | 'image' | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchOpenRef = useRef(false);
  searchOpenRef.current = searchOpen;
  const [searchFocus, setSearchFocus] = useState(0);
  const [revision, setRevision] = useState(0);
  const closeMenu = useCallback(() => setMenu(null), []);
  const rich = useRef<EditorHandle>(null);
  const source = useRef<SourceHandle>(null);
  const canonical = useRef(props.initialValue);
  const richInput = useRef(props.initialValue);
  const richBaseline = useRef<string | null>(null);
  // Serializers normalize whitespace. Remember exact source at import boundaries so
  // undoing back to an imported state also returns the original bytes/dirty status.
  const richOrigins = useRef(new Map<string, string>());
  const sourceOrigins = useRef(new Map([[props.initialValue.replace(/\r\n?/g, '\n'), props.initialValue]]));
  const outline = useRef<Heading[]>([]);
  const scrolls = useRef({ preview: initial.current.preview.scroll, source: initial.current.source.scroll });
  const richScroll = useRef<HTMLDivElement>(null);
  const sourceScroll = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;

  const publishOutline = useCallback(() => {
    if (callbacks.current.active) callbacks.current.onOutline(modeRef.current === 'source' ? source.current?.getHeadings() ?? [] : outline.current);
  }, []);
  const searchEditor = useCallback(() => mode === 'source' ? source.current : rich.current, [mode]);
  const change = (markdown: string) => {
    setRevision(value => value + 1);
    canonical.current = markdown;
    callbacks.current.onChange(markdown);
  };
  const restore = useCallback(() => {
    const scroller = modeRef.current === 'source' ? sourceScroll.current : richScroll.current;
    if (!callbacks.current.active || !scroller) return;
    if (!document.querySelector('dialog[open]') && !searchOpenRef.current) (modeRef.current === 'source' ? source.current : rich.current)?.focus();
    scroller.scrollTop = scrolls.current[modeRef.current];
  }, []);

  const format = (action: FormatAction) => {
    if (callbacks.current.readOnly) return;
    if (action === 'link' || action === 'image') setLinkDialog(action);
    else (modeRef.current === 'source' ? source.current : rich.current)?.format(action);
  };
  useImperativeHandle(ref, () => ({
    focus: () => (modeRef.current === 'source' ? source.current : rich.current)?.focus(),
    selectionText: () => (modeRef.current === 'source' ? source.current : rich.current)?.selectionText() ?? '',
    replaceSelection: text => { if (!callbacks.current.readOnly) (modeRef.current === 'source' ? source.current : rich.current)?.replaceSelection(text); },
    selectAll: () => (modeRef.current === 'source' ? source.current : rich.current)?.selectAll(),
    format,
    search() { setSearchOpen(true); setSearchFocus(value => value + 1); },
    replaceMarkdown(text) { setRevision(value => value + 1); rich.current?.replaceMarkdown(text); source.current?.replaceMarkdown(text); canonical.current = text; richInput.current = text; richBaseline.current = rich.current?.getMarkdown() ?? text; richOrigins.current.set(richBaseline.current, text); sourceOrigins.current.set(text.replace(/\r\n?/g, '\n'), text); callbacks.current.onChange(text); publishOutline(); },
    snapshot: () => ({ mode: modeRef.current, preview: { cursor: rich.current?.getCursor() ?? initial.current.preview.cursor, scroll: scrolls.current.preview }, source: { cursor: source.current?.getCursor() ?? initial.current.source.cursor, scroll: scrolls.current.source } }),
    undo: () => !callbacks.current.readOnly && (modeRef.current === 'source' ? source.current : rich.current)?.undo(),
    redo: () => !callbacks.current.readOnly && (modeRef.current === 'source' ? source.current : rich.current)?.redo(),
    history: () => (modeRef.current === 'source' ? source.current : rich.current)?.history() ?? { undo: false, redo: false },
    getMarkdown: () => canonical.current,
    setMode(next) {
      if (next === modeRef.current || !ready) return;
      // Clicks normally commit composition before reaching here. Keyboard toggles ignore IME.
      const scroller = modeRef.current === 'source' ? sourceScroll.current : richScroll.current;
      if (scroller) scrolls.current[modeRef.current] = scroller.scrollTop;
      try {
        if (next === 'preview' && richInput.current !== canonical.current) {
          richBaseline.current = rich.current!.replaceMarkdown(canonical.current);
          richOrigins.current.set(richBaseline.current, canonical.current);
          richInput.current = canonical.current;
        }
        if (next === 'source') {
          sourceOrigins.current.set(canonical.current.replace(/\r\n?/g, '\n'), canonical.current);
          setSourceCreated(true);
          source.current?.replaceMarkdown(canonical.current);
        }
        modeRef.current = next;
        setMode(next);
        callbacks.current.onMode(next);
        callbacks.current.onState?.();
      } catch (error) { callbacks.current.onError(`切换模式失败：${String(error)}`); }
    },
    scrollTo: pos => (modeRef.current === 'source' ? source.current : rich.current)?.scrollTo(pos),
  }), [ready]);

  useLayoutEffect(() => {
    if (!props.active) return;
    closeMenu();
    callbacks.current.onMode(mode);
    publishOutline();
    const frame = requestAnimationFrame(() => { restore(); });
    return () => cancelAnimationFrame(frame);
  }, [props.active, mode, ready, restore, publishOutline]);

  return <section className={`document-session ${props.focusMode ? 'line-focus' : ''}`} hidden={!props.active} aria-label="文稿编辑区域" onContextMenu={event => {
    if (props.readOnly) return;
    if (!(event.target as HTMLElement).closest('[contenteditable]')) return;
    event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY });
  }}>
    {searchOpen && props.active && <SearchBar editor={searchEditor} revision={revision + Number(ready)} readOnly={props.readOnly} focusRequest={searchFocus} onClose={() => { setSearchOpen(false); searchEditor()?.highlight([], 0, false); (modeRef.current === 'source' ? source.current : rich.current)?.focus(); }} />}
    <div className="writing-scroll" hidden={mode !== 'preview'} ref={richScroll} onScroll={event => {
      if (props.active && mode === 'preview') { scrolls.current.preview = event.currentTarget.scrollTop; callbacks.current.onState?.(); }
    }}>
      <article className={`writing-page font-${props.font}`}>
        <MarkdownEditor ref={rich} initialValue={props.initialValue} active={props.active && mode === 'preview'}
          focusMode={props.focusMode} readOnly={props.readOnly} toolbar={props.toolbar} onFormat={format} onState={props.onState}
          onReady={markdown => { richBaseline.current = markdown; richOrigins.current.set(markdown, canonical.current); rich.current?.setCursor(initial.current.preview.cursor); setReady(true); }}
          onChange={markdown => {
            // A view-only round trip must not normalize the user's original Markdown.
            if (markdown !== richBaseline.current) {
              richBaseline.current = markdown;
              const value = richOrigins.current.get(markdown) ?? markdown;
              richInput.current = value;
              change(value);
            }
          }}
          onOutline={headings => { outline.current = headings; publishOutline(); }} onError={props.onError} />
      </article>
    </div>
    <div className="writing-scroll source-scroll" hidden={mode !== 'source'} ref={sourceScroll} onScroll={event => {
      if (props.active && mode === 'source') { scrolls.current.source = event.currentTarget.scrollTop; callbacks.current.onState?.(); }
    }}>
      {sourceCreated && <SourceEditor ref={source} initialValue={canonical.current}
        readOnly={props.readOnly} focusMode={props.focusMode} active={props.active && mode === 'source'} onState={props.onState}
        onReady={() => { source.current?.setCursor(initial.current.source.cursor); setRevision(value => value + 1); publishOutline(); requestAnimationFrame(restore); }}
        onChange={markdown => { change(sourceOrigins.current.get(markdown) ?? markdown); publishOutline(); }} />}
    </div>
    {menu && props.active && <FormatMenu {...menu} onClose={closeMenu} onSelect={action => { format(action); closeMenu(); }} />}
    {linkDialog && props.active && <LinkDialog action={linkDialog} onClose={() => setLinkDialog(null)} onInsert={value => { (modeRef.current === 'source' ? source.current : rich.current)?.format(linkDialog, value); setLinkDialog(null); }} />}
  </section>;
});

export default DocumentSession;
