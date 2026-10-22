import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CircleHelp, FileText, FolderOpen, ScanLine, Moon, PanelLeftClose, PanelLeftOpen, Plus, Save, Search, Settings2, Sun, X, Undo2, Redo2, Download, Code2, Eye, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import AppMenu, { type MenuGroups } from './AppMenu';
import Settings from './Settings';
import { capturePreview } from './preview-export';
import { macDesktop } from './platform';
import CountSettings from './CountSettings';
import { writingThemes, writingColor, parseCount, countText, countLabels } from './writing-preferences';
import ReferenceSheet from './ReferenceSheet';
import CharacterSheet from './CharacterSheet';
import { chooseWorkspaceFolder, readWorkspaceFolder, openWorkspaceFile, type FolderView, type FolderLocation, type WorkspaceFile } from './folders';
import { readToolbar, documentExcerpt } from './preferences';
import { useTheme } from './useTheme';
import { usePlugins } from './usePlugins';
import { pluginThemeId, renderTemplate, runSelectionCommand, type PluginCommand, type PluginTemplate } from './plugins';
import { sameFilePath, useExternalFiles } from './external-files';
import { formatGroups } from './formatting';
import { readClipboard, writeClipboard } from './clipboard';
import type { Heading } from './Editor';
import DocumentSession, { type SessionHandle, type EditorMode } from './DocumentSession';
import { countCharacters, createDocument, isDirty, markSaved, storeDrafts, type DocumentEntry } from './document';
import { restoreWorkspace, storeWorkspace, emptySession } from './workspace';
import { desktop, isCancelled, openDocument, saveDocument, openPath, readDocument } from './files';

function Modal({ children, title, onClose }: { children: ReactNode; title: string; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current!; el.showModal(); return () => el.close(); }, []);
  return <dialog ref={dialog} className="modal" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <motion.div initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .2 }}>
      <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭对话框" onClick={onClose}><X size={18} /></button></div>
      {children}
    </motion.div>
  </dialog>;
}

function getPreference(key: string, fallback: string) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }

