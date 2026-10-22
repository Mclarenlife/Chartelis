import type { Node } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

export interface SearchMatch { from: number; to: number }
export interface SearchEditor {
  find(query: string, caseSensitive: boolean): SearchMatch[];
  highlight(matches: SearchMatch[], index: number, scroll: boolean): void;
  replaceMatches(matches: SearchMatch[], text: string): void;
}
export function findText(text: string, query: string, caseSensitive: boolean, offset = 0): SearchMatch[] {
  if (!query) return [];
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'gu' : 'giu');
  return Array.from(text.matchAll(pattern), match => ({ from: offset + match.index!, to: offset + match.index! + match[0].length }));
}
export function findRich(doc: Node, query: string, caseSensitive: boolean) {
  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    matches.push(...findText(node.textBetween(0, node.content.size, '', '\ufffc'), query, caseSensitive, pos + 1));
    return false;
  });
  return matches;
}
export const searchKey = new PluginKey<DecorationSet>('chartelis-search');
export const richSearch = new Plugin<DecorationSet>({
  key: searchKey,
  state: { init: () => DecorationSet.empty, apply: (tr, value) => tr.getMeta(searchKey) ?? value.map(tr.mapping, tr.doc) },
  props: { decorations: state => searchKey.getState(state) },
});
export function richHighlights(doc: Node, matches: SearchMatch[], index: number) {
  return DecorationSet.create(doc, matches.map((match, i) => Decoration.inline(match.from, match.to, { class: i === index ? 'search-hit search-current' : 'search-hit' })));
}
export function scrollSearch(dom: HTMLElement, top: number) {
  const scroller = dom.closest<HTMLElement>('.writing-scroll');
  if (scroller) scroller.scrollTop += top - scroller.getBoundingClientRect().top - scroller.clientHeight / 3;
}
