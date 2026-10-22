import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

export const writingThemes = [
  { id: 'original', name: '自在', description: '宋体 · 17px · 舒展留白', font: 'serif', size: 17, line: 1.95, ink: 'auto', spacing: '.25px' },
  { id: 'book', name: '书页', description: '宋体 · 19px · 温润书卷', font: 'serif', size: 19, line: 2.1, ink: 'warm', spacing: '.45px' },
  { id: 'clean', name: '清简', description: '黑体 · 16px · 清晰紧凑', font: 'sans', size: 16, line: 1.8, ink: 'ink', spacing: '0px' },
  { id: 'essay', name: '随笔', description: '宋体 · 18px · 柔和节奏', font: 'serif', size: 18, line: 2, ink: 'soft', spacing: '.6px' },
];
export const inkOptions = [{ id: 'auto', name: '跟随配色' }, { id: 'ink', name: '墨色' }, { id: 'warm', name: '暖褐' }, { id: 'soft', name: '柔灰' }];
export function writingColor(ink: string, dark: boolean) {
  return ({ ink: dark ? '#e3e6eb' : '#252a32', warm: dark ? '#e0cbb4' : '#66503d', soft: dark ? '#c3c7cf' : '#686c73' } as Record<string, string>)[ink] ?? 'var(--text)';
}
export interface CountOptions { mode: 'characters' | 'words' | 'han'; source: boolean; spaces: boolean; punctuation: boolean; code: boolean }
export const defaultCount: CountOptions = { mode: 'characters', source: false, spaces: false, punctuation: true, code: true };
export function parseCount(value: string | null): CountOptions {
  try {
    const v = JSON.parse(value || '{}');
    if (!v || typeof v !== 'object') return { ...defaultCount };
    return { mode: ['characters', 'words', 'han'].includes(v.mode) ? v.mode : 'characters', ...Object.fromEntries(['source', 'spaces', 'punctuation', 'code'].map(key => [key, typeof v[key] === 'boolean' ? v[key] : defaultCount[key as keyof CountOptions]])) } as CountOptions;
  } catch { return { ...defaultCount }; }
}
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
interface TextNode { type: string; value?: string; alt?: string | null; children?: TextNode[] }
function renderedText(node: TextNode, includeCode: boolean): string {
  if (['code', 'inlineCode', 'math', 'inlineMath'].includes(node.type)) return includeCode ? node.value ?? '' : '';
  if (node.type === 'text') return node.value ?? '';
  if (node.type === 'image') return node.alt ?? '';
  if (node.type === 'break') return '\n';
  if (!node.children) return '';
  const separator = ['root', 'blockquote', 'listItem'].includes(node.type) ? '\n\n' : ['list', 'table'].includes(node.type) ? '\n' : node.type === 'tableRow' ? '\t' : '';
  return node.children.map(child => renderedText(child, includeCode)).join(separator);
}
export function countText(markdown: string, options: CountOptions) {
  let text = markdown;
  if (!options.source) {
    text = renderedText(parser.parse(markdown), options.code);
  }
  if (options.mode === 'han') return (text.match(/\p{Script=Han}/gu) ?? []).length;
  if (options.mode === 'words') return (text.match(/\p{Script=Han}/gu) ?? []).length + (text.replace(/\p{Script=Han}/gu, ' ').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
  if (!options.spaces) text = text.replace(/\s/gu, '');
  if (!options.punctuation) text = text.replace(/[\p{P}\p{S}]/gu, '');
  return [...text].length;
}
export const countLabels = { characters: '字符', words: '字词', han: '汉字' };