export default function App() {
  const [initialWorkspace] = useState(restoreWorkspace);
  const [docs, setDocs] = useState<DocumentEntry[]>(initialWorkspace.docs);
  const [activeId, setActiveId] = useState(initialWorkspace.activeId);
  const docsRef = useRef(docs);
  const activeRef = useRef(activeId);
  const sessions = useRef(new Map<string, SessionHandle>());
  const [editorMode, setEditorMode] = useState<EditorMode>('preview');
  const [sidebarOpen, setSidebarOpen] = useState(() => getPreference('chartelis.sidebar', 'true') === 'true');
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'outline'>('files');
  const [search, setSearch] = useState('');
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(() => docs.some(isDirty) ? { text: '已恢复上次工作区，未保存草稿已保留。' } : null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [modal, setModal] = useState<'settings' | 'help' | 'export' | 'markdown' | 'latex' | 'characters' | 'documents' | 'properties' | 'reload' | 'count' | null>(null);
  const [outlinePosition, setOutlinePosition] = useState(() => getPreference('chartelis.outline', 'left'));
  const [historyState, setHistoryState] = useState({ undo: false, redo: false });
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closeTarget, setCloseTarget] = useState<string | 'app' | null>(null);
  const [theme, setTheme] = useState(() => getPreference('chartelis.theme', 'system'));
  const plugins = usePlugins();
  const enabledPlugins = useMemo(() => plugins.plugins.filter(plugin => plugin.enabled).map(plugin => plugin.manifest), [plugins.plugins]);
  const pluginTheme = enabledPlugins.flatMap(plugin => plugin.themes.map(item => ({ key: pluginThemeId(plugin.id, item.id), theme: item }))).find(item => item.key === theme)?.theme;
  const { dark: darkTheme } = useTheme(theme, pluginTheme);
  useEffect(() => { if (theme.startsWith('plugin:') && !pluginTheme) setTheme('system'); }, [theme, pluginTheme]);
  const [font, setFont] = useState(() => getPreference('chartelis.font', 'serif'));
  const [fontSize, setFontSize] = useState(() => Number(getPreference('chartelis.fontSize', '17')) || 17);
  const [writingTheme, setWritingTheme] = useState(() => getPreference('chartelis.writingTheme', 'original'));
  const [ink, setInk] = useState(() => getPreference('chartelis.ink', 'auto'));
  const [countOptions, setCountOptions] = useState(() => parseCount(getPreference('chartelis.countOptions', '{}')));
  const typography = writingThemes.find(item => item.id === writingTheme) ?? writingThemes[0];
  const chooseWritingTheme = (id: string) => { const preset = writingThemes.find(item => item.id === id); if (preset) { setWritingTheme(id); setFont(preset.font); setFontSize(preset.size); setInk(preset.ink); } };
  const [listStyle, setListStyle] = useState(() => getPreference('chartelis.listStyle', 'compact'));
  const [toolbar, setToolbar] = useState(readToolbar);
  const [readOnly, setReadOnly] = useState(false);
  const [statusVisible, setStatusVisible] = useState(() => getPreference('chartelis.statusbar', 'true') === 'true');
  const [topbarVisible, setTopbarVisible] = useState(() => getPreference('chartelis.topbar', 'true') === 'true');
  const [fullscreen, setFullscreen] = useState(false);
  const [onTop, setOnTop] = useState(false);
  const [folder, setFolder] = useState<FolderView | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const folderBusyRef = useRef(false);
  const showSidebar = sidebarOpen && (!!folder || (sidebarTab === 'outline' && outlinePosition === 'left'));
  const [recent, setRecent] = useState<string[]>(() => { try { const value = JSON.parse(getPreference('chartelis.recent', '[]')); return Array.isArray(value) ? value.filter(path => typeof path === 'string').slice(0, 12) : []; } catch { return []; } });
  const [draftWarning, setDraftWarning] = useState(false);
  const active = docs.find(doc => doc.id === activeId)!;
  const documentCount = useMemo(() => countText(active.markdown, countOptions), [active.markdown, countOptions]);
  const modKey = navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl';

  const updateDocs = useCallback((update: (current: DocumentEntry[]) => DocumentEntry[]) => {
    const next = update(docsRef.current);
    docsRef.current = next;
    setDocs(next);
  }, []);
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  const externalError = useCallback((text: string) => notify(text, true), [notify]);
  const { paths: externalPaths, revision: externalRevision } = useExternalFiles(externalError);
  const flush = useCallback(() => {
    const markdown = sessions.current.get(activeRef.current)?.getMarkdown();
    if (markdown !== undefined) updateDocs(current => current.map(doc => doc.id === activeRef.current ? { ...doc, markdown } : doc));
  }, [updateDocs]);
  useEffect(() => {
    if (busyRef.current || !externalPaths.current.length) return;
    busyRef.current = true; setBusy(true);
    void (async () => {
      try {
        while (externalPaths.current.length) {
          const path = externalPaths.current.shift()!;
          try {
            let doc = docsRef.current.find(item => sameFilePath(item.path, path));
            if (!doc) {
              doc = await openPath(path);
              updateDocs(current => [...current, doc!]);
            }
            // Reopening an existing path selects its session and preserves drafts.
            flush();
            activeRef.current = doc.id; setActiveId(doc.id);
            setRecent(current => [path, ...current.filter(item => !sameFilePath(item, path))].slice(0, 12));
            setHeadings([]); setSearch(''); setSidebarTab('files');
          } catch (error) { notify(`打开失败：${String(error)}`, true); }
        }
      } finally { busyRef.current = false; setBusy(false); }
    })();
  }, [busy, externalRevision, externalPaths, flush, updateDocs, notify]);
  const persist = useCallback(() => {
    clearTimeout(persistTimer.current);
    try {
      storeWorkspace({ version: 1, activeId: activeRef.current, docs: docsRef.current,
        sessions: Object.fromEntries(docsRef.current.map(doc => [doc.id, sessions.current.get(doc.id)?.snapshot() ?? initialWorkspace.sessions[doc.id] ?? emptySession()])) });
      setDraftWarning(false); return true;
    } catch { setDraftWarning(true); return false; }
  }, [initialWorkspace]);
  const sessionChanged = useCallback(() => {
    const next = sessions.current.get(activeRef.current)?.history() ?? { undo: false, redo: false };
    setHistoryState(old => old.undo === next.undo && old.redo === next.redo ? old : next);
    clearTimeout(persistTimer.current); persistTimer.current = setTimeout(persist, 250);
  }, [persist]);
  useEffect(() => { sessionChanged(); }, [docs, activeId, editorMode, sessionChanged]);
  const exportFile = async (format: 'pdf' | 'png' | 'docx') => {
    if (busyRef.current) return;
    flush(); const snapshot = docsRef.current.find(doc => doc.id === activeRef.current)!;
    busyRef.current = true; setBusy(true);
    try {
      const preview = capturePreview(sessions.current.get(snapshot.id)?.previewHTML() ?? '', font);
      const { exportDocument } = await import('./export');
      if (await exportDocument(snapshot, format, preview)) { setModal(null); notify('文稿已导出'); }
    } catch (error) { if (!isCancelled(error)) notify(`导出失败：${String(error)}`, true); }
    finally { busyRef.current = false; setBusy(false); }
  };

  useEffect(() => {

    try {
      localStorage.setItem('chartelis.listStyle', listStyle);
      localStorage.setItem('chartelis.toolbar', JSON.stringify(toolbar));
      localStorage.setItem('chartelis.recent', JSON.stringify(recent));
      localStorage.setItem('chartelis.theme', theme);
      localStorage.setItem('chartelis.writingTheme', writingTheme);
      localStorage.setItem('chartelis.ink', ink);
      localStorage.setItem('chartelis.countOptions', JSON.stringify(countOptions));
      localStorage.setItem('chartelis.font', font);
      localStorage.setItem('chartelis.fontSize', String(fontSize));
      localStorage.setItem('chartelis.outline', outlinePosition);
      localStorage.setItem('chartelis.sidebar', String(sidebarOpen));
      localStorage.setItem('chartelis.topbar', String(topbarVisible));
      localStorage.setItem('chartelis.statusbar', String(statusVisible));
    } catch { /* Editing works without preference storage. */ }
  }, [writingTheme, ink, countOptions, theme, font, fontSize, outlinePosition, sidebarOpen, listStyle, toolbar, recent, topbarVisible, statusVisible]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 9000 : 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const title = `Chartelis - ${active.name}`;
    document.title = title;
    if (desktop) void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().setTitle(title)).catch(error => notify(`窗口标题更新失败：${String(error)}`, true));
  }, [active.name, notify]);
  const remember = (path?: string) => { if (path) setRecent(current => [path, ...current.filter(item => item !== path)].slice(0, 12)); };
  const switchDocument = (id: string) => {
    if (id === activeRef.current) return;
    flush();
    activeRef.current = id;
    setActiveId(id);
    setHeadings([]);
  };
  const newDocument = (template?: PluginTemplate) => {
    flush();
    const content = template ? renderTemplate(template) : null;
    const untitled = createDocument(content?.filename ?? `未命名${docsRef.current.filter(doc => doc.name.startsWith('未命名')).length + 1}.md`, content?.markdown ?? '');
    if (content) untitled.savedMarkdown = '';
    updateDocs(current => [...current, untitled]);
    activeRef.current = untitled.id;
    setActiveId(untitled.id);
    setHeadings([]);
    setSearch('');
    setSidebarTab('files');
  };
  const runPluginCommand = (pluginId: string, command: PluginCommand) => {
    if (readOnly || busyRef.current || !enabledPlugins.some(plugin => plugin.id === pluginId && plugin.commands.includes(command))) return;
    const session = sessions.current.get(activeRef.current);
    if (!session) return;
    try {
      const text = session.selectionText();
      const result = runSelectionCommand(command, text);
      if (text !== result) { session.replaceSelection(result); flush(); sessionChanged(); }
      notify(text === result ? '选中文字无需修改' : `已执行「${command.name}」，可撤销`);
    } catch (error) { notify(error instanceof Error ? error.message : '命令执行失败', true); }
  };
  const openFile = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    flush();
    try {
      const doc = await openDocument();
      if (!doc) return;
      remember(doc.path);
      const existing = docsRef.current.find(item => sameFilePath(item.path, doc.path));
      if (existing) { switchDocument(existing.id); return; }
      updateDocs(current => [...current, doc]);
      activeRef.current = doc.id; setActiveId(doc.id);
      setHeadings([]); setSearch(''); setSidebarTab('files');
      notify(`已打开 ${doc.name}`);
    } catch (error) { if (!isCancelled(error)) notify(`打开失败：${String(error)}`, true); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const saveFile = async (saveAs = false, id = activeRef.current) => {
    if (busyRef.current) return false;
    flush();
    const snapshot = docsRef.current.find(doc => doc.id === id);
    if (!snapshot) return false;
    busyRef.current = true; setBusy(true);
    try {
      const saved = await saveDocument(snapshot, saveAs);
      if (!saved) return false;
      if (saved.exported) { notify('已下载 Markdown 副本；请确认下载完成。草稿仍保留。'); return false; }
      flush();
      updateDocs(current => current.map(doc => doc.id === id ? markSaved(doc, snapshot.markdown, saved) : doc));
      remember(saved.path);
      notify('文稿已保存');
      return true;
    } catch (error) { if (!isCancelled(error)) notify(`保存失败：${String(error)}`, true); return false; }
    finally { busyRef.current = false; setBusy(false); }
  };
  const removeDocument = (id: string) => {
    const remaining = docsRef.current.filter(doc => doc.id !== id);
    if (!remaining.length) remaining.push(createDocument());
    updateDocs(() => remaining);
    if (activeRef.current === id) { activeRef.current = remaining[0].id; setActiveId(remaining[0].id); setHeadings([]); }
  };
  const closeDocument = (id: string) => {
    if (busyRef.current) return;
    flush();
    const doc = docsRef.current.find(doc => doc.id === id)!;
    if (isDirty(doc)) setCloseTarget(id); else removeDocument(id);
  };
  const finishClose = async (saveFirst: boolean) => {
    const target = closeTarget;
    if (!target || busyRef.current) return;
    if (saveFirst) {
      const ids = target === 'app' ? docsRef.current.filter(isDirty).map(doc => doc.id) : [target];
      for (const id of ids) if (!(await saveFile(false, id))) return;
      // The editor remains usable during an asynchronous save. Never discard newer edits.
      if (docsRef.current.some(doc => (target === 'app' || doc.id === target) && isDirty(doc))) return;
    }
    if (target === 'app') {
      if (!saveFirst) { try { storeDrafts([]); } catch { /* closing explicitly discards */ } }
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().destroy();
    } else removeDocument(target);
    setCloseTarget(null);
  };
  const guard = async (action: () => Promise<unknown>) => { try { await action(); } catch (error) { if (!isCancelled(error)) notify(String(error), true); } };
  const openRecent = (path: string) => guard(async () => {
    if (busyRef.current) return;
    const existing = docsRef.current.find(doc => sameFilePath(doc.path, path));
    if (existing) { switchDocument(existing.id); setModal(null); return; }
    busyRef.current = true; setBusy(true);
    try { const doc = await openPath(path); flush(); updateDocs(current => [...current, doc]); activeRef.current = doc.id; setActiveId(doc.id); setHeadings([]); remember(path); setModal(null); setSidebarTab('files'); setSearch(''); }
    finally { busyRef.current = false; setBusy(false); }
  });
  const browseFolder = (trail?: FolderLocation[]) => guard(async () => {
    if (folderBusyRef.current) return;
    folderBusyRef.current = true; setFolderBusy(true);
    try {
      const location = trail ? null : await chooseWorkspaceFolder();
      if (!trail && !location) return;
      const next = await readWorkspaceFolder(trail ?? [location!]);
      setFolder(next); setSidebarOpen(true); setSidebarTab('files'); setSearch('');
    } finally { folderBusyRef.current = false; setFolderBusy(false); }
  });
  const openFolder = () => browseFolder();
  const openFolderItem = (item: WorkspaceFile) => {
    if (item.directory) { void browseFolder([...folder!.trail, { name: item.name, path: item.path, handle: item.folder }]); return; }
    if (item.path) { void openRecent(item.path); return; }
    void guard(async () => {
      if (busyRef.current) return;
      busyRef.current = true; setBusy(true);
      try {
        let existing = docsRef.current.find(doc => doc.handle === item.file);
        if (!existing && item.file) for (const doc of docsRef.current) {
          const handle = doc.handle as (typeof item.file & { isSameEntry?(other: typeof item.file): Promise<boolean> }) | undefined;
          if (handle?.isSameEntry && await handle.isSameEntry(item.file)) { existing = doc; break; }
        }
        if (existing) { switchDocument(existing.id); return; }
        const doc = await openWorkspaceFile(item); flush(); updateDocs(current => [...current, doc]);
        activeRef.current = doc.id; setActiveId(doc.id); setHeadings([]);
      } finally { busyRef.current = false; setBusy(false); }
    });
  };
  const reload = () => guard(async () => {
    const target = docsRef.current.find(doc => doc.id === activeRef.current)!;
    const baseline = target.markdown;
    const text = await readDocument(target);
    if (!docsRef.current.some(doc => doc.id === target.id && doc.markdown === baseline)) throw new Error('读取期间文稿已改变，请重新载入');
    // Keep the prior content in the session undo history.
    sessions.current.get(target.id)?.replaceMarkdown(text);
    const decoded = createDocument(target.name, text);
    updateDocs(current => current.map(doc => doc.id === target.id ? { ...doc, markdown: text, savedMarkdown: text, diskContent: text, bom: decoded.bom, lineEnding: decoded.lineEnding } : doc));
    setModal(null); notify('已从磁盘重新载入，可撤销此次替换');
  });
  const clipboard = (action: 'copy' | 'cut' | 'paste' | 'markdown' | 'html') => guard(async () => {
    const session = sessions.current.get(activeRef.current); if (!session) return;
    const cursor = session.snapshot();
    if (action === 'paste') {
      const text = await readClipboard();
      if (session !== sessions.current.get(activeRef.current) || JSON.stringify(cursor) !== JSON.stringify(session.snapshot())) throw new Error('插入位置已改变，请重新粘贴');
      session.replaceSelection(text); return;
    }
    let text = action === 'markdown' || action === 'html' ? session.getMarkdown() : session.selectionText();
    if (action === 'html') text = await (await import('./export')).markdownHtml(text);
    await writeClipboard(text);
    if (action === 'cut' && session === sessions.current.get(activeRef.current) && JSON.stringify(cursor) === JSON.stringify(session.snapshot())) session.replaceSelection('');
  });
  const toggleFullscreen = () => guard(async () => {
    if (desktop) { const win = (await import('@tauri-apps/api/window')).getCurrentWindow(); const next = !(await win.isFullscreen()); await win.setFullscreen(next); setFullscreen(next); }
    else if (document.fullscreenElement) { await document.exitFullscreen(); setFullscreen(false); } else { await document.documentElement.requestFullscreen(); setFullscreen(true); }
  });
  const menus: MenuGroups = {
    文件: [
      { label: '新建文稿', shortcut: `${modKey} N`, action: newDocument },
      { label: '从模板新建', disabled: busy || !enabledPlugins.some(plugin => plugin.templates.length), children: enabledPlugins.flatMap(plugin => plugin.templates.map(template => ({ label: `${template.name} · ${plugin.name}`, action: () => newDocument(template) }))) },
      { label: '打开…', shortcut: `${modKey} O`, action: () => void openFile(), disabled: busy },
      { label: '打开文件夹…', action: () => void openFolder(), disabled: busy || folderBusy },
      ...(folder ? [{ label: '关闭文件夹', disabled: folderBusy, action: () => { setFolder(null); setSidebarTab('files'); } }] : []),
      { label: '快速打开…', shortcut: `${modKey} P`, action: () => { setSearch(''); setModal('documents'); } },
      ...(desktop ? [{ label: '打开最近文件', disabled: !recent.length, children: recent.map(path => ({ label: path, action: () => void openRecent(path) })) }] : []),
      { label: '从磁盘重新加载', action: () => { flush(); if (isDirty(docsRef.current.find(doc => doc.id === activeId)!)) setModal('reload'); else void reload(); }, disabled: busy || !active.path && !active.handle, separator: true },
      { label: '保存', shortcut: `${modKey} S`, action: () => void saveFile(), disabled: busy },
      { label: '另存为…', shortcut: `${modKey} Shift S`, action: () => void saveFile(true), disabled: busy },
      { label: '保存全部打开的文稿', action: () => void guard(async () => { flush(); for (const doc of [...docsRef.current]) if (isDirty(doc) || !doc.path && !doc.handle) if (!await saveFile(false, doc.id)) break; }), disabled: busy },
      { label: '文稿属性 / 字数统计', action: () => setModal('properties'), separator: true },
      { label: '导出', children: [['pdf', 'PDF 文档'], ['png', 'PNG 图片'], ['docx', 'Word 文档']].map(([id, label]) => ({ label, action: () => void exportFile(id as 'pdf' | 'png' | 'docx'), disabled: busy })) },
      { label: '偏好设置', shortcut: `${modKey} ,`, action: () => setModal('settings'), separator: true },
      { label: '关闭当前文稿', shortcut: `${modKey} W`, action: () => closeDocument(activeId), disabled: busy },
    ],
    编辑: [
      { label: '撤销', shortcut: `${modKey} Z`, action: () => sessions.current.get(activeId)?.undo(), disabled: readOnly || !historyState.undo },
      { label: '重做', shortcut: `${modKey} Shift Z`, action: () => sessions.current.get(activeId)?.redo(), disabled: readOnly || !historyState.redo },
      { label: '剪切', shortcut: `${modKey} X`, action: () => void clipboard('cut'), disabled: readOnly, separator: true },
      { label: '复制纯文本', shortcut: `${modKey} C`, action: () => void clipboard('copy') },
      { label: '粘贴纯文本', shortcut: `${modKey} Shift V`, action: () => void clipboard('paste'), disabled: readOnly },
      { label: '复制全文 Markdown', action: () => void clipboard('markdown') },
      { label: '复制全文 HTML', action: () => void clipboard('html') },
      { label: '全选', shortcut: `${modKey} A`, action: () => sessions.current.get(activeId)?.selectAll(), separator: true },
      { label: '删除选中内容', action: () => sessions.current.get(activeId)?.replaceSelection(''), disabled: readOnly },
      { label: '插件选区命令', disabled: readOnly || busy || !enabledPlugins.some(plugin => plugin.commands.length), children: enabledPlugins.flatMap(plugin => plugin.commands.map(command => ({ label: `${command.name} · ${plugin.name}`, action: () => runPluginCommand(plugin.id, command) }))) },
      ...formatGroups.map(group => ({ label: group.label === '插入' ? '插入 / 数学工具' : group.label, separator: group.label === '文字', children: group.items.map(([id, label]) => ({ label, action: () => sessions.current.get(activeId)?.format(id), disabled: readOnly })) })),
      { label: '查找和替换', shortcut: `${modKey} F`, action: () => sessions.current.get(activeId)?.search(), separator: true },
    ],
    视图: [
      { label: '显示侧栏', checked: showSidebar, disabled: !folder && (sidebarTab !== 'outline' || outlinePosition !== 'left'), shortcut: `${modKey} \\`, action: () => setSidebarOpen(value => !value) },
      { label: '文稿列表', disabled: !folder, action: () => { setSidebarOpen(true); setSidebarTab('files'); } },
      { label: '大纲', action: () => { if (outlinePosition === 'left') { setSidebarOpen(true); setSidebarTab('outline'); } } },
      { label: '源码模式', checked: editorMode === 'source', shortcut: `${modKey} Shift M`, action: () => sessions.current.get(activeId)?.setMode(editorMode === 'source' ? 'preview' : 'source'), separator: true },
      { label: '只读模式', checked: readOnly, action: () => setReadOnly(value => !value) },
      { label: '专注模式', checked: focusMode, shortcut: `${modKey} Shift F`, action: () => setFocusMode(value => !value) },
      { label: '显示顶栏', checked: topbarVisible, action: () => setTopbarVisible(value => !value), separator: true },
      { label: '显示状态栏', checked: statusVisible, action: () => setStatusVisible(value => !value) },
      { label: '定制浮动工具栏…', action: () => setModal('settings') },
      { label: '切换全屏', checked: fullscreen, action: () => void toggleFullscreen() },
      ...(desktop ? [{ label: '窗口保持最前', checked: onTop, action: () => void guard(async () => { await (await import('@tauri-apps/api/window')).getCurrentWindow().setAlwaysOnTop(!onTop); setOnTop(!onTop); }) }] : []),
      { label: '放大文字', action: () => setFontSize(value => Math.min(28, value + 1)), separator: true },
      { label: '缩小文字', action: () => setFontSize(value => Math.max(13, value - 1)) },
      { label: '恢复默认字号', action: () => setFontSize(17) },
    ],
    帮助: [
      { label: 'Markdown 语法表', action: () => setModal('markdown') },
      { label: 'LaTeX 语法表', action: () => setModal('latex') },
      { label: '字符表', action: () => setModal('characters') },
      { label: '快捷键与关于', action: () => setModal('help'), separator: true },
    ],
  };
  const handlers = useRef({ openFile, newDocument, saveFile, flush, persist, closeDocument, searchDocument: () => sessions.current.get(activeRef.current)?.search() });
  handlers.current = { openFile, newDocument, saveFile, flush, persist, closeDocument, searchDocument: () => sessions.current.get(activeRef.current)?.search() };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') { setFocusMode(false); return; }
      if (!(event.ctrlKey || event.metaKey) || document.querySelector('dialog[open]')) return;
      switch (event.key.toLowerCase()) {
        case 's': event.preventDefault(); void handlers.current.saveFile(event.shiftKey); break;
        case 'o': event.preventDefault(); void handlers.current.openFile(); break;
        case 'n': event.preventDefault(); handlers.current.newDocument(); break;
        case '\\': event.preventDefault(); setSidebarOpen(value => !value); break;
        case 'f': event.preventDefault(); if (event.shiftKey) setFocusMode(value => !value); else handlers.current.searchDocument(); break;
        case ',': event.preventDefault(); setModal('settings'); break;
        case 'w': event.preventDefault(); handlers.current.closeDocument(activeRef.current); break;
        case 'p': event.preventDefault(); setSearch(''); setModal('documents'); break;
        case '/': event.preventDefault(); setModal('help'); break;
        case 'm': if (event.shiftKey) { event.preventDefault(); document.querySelector<HTMLButtonElement>('.mode-toggle')?.click(); } break;
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      handlers.current.flush();
      if (!handlers.current.persist() && docsRef.current.some(isDirty)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('keydown', keydown);
    if (!desktop) window.addEventListener('beforeunload', beforeUnload);
    let dispose: (() => void) | undefined;
    let disposed = false;
    if (desktop) void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const unlisten = await getCurrentWindow().onCloseRequested(event => {
        handlers.current.flush();
        const persisted = handlers.current.persist();
        if (busyRef.current || !persisted) { event.preventDefault(); setCloseTarget('app'); }
      });
      if (disposed) unlisten(); else dispose = unlisten;
    }).catch(error => notify(`窗口关闭保护未能启用：${String(error)}`, true));
    return () => {
      disposed = true; dispose?.();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [notify]);

  return <div className={`app ${macDesktop ? 'mac-desktop' : ''} ${focusMode ? 'focus-mode' : ''}`} style={{ '--editor-font-size': `${fontSize}px`, '--writing-color': writingColor(ink, darkTheme), '--writing-line': typography.line, '--writing-spacing': typography.spacing } as React.CSSProperties}>
      {macDesktop && !topbarVisible && <div className="mac-window-strip" data-tauri-drag-region><button className="icon-button" aria-label="展开顶栏" title="展开顶栏" onClick={() => setTopbarVisible(true)}><ChevronDown size={17} /></button></div>}
      <header className="topbar" hidden={!topbarVisible} data-tauri-drag-region={macDesktop ? true : undefined}>
        <div className="topbar-left" data-tauri-drag-region={macDesktop ? true : undefined}>          <div className="brand" data-tauri-drag-region={macDesktop ? true : undefined}><img src="/icon.png" alt="Chartelis 图标" draggable={false} data-tauri-drag-region={macDesktop ? true : undefined} /><span className="brand-name" data-tauri-drag-region={macDesktop ? true : undefined}>Chartelis<span className="brand-dot" data-tauri-drag-region={macDesktop ? true : undefined}>.</span></span><button className="icon-button brand-settings" aria-label="设置" title="设置" onClick={() => setModal('settings')}><Settings2 size={16} /></button></div>
          <AppMenu groups={menus} />
<button className="icon-button" aria-label="撤销" title={`撤销 · ${modKey} Z`} disabled={readOnly || !historyState.undo} onMouseDown={event => event.preventDefault()} onClick={() => sessions.current.get(activeId)?.undo()}><Undo2 size={18} /></button><button className="icon-button" aria-label="重做" title={`重做 · ${modKey} Shift Z`} disabled={readOnly || !historyState.redo} onMouseDown={event => event.preventDefault()} onClick={() => sessions.current.get(activeId)?.redo()}><Redo2 size={18} /></button></div>
        <div className="topbar-actions"><span className="save-state">{busy ? '处理中…' : isDirty(active) ? '尚未保存' : active.path || active.handle ? '已保存' : '本地草稿'}</span><button className="save-button" onClick={() => void saveFile()} disabled={busy} title={`保存 · ${modKey} S`}><Save size={15} /><span>保存</span></button><button className="icon-button" aria-label="导出文稿" title="导出 PDF、图片、Word" onClick={() => setModal('export')} disabled={busy}><Download size={17} /></button><span className="topbar-separator" /><button className={`icon-button ${focusMode ? 'is-active' : ''}`} aria-label={focusMode ? '退出专注模式' : '专注模式'} title={`专注模式 · ${modKey} Shift F`} onClick={() => setFocusMode(value => !value)}><ScanLine size={18} /></button><button className="icon-button" aria-label={darkTheme ? '切换浅色主题' : '切换深色主题'} onClick={() => setTheme(darkTheme ? 'light' : 'dark')}>{darkTheme ? <Sun size={18} /> : <Moon size={17} />}</button><button className="icon-button" aria-label="收起顶栏" title="收起顶栏" onClick={() => setTopbarVisible(false)}><ChevronUp size={17} /></button></div>
      </header>
    <div className="workspace-layout">
    <AnimatePresence initial={false}>
      {showSidebar && <motion.aside className="sidebar" initial={{ width: 0, opacity: 0 }} animate={{ width: 254, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
        <div className="sidebar-inner">
          <div className="sidebar-tabs" role="tablist" aria-label="侧栏内容">
            {((outlinePosition === 'right' ? ['files'] : folder ? ['files', 'outline'] : ['outline']) as ('files' | 'outline')[]).map(tab => <button key={tab} role="tab" aria-selected={sidebarTab === tab} onClick={() => setSidebarTab(tab)} className={sidebarTab === tab ? 'selected' : ''}>{tab === 'files' ? '文稿' : '大纲'}{sidebarTab === tab && <motion.span layoutId="sidebar-tab" className="tab-underline" />}</button>)}
            <span className="tab-count">{sidebarTab === 'files' ? docs.length : headings.length}</span>
          </div>
          {folder && (sidebarTab === 'files' || outlinePosition === 'right') ? <>
            <div className="workspace-folder-heading"><FolderOpen size={15} /><span title={folder.trail.map(item => item.name).join(' / ')}>{folder.trail.at(-1)?.name}</span><button className="icon-button" aria-label="刷新文件夹" disabled={folderBusy} onClick={() => void browseFolder(folder.trail)}><RefreshCw size={14} /></button></div>
            {folder.trail.length > 1 && <button className="folder-back" disabled={folderBusy} onClick={() => void browseFolder(folder.trail.slice(0, -1))}>返回上一级</button>}
            <nav className="workspace-folder-files" aria-label="文件夹中的文稿">{folder.items.map(item => <button key={item.key} disabled={folderBusy || busy} onClick={() => openFolderItem(item)} title={item.name}>{item.directory ? <FolderOpen size={15} /> : <FileText size={15} />}<span>{item.name}</span></button>)}{!folder.items.length && <p className="sidebar-empty">此文件夹没有 Markdown 文稿</p>}</nav>
            <div className="opened-documents-label">已打开的文稿</div>
            <label className="search"><Search size={14} /><input aria-label="搜索已打开的文稿" placeholder="查找文稿…" value={search} onChange={event => setSearch(event.target.value)} />{search && <button aria-label="清除搜索" onClick={() => setSearch('')}><X size={12} /></button>}</label>
            <div className={`document-list ${listStyle}`}>
              {docs.filter(doc => doc.name.toLowerCase().includes(search.toLowerCase())).map(doc => <div key={doc.id} className={`document-item ${doc.id === activeId ? 'current' : ''}`}>
                <button className="document-select" onClick={() => switchDocument(doc.id)} title={doc.path || doc.name} aria-current={doc.id === activeId ? 'page' : undefined}><FileText size={16} strokeWidth={1.5} /><span className="document-copy"><span className="document-name">{doc.name.replace(/\.(md|markdown|mdown)$/i, '')}</span>{listStyle === 'detailed' && <span className="document-excerpt">{documentExcerpt(doc.markdown) || '空白文稿'}</span>}</span>{isDirty(doc) && <i className="dirty-dot" aria-label="未保存" />}</button>
                <button className="document-close" aria-label={`关闭 ${doc.name}`} onClick={() => closeDocument(doc.id)} disabled={busy}><X size={13} /></button>
              </div>)}
              {!docs.some(doc => doc.name.toLowerCase().includes(search.toLowerCase())) && <p className="sidebar-empty">没有找到这篇文稿</p>}
            </div>
          </> : <nav className="outline" aria-label="文稿大纲">{headings.length ? headings.map((heading, i) => <button key={`${heading.pos}-${i}`} style={{ paddingLeft: 14 + (heading.level - 1) * 12 }} onClick={() => sessions.current.get(activeId)?.scrollTo(heading.pos)}><span className="outline-marker">{heading.level === 1 ? '◦' : '—'}</span><span>{heading.text || '未命名标题'}</span></button>) : <p className="sidebar-empty">写下一个标题，<br />思路就会在这里展开。</p>}</nav>}

        </div>
      </motion.aside>}
    </AnimatePresence>

    <main className="main-panel">
      {!topbarVisible && !macDesktop && <button className="restore-bar restore-top" aria-label="展开顶栏" title="展开顶栏" onClick={() => setTopbarVisible(true)}><ChevronDown size={17} /></button>}
      {!statusVisible && <button className="restore-bar restore-bottom" aria-label="展开底栏" title="展开底栏" onClick={() => setStatusVisible(true)}><ChevronUp size={17} /></button>}


      <div className="editor-body"><div className="session-stack">
      {docs.map(doc => <DocumentSession key={doc.id} ref={session => { if (session) sessions.current.set(doc.id, session); else sessions.current.delete(doc.id); }}
        initialValue={doc.markdown} initialSession={initialWorkspace.sessions[doc.id]} active={activeId === doc.id} font={font} readOnly={readOnly} toolbar={toolbar} focusMode={focusMode} onState={sessionChanged}
        onChange={markdown => updateDocs(current => current.map(item => item.id === doc.id ? { ...item, markdown } : item))}
        onOutline={setHeadings} onMode={setEditorMode} onError={message => notify(message, true)} />)}

      </div>{outlinePosition === 'right' && <aside className="right-outline"><div className="right-outline-title">文稿大纲 <span>{headings.length}</span></div><nav className="outline" aria-label="右侧文稿大纲">{headings.map((heading, i) => <button key={i} style={{ paddingLeft: 12 + (heading.level - 1) * 10 }} onClick={() => sessions.current.get(activeId)?.scrollTo(heading.pos)}>{heading.text || '未命名标题'}</button>)}{!headings.length && <p className="sidebar-empty">暂无标题</p>}</nav></aside>}</div>
      <footer className="statusbar" hidden={!statusVisible}><div><button className="icon-button" disabled={!folder && (sidebarTab !== 'outline' || outlinePosition !== 'left')} aria-label={showSidebar ? '收起侧栏' : '展开侧栏'} title={`切换侧栏 · ${modKey} \\`} onClick={() => setSidebarOpen(value => !value)}>{showSidebar ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}</button><button className="mode-toggle" aria-label={editorMode === 'source' ? '切换为即时预览' : '切换为 Markdown 源码'} title={`切换编辑模式 · ${modKey} Shift M`} onClick={() => sessions.current.get(activeId)?.setMode(editorMode === 'source' ? 'preview' : 'source')}>{editorMode === 'source' ? <Code2 size={15} /> : <Eye size={15} />}<span>{editorMode === 'source' ? 'Markdown 源码' : '即时预览'}</span></button>{draftWarning && <span className="cache-warning">工作区缓存失败，请及时保存</span>}</div><div>{readOnly && <span>只读</span>}<button className="word-count-button" aria-label="字数统计设置" title="设置统计方式" onClick={() => setModal('count')}>{documentCount.toLocaleString()} {countLabels[countOptions.mode]}</button><span className="status-dot">·</span><span>UTF-8</span></div></footer>
    </main>
    </div>

    <AnimatePresence>{toast && <motion.div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>{toast.error ? <CircleHelp size={16} /> : <Check size={16} />}<span>{toast.text}</span><button aria-label="关闭提示" onClick={() => setToast(null)}><X size={14} /></button></motion.div>}</AnimatePresence>

    {modal === 'count' && <Modal title="字数统计" onClose={() => setModal(null)}><CountSettings options={countOptions} onChange={setCountOptions} markdown={active.markdown} /></Modal>}
    {modal === 'settings' && <Modal title="设置" onClose={() => setModal(null)}><Settings writingTheme={writingTheme} setWritingTheme={chooseWritingTheme} ink={ink} setInk={setInk} dark={darkTheme} plugins={plugins} theme={theme} setTheme={setTheme} font={font} setFont={setFont} fontSize={fontSize} setFontSize={setFontSize} outline={outlinePosition} setOutline={value => { setOutlinePosition(value); setSidebarTab('files'); }} listStyle={listStyle} setListStyle={setListStyle} toolbar={toolbar} setToolbar={setToolbar} /></Modal>}
    {(modal === 'markdown' || modal === 'latex') && <Modal title={modal === 'markdown' ? 'Markdown 语法表' : 'LaTeX 语法表'} onClose={() => setModal(null)}><ReferenceSheet type={modal} /></Modal>}
    {modal === 'properties' && <Modal title="文稿属性" onClose={() => setModal(null)}><dl className="document-properties"><dt>名称</dt><dd>{active.name}</dd><dt>位置</dt><dd>{active.path || '本地草稿'}</dd><dt>字数</dt><dd>{countCharacters(active.markdown)}</dd><dt>源码行数</dt><dd>{active.markdown.split('\n').length}</dd><dt>编码 / 换行</dt><dd>UTF-8{active.bom ? ' BOM' : ''} / {active.lineEnding === '\r\n' ? 'CRLF' : 'LF'}</dd><dt>保存状态</dt><dd>{isDirty(active) ? '有未保存修改' : '无未保存修改'}</dd></dl></Modal>}
    {modal === 'characters' && <Modal title="字符表" onClose={() => setModal(null)}><CharacterSheet readOnly={readOnly} onInsert={value => { if (!readOnly) { const session = sessions.current.get(activeRef.current); session?.replaceSelection(value); setModal(null); requestAnimationFrame(() => session?.focus()); } }} /></Modal>}
    {modal === 'documents' && <Modal title="已打开的文稿" onClose={() => setModal(null)}><label className="search"><Search size={14} /><input autoFocus aria-label="快速查找文稿" placeholder="查找文稿…" value={search} onChange={event => setSearch(event.target.value)} /></label><div className="quick-documents">{docs.filter(doc => doc.name.toLowerCase().includes(search.toLowerCase())).map(doc => <button key={doc.id} onClick={() => { switchDocument(doc.id); setModal(null); }}><FileText size={16} /><span>{doc.name}</span>{isDirty(doc) && <i className="dirty-dot" aria-label="未保存" />}</button>)}</div></Modal>}
    {modal === 'reload' && <Modal title="从磁盘重新加载？" onClose={() => setModal(null)}><p>当前文稿有未保存修改。重新加载会替换编辑内容，此操作可撤销。</p><div className="modal-actions"><button className="secondary-button" onClick={() => setModal(null)}>取消</button><button className="primary-button" onClick={() => void reload()}>重新加载</button></div></Modal>}
    {modal === 'help' && <Modal title="让书写，顺手一点" onClose={() => setModal(null)}><p className="modal-description">使用 Markdown 语法，或选中文字唤出工具栏。</p><div className="shortcut-list">{[['新建文稿', `${modKey} N`], ['打开文稿', `${modKey} O`], ['保存', `${modKey} S`], ['另存为', `${modKey} Shift S`], ['切换侧栏', `${modKey} \\`], ['专注模式', `${modKey} Shift F`], ['加粗 / 斜体（预览）', `${modKey} B / I`], ['切换编辑模式', `${modKey} Shift M`], ['撤销', `${modKey} Z`], ['重做', `${modKey} Shift Z`]].map(([label, keys]) => <div key={label}><span>{label}</span><kbd>{keys}</kbd></div>)}</div><p className="settings-note">输入 # + 空格创建标题，&gt; + 空格创建引用。<br />未保存的修改会缓存为本地恢复草稿；请用“保存”写入文件。</p><div className="about-line"><img src="/icon.png" alt="" /><span>Chartelis <small>0.1.4 · 为专注而生</small></span></div></Modal>}
    {modal === 'export' && <Modal title="导出文稿" onClose={() => { if (!busy) setModal(null); }}><p className="modal-description">导出当前内容，不改变 Markdown 原文件。</p><div className="export-options"><button disabled={busy} onClick={() => void exportFile('pdf')}>PDF 文档<small>A4 分页，文字可选中、可搜索</small></button><button disabled={busy} onClick={() => void exportFile('png')}>PNG 图片<small>保留当前预览样式的高清长图</small></button><button disabled={busy} onClick={() => void exportFile('docx')}>Word 文档<small>正文、表格与公式均可编辑</small></button></div>{busy && <p role="status" className="settings-note">正在生成导出文件…</p>}</Modal>}
    {closeTarget && <Modal title="让这段灵感留下来？" onClose={() => { if (!busy) setCloseTarget(null); }}><p className="modal-description">{closeTarget === 'app' ? '还有文稿尚未保存。退出前，可以先把它们安放好。' : `“${docs.find(doc => doc.id === closeTarget)?.name}” 的修改尚未保存。`}</p><div className="modal-actions"><button className="text-button" disabled={busy} onClick={() => void finishClose(false)}>不保存</button><button className="secondary-button" disabled={busy} onClick={() => setCloseTarget(null)}>继续编辑</button><button className="primary-button" disabled={busy} onClick={() => void finishClose(true)}>{busy ? '保存中…' : closeTarget === 'app' ? '保存并退出' : '保存并关闭'}</button></div></Modal>}
  </div>;
}
