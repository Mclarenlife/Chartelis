import { t } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { Search, X, ChevronDown, ChevronUp, CaseSensitive, Replace } from 'lucide-react';
import type { SearchEditor } from './search';

export default function SearchBar({ editor, revision, readOnly, onClose, focusRequest }: {
  editor(): SearchEditor | null; revision: number; readOnly?: boolean; onClose(): void; focusRequest: number;
}) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const shouldScroll = useRef(true);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, [focusRequest]);
  useEffect(() => {
    const target = editor();
    const matches = target?.find(query, sensitive) ?? [];
    const selected = Math.min(index, Math.max(0, matches.length - 1));
    setCount(matches.length);
    if (index !== selected) setIndex(selected);
    target?.highlight(matches, selected, shouldScroll.current);
    shouldScroll.current = false;
  }, [query, sensitive, index, revision, editor]);
  useEffect(() => () => editor()?.highlight([], 0, false), [editor]);
  const move = (direction: number) => {
    const target = editor(); const matches = target?.find(query, sensitive) ?? [];
    const next = matches.length ? (index + direction + matches.length) % matches.length : 0;
    target?.highlight(matches, next, true); setIndex(next);
  };
  const replace = (all: boolean) => {
    if (readOnly) return;
    const target = editor(); const matches = target?.find(query, sensitive) ?? [];
    target?.replaceMatches(all ? matches : matches.slice(index, index + 1), replacement);
    shouldScroll.current = true;
  };
  return <div className="document-search" role="search" aria-label={t("文稿内搜索")} onKeyDown={event => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Enter' && event.target === input.current) { event.preventDefault(); move(event.shiftKey ? -1 : 1); }
  }}>
    <div className="search-line"><Search size={16} /><input ref={input} aria-label={t("查找内容")} placeholder={t("在文稿中查找…")} value={query} onChange={event => { shouldScroll.current = true; setIndex(0); setQuery(event.target.value); }} />
      <span className="search-count" role="status">{query ? count ? `${index + 1} / ${count}` : t('无结果') : t('查找')}</span>
      <button className="icon-button" aria-label={t("区分大小写")} title={t("区分大小写")} aria-pressed={sensitive} onClick={() => { shouldScroll.current = true; setSensitive(value => !value); setIndex(0); }}><CaseSensitive size={17} /></button>
      <button className="icon-button" aria-label={t("上一个匹配")} title={t("上一个 · Shift Enter")} disabled={!count} onClick={() => move(-1)}><ChevronUp size={16} /></button>
      <button className="icon-button" aria-label={t("下一个匹配")} title={t("下一个 · Enter")} disabled={!count} onClick={() => move(1)}><ChevronDown size={16} /></button>
      <button className="icon-button" aria-label={t("显示替换")} title={t("查找与替换")} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Replace size={16} /></button>
      <button className="icon-button" aria-label={t("关闭搜索")} title={t("关闭 · Esc")} onClick={onClose}><X size={16} /></button>
    </div>
    {expanded && <div className="search-line replace-line"><input aria-label={t("替换内容")} placeholder={t("替换为…")} value={replacement} onChange={event => setReplacement(event.target.value)} disabled={readOnly} /><button disabled={readOnly || !count} onClick={() => replace(false)}>{t("替换")}</button><button disabled={readOnly || !count} onClick={() => replace(true)}>{t("全部替换")}</button></div>}
  </div>;
}
