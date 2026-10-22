import { $mark, $remark } from '@milkdown/kit/utils';

export const textColors = [
  ['黄色', '#c49a24'], ['绿色', '#438c59'], ['蓝色', '#397bc4'], ['橙色', '#d87b2e'],
  ['红色', '#cd4c4c'], ['粉红色', '#cf6597'], ['紫色', '#9064c4'],
];
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) return null;
  return value.toLowerCase();
}
export function lastTextColor() { try { return normalizeColor(localStorage.getItem('chartelis.lastTextColor')) ?? textColors[0][1]; } catch { return textColors[0][1]; } }
export function rememberTextColor(color: string) { try { localStorage.setItem('chartelis.lastTextColor', color); } catch { /* Formatting remains available without storage. */ } }
export function colorSource(text: string, from: number, to: number, color: string) {
  const valid = normalizeColor(color); if (!valid || from === to) return null;
  const raw = text.slice(from, to), suffix = raw.match(/\s*$/)![0];
  const selected = raw.slice(0, raw.length - suffix.length).replace(/^<span\s+style=["']\s*color\s*:\s*#[\da-f]{6}\s*;?\s*["']\s*>((?:(?!<\/?span\b)[\s\S])*)<\/span>$/i, '$1');
  const insert = selected.split(/(\n\s*\n)/).map(part => /^\n\s*\n$/.test(part) ? part : `<span style="color: ${valid}">${part}</span>`).join('');
  return { from, to, insert: insert + suffix };
}
// Recognize only our restricted inline color span. Other raw HTML stays inert.
export function remarkTextColor() {
  return (tree: any) => {
    const visit = (parent: any) => {
      if (!parent.children) return;
      parent.children.forEach(visit);
      const output: any[] = [], stack: { node: any; original: any }[] = [];
      const append = (node: any) => (stack.at(-1)?.node.children ?? output).push(node);
      for (const node of parent.children) {
        const open = node.type === 'html' && /^<span\s+style=["']\s*color\s*:\s*(#[\da-f]{6})\s*;?\s*["']\s*>$/i.exec(node.value);
        if (open) { stack.push({ node: { type: 'textColor', color: open[1].toLowerCase(), children: [], data: { hName: 'span', hProperties: { style: `color: ${open[1].toLowerCase()}` } } }, original: node }); }
        else if (node.type === 'html' && /^<\/span\s*>$/i.test(node.value) && stack.length) { const item = stack.pop()!; append(item.node); }
        else append(node);
      }
      while (stack.length) { const item = stack.pop()!; append(item.original); item.node.children.forEach(append); }
      parent.children = output;
    };
    visit(tree);
  };
}
export const textColorRemark = $remark('chartelis-text-color', () => remarkTextColor);
const parsingColors = new WeakMap<object, string>();
export const textColorMark = $mark('textColor', () => ({
  attrs: { color: { default: '#397bc4' } },
  parseDOM: [{ tag: 'span[data-text-color]', getAttrs: element => { const color = normalizeColor((element as HTMLElement).dataset.textColor); return color ? { color } : false; } }],
  toDOM: mark => ['span', { style: `color: ${mark.attrs.color}`, 'data-text-color': mark.attrs.color }, 0],
  parseMarkdown: { match: node => node.type === 'textColor', runner: (state, node, type) => {
    const previous = parsingColors.get(state), color = normalizeColor(node.color)!;
    parsingColors.set(state, color);
    state.openMark(type, { color });
    try { state.next(node.children); } finally {
      state.closeMark(type);
      if (previous) { parsingColors.set(state, previous); state.openMark(type, { color: previous }); }
      else parsingColors.delete(state);
    }
  } },
  toMarkdown: { match: mark => mark.type.name === 'textColor', runner: (state, mark) => { state.withMark(mark, 'textColor', undefined, { color: mark.attrs.color }); } },
}));
export const colorStringify = (node: any, _parent: any, state: any, info: any) => `<span style="color: ${normalizeColor(node.color) ?? '#397bc4'}">${state.containerPhrasing(node, info)}</span>`;
