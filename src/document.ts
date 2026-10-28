import { t } from './i18n';
export interface DocumentEntry {
  id: string;
  name: string;
  markdown: string;
  savedMarkdown: string;
  diskContent?: string;
  path?: string;
  handle?: BrowserFileHandle;
  lineEnding: '\n' | '\r\n';
  bom: boolean;
}

export interface BrowserFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
}

export const welcome = `# 让想法，自然发生。

留一点空白，给正在生长的灵感。

欢迎来到 **Chartelis**，一个安静、轻盈的 Markdown 写作空间。在这里，你只需要专注于文字，其余的交给我们。

## 从第一句话开始

直接在这里写下你的想法。输入 Markdown，排版会自然呈现；选中一段文字，常用的格式工具就会轻轻浮现。

> 好的工具会慢慢退到身后，
> 让你的想法走到前面。

## 一切，恰到好处

- **自在书写** — 标题、列表、引用，跟随你的节奏。
- **留在本地** — 打开与保存标准 Markdown 文件。
- **专注此刻** — 收起侧栏，为思考多留一点空间。

---

不必急着写得完美。先写下来，就很好。
`;

export function createDocument(name = t('未命名.md'), markdown = ''): DocumentEntry {
  return {
    id: crypto.randomUUID(), name, markdown,
    savedMarkdown: markdown,
    lineEnding: markdown.includes('\r\n') ? '\r\n' : '\n',
    bom: markdown.startsWith('\uFEFF'),
  };
}

export function isDirty(doc: DocumentEntry) {
  return doc.markdown !== doc.savedMarkdown;
}

export function encodeDocument(doc: DocumentEntry, markdown = doc.markdown) {
  const text = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return (doc.bom ? '\uFEFF' : '') + (doc.lineEnding === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

export function markSaved(doc: DocumentEntry, snapshot: string, saved: Partial<DocumentEntry>): DocumentEntry {
  // Keep edits made while the native save dialog or disk write was pending.
  return { ...doc, ...saved, savedMarkdown: snapshot };
}

export function countCharacters(markdown: string) {
  return [...markdown.replace(/[#*_`>\[\]~|\-]/g, '').replace(/\s/g, '')].length;
}

export function safeFileName(name: string) {
  const base = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim().replace(/[. ]+$/, '') || t('未命名');
  return /\.(md|markdown|mdown|txt)$/i.test(base) ? base : `${base}.md`;
}

const RECOVERY_KEY = 'chartelis.recovery.v1';

export function storeDrafts(docs: DocumentEntry[]) {
  const drafts = docs.filter(doc => isDirty(doc)).map(({ name, markdown }) => ({ name, markdown }));
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(drafts));
}

export function restoreDrafts(): DocumentEntry[] {
  try {
    const drafts: unknown = JSON.parse(localStorage.getItem(RECOVERY_KEY) || '[]');
    if (!Array.isArray(drafts)) return [];
    return drafts.filter((doc): doc is { name: string; markdown: string } =>
      typeof doc?.name === 'string' && typeof doc?.markdown === 'string',
    ).map(doc => ({ ...createDocument(doc.name, doc.markdown), savedMarkdown: '\0recovered' }));
  } catch { return []; }
}
