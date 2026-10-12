import { $mark, $remark } from '@milkdown/kit/utils';

// Shared by the editor and exporters: ==highlight== is a small Markdown extension.
export function remarkHighlight() {
  return (tree: any) => {
    const visit = (parent: any) => {
      if (!parent.children || parent.type === 'code' || parent.type === 'inlineCode') return;
      parent.children = parent.children.flatMap((node: any) => {
        if (node.type !== 'text') { visit(node); return [node]; }
        const result: any[] = []; let last = 0;
        for (const match of node.value.matchAll(/==([^=\n]+)==/g)) {
          if (match.index! > last) result.push({ type: 'text', value: node.value.slice(last, match.index) });
          result.push({ type: 'highlight', children: [{ type: 'text', value: match[1] }], data: { hName: 'mark' } });
          last = match.index! + match[0].length;
        }
        if (!last) return [node];
        if (last < node.value.length) result.push({ type: 'text', value: node.value.slice(last) });
        return result;
      });
    };
    visit(tree);
  };
}
export const highlightRemark = $remark('chartelis-highlight', () => remarkHighlight);
export const highlightMark = $mark('highlight', () => ({
  parseDOM: [{ tag: 'mark' }], toDOM: () => ['mark', 0],
  parseMarkdown: { match: node => node.type === 'highlight', runner: (state, node, type) => { state.openMark(type); state.next(node.children); state.closeMark(type); } },
  toMarkdown: { match: mark => mark.type.name === 'highlight', runner: (state, mark) => { state.withMark(mark, 'highlight'); } },
}));
