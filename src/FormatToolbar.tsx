import { t } from './i18n';
import { Bold, Italic, Highlighter, Strikethrough, Code2, Pilcrow, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, List, ListOrdered, ListTodo, Quote, SquareCode, Table2, Link, Image, Minus, Sigma, SquareFunction, type LucideIcon } from 'lucide-react';
import { formatGroups, type FormatAction } from './formatting';
import { toolbarOptions } from './preferences';

const icons: Record<FormatAction, LucideIcon> = {
  bold: Bold, italic: Italic, highlight: Highlighter, strike: Strikethrough, inlineCode: Code2,
  paragraph: Pilcrow, h1: Heading1, h2: Heading2, h3: Heading3, h4: Heading4, h5: Heading5, h6: Heading6,
  bullet: List, ordered: ListOrdered, task: ListTodo, quote: Quote, code: SquareCode,
  table: Table2, link: Link, image: Image, rule: Minus, mathInline: Sigma, mathBlock: SquareFunction,
};
const markNames: Partial<Record<FormatAction, string>> = { bold: 'strong', italic: 'emphasis', strike: 'strike_through', inlineCode: 'inlineCode', highlight: 'highlight' };
export function formatLabel(action: FormatAction) {
  return t(toolbarOptions.find(([id]) => id === action)?.[1] ?? formatGroups.flatMap(group => group.items).find(([id]) => id === action)![1]);
}
export function FormatIcon({ action }: { action: FormatAction }) {
  const Icon = icons[action];
  return <Icon size={17} strokeWidth={1.7} aria-hidden="true" />;
}

// The settings preview and editor share the same buttons, dimensions and order.
export default function FormatToolbar({ actions, onSelect, marks = [], selected, preview = false }: {
  actions: FormatAction[]; onSelect(action: FormatAction): void; marks?: string[]; selected?: FormatAction; preview?: boolean;
}) {
  return <div className="format-toolbar" role="toolbar" aria-label={preview ? t('选区工具栏预览') : t('文字格式')}>
    {actions.map((action, index) => {
      const mark = markNames[action];
      const active = preview ? selected === action : !!mark && marks.includes(mark);
      return <button type="button" key={action} data-format={action} className={`${active ? 'active' : ''} ${index === 4 ? 'tool-divider' : ''}`}
        title={formatLabel(action)} aria-label={formatLabel(action)} aria-pressed={preview || mark ? active : undefined}
        onMouseDown={event => { if (!preview) event.preventDefault(); }} onClick={() => onSelect(action)}><FormatIcon action={action} /></button>;
    })}
  </div>;
}
