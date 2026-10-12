import type { FormatAction } from './formatting';

export const themes = [
  { id: 'warm', name: '晨光', colors: ['#faf9f6', '#868765', '#b09b77'] },
  { id: 'sage', name: '苔绿', colors: ['#f4f7f2', '#50745c', '#94a687'] },
  { id: 'ocean', name: '雾蓝', colors: ['#f3f7fb', '#4d7194', '#8babc2'] },
  { id: 'rose', name: '玫瑰', colors: ['#fbf5f4', '#97676f', '#c49c96'] },
  { id: 'midnight', name: '深海', colors: ['#1c2430', '#9dbbd5', '#a2a3cd'] },
];
export function resolveTheme(preference: string, systemDark: boolean) {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return ['light', 'dark', ...themes.map(theme => theme.id)].includes(preference) ? preference : systemDark ? 'dark' : 'light';
}
export const toolbarOptions: [FormatAction, string][] = [
  ['bold', '粗体'], ['italic', '斜体'], ['highlight', '高亮'], ['strike', '删除线'],
  ['inlineCode', '行内代码'], ['h2', '标题'], ['quote', '引用'], ['link', '链接'],
  ['bullet', '列表'], ['mathInline', '行内公式'], ['mathBlock', '公式块'],
];
export const defaultToolbar: FormatAction[] = ['bold', 'italic', 'strike', 'inlineCode', 'h2', 'quote'];
export function readToolbar(): FormatAction[] {
  try {
    const value = JSON.parse(localStorage.getItem('chartelis.toolbar') || 'null');
    if (Array.isArray(value)) return [...new Set(value.filter((id): id is FormatAction => toolbarOptions.some(([key]) => key === id)))];
  } catch { /* Invalid preferences fall back to the default tools. */ }
  return defaultToolbar;
}
export function documentExcerpt(markdown: string) {
  return markdown.replace(/^\uFEFF/, '').replace(/\$\$[\s\S]*?\$\$/g, ' [公式] ').replace(/\$[^$\n]+\$/g, '[公式]').replace(/^#{1,6}\s+.*$/gm, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/```[^\n]*\n|```/g, '').replace(/[*_`~#>|=]/g, '')
    .replace(/^\s*[-+]\s+/gm, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}
