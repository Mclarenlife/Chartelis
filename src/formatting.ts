import { t } from './i18n';
export type FormatAction = 'mathInline' | 'mathBlock' | 'bold' | 'italic' | 'highlight' | 'strike' | 'inlineCode' | 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'bullet' | 'ordered' | 'task' | 'quote' | 'code' | 'table' | 'link' | 'image' | 'rule';
export interface FormatValue { url: string; text: string }
export function linkMarkdown(action: 'link' | 'image', value: FormatValue) {
  const url = value.url.trim();
  if (!/^https?:\/\//i.test(url) && !(action === 'link' && /^mailto:/i.test(url))) throw new Error(t('请输入 http、https 或邮件链接'));
  return `${action === 'image' ? '!' : ''}[${value.text.replace(/[\\\[\]]/g, '\\$&')}](<${url.replace(/[<>\s]/g, char => encodeURIComponent(char))}>)`;
}
export const formatGroups: { label: string; items: [FormatAction, string][] }[] = [
  { label: '文字', items: [['bold', '粗体'], ['italic', '斜体'], ['highlight', '高亮'], ['strike', '删除线'], ['inlineCode', '行内代码']] },
  { label: '标题', items: [['paragraph', '正文'], ['h1', '一级标题'], ['h2', '二级标题'], ['h3', '三级标题'], ['h4', '四级标题'], ['h5', '五级标题'], ['h6', '六级标题']] },
  { label: '段落', items: [['bullet', '无序列表'], ['ordered', '有序列表'], ['task', '任务列表'], ['quote', '引用'], ['code', '代码块']] },
  { label: '插入', items: [['table', '表格'], ['link', '链接'], ['image', '图片'], ['rule', '分隔线'], ['mathInline', '行内公式'], ['mathBlock', '公式块']] },
];
export function formatSource(text: string, from: number, to: number, action: FormatAction, value?: FormatValue) {
  const selected = text.slice(from, to);
  if (value && (action === 'link' || action === 'image')) { const insert = linkMarkdown(action, value); return { from, to, insert, anchor: from + insert.length, head: from + insert.length }; }
  const wrap = (left: string, right = left, fallback = t('文字')) => ({ from, to, insert: left + (selected || fallback) + right, anchor: from + left.length, head: from + left.length + (selected || fallback).length });
  if (action === 'mathInline') return wrap('$', '$', 'E = mc^2');
  if (action === 'mathBlock') return wrap('\n\n$$\n', '\n$$\n\n', '\\frac{a}{b}');
  if (action === 'bold') return wrap('**');
  if (action === 'italic') return wrap('*');
  if (action === 'highlight') return wrap('==');
  if (action === 'strike') return wrap('~~');
  if (action === 'inlineCode') return wrap('`', '`', t('代码'));
  if (action === 'link') return wrap('[', '](https://example.com)', t('链接文字'));
  if (action === 'image') return wrap('![', '](https://example.com/image.png)', t('图片描述'));
  if (action === 'code') return wrap('\n```text\n', '\n```\n', t('代码'));
  if (action === 'table' || action === 'rule') {
    const insert = action === 'table' ? t('\n\n| 标题一 | 标题二 |\n| --- | --- |\n| 内容 | 内容 |\n\n') : '\n\n---\n\n';
    return { from, to, insert, anchor: from + insert.length, head: from + insert.length };
  }
  const start = text.lastIndexOf('\n', from - 1) + 1;
  const endAt = text.indexOf('\n', Math.max(from, to - 1));
  const end = endAt < 0 ? text.length : endAt;
  const prefix = /^h[1-6]$/.test(action) ? '#'.repeat(Number(action[1])) + ' ' : ({ bullet: '- ', ordered: '1. ', task: '- [ ] ', quote: '> ' } as Record<string, string>)[action] || '';
  const insert = text.slice(start, end).split('\n').map(line => prefix + line.replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-+*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')).join('\n');
  return { from: start, to: end, insert, anchor: start, head: start + insert.length };
}
