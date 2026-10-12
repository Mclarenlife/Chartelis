import { EditorState } from '@codemirror/state';
import { history, isolateHistory } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { Heading } from './Editor';

export function createSourceState(value: string) {
  return EditorState.create({ doc: value, extensions: [history(), markdown({ base: markdownLanguage })] });
}

// A small replacement maps the existing selection and keeps earlier undo entries intact.
export function sourceReplacement(before: string, after: string) {
  if (before === after) return null;
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  let a = before.length, b = after.length;
  while (a > from && b > from && before[a - 1] === after[b - 1]) { a--; b--; }
  return { changes: { from, to: a, insert: after.slice(from, b) }, annotations: isolateHistory.of('full') };
}

export function sourceHeadings(state: EditorState): Heading[] {
  const headings: Heading[] = [];
  syntaxTree(state).iterate({ enter(node) {
    const match = /^(?:ATX|Setext)Heading([1-6])$/.exec(node.name);
    if (match) headings.push({
      level: Number(match[1]), pos: node.from,
      text: state.sliceDoc(node.from, node.to).replace(/^ {0,3}#{1,6}\s+/, '').replace(/\s+#+\s*$/, '').replace(/\n[=-]+\s*$/, '').trim(),
    });
  } });
  return headings;
}
