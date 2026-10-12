import { $node, $remark, $view, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { NodeSelection } from '@milkdown/kit/prose/state';
import remarkMath from 'remark-math';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export const mathRemark = $remark('chartelis-math', () => remarkMath);
const schema = (name: string, inline: boolean) => $node(name, () => ({
  group: inline ? 'inline' : 'block', inline, atom: true, selectable: true,
  attrs: { value: { default: '' } },
  parseDOM: [{ tag: `${inline ? 'span' : 'div'}[data-math]`, getAttrs: element => ({ value: (element as HTMLElement).dataset.math || '' }) }],
  toDOM: node => [inline ? 'span' : 'div', { 'data-math': node.attrs.value, class: 'math-node' }, node.attrs.value],
  parseMarkdown: { match: node => node.type === (inline ? 'inlineMath' : 'math'), runner: (state, node, type) => { state.addNode(type, { value: node.value }); } },
  toMarkdown: { match: node => node.type.name === name, runner: (state, node) => { state.addNode(inline ? 'inlineMath' : 'math', undefined, node.attrs.value); } },
}));
export const mathInline = schema('math_inline', true);
export const mathBlock = schema('math_block', false);
function mathView(nodeSchema: typeof mathInline, inline: boolean) {
  return $view(nodeSchema, () => (node, view, getPos) => {
    let current = node;
    const dom = document.createElement(inline ? 'span' : 'div'); dom.className = `math-node ${inline ? 'math-inline' : 'math-block'}`;
    dom.contentEditable = 'false'; dom.title = '点击编辑 LaTeX 公式';
    const rendered = document.createElement('span'); rendered.className = 'math-render';
    const input = document.createElement('textarea'); input.className = 'math-input'; input.setAttribute('aria-label', 'LaTeX 公式源码'); input.hidden = true; input.rows = inline ? 2 : 4;
    const render = () => { dom.dataset.math = current.attrs.value; katex.render(current.attrs.value || '\\square', rendered, { displayMode: !inline, throwOnError: false, trust: false, maxExpand: 1000 }); if (input.value !== current.attrs.value) input.value = current.attrs.value; };
    render(); dom.append(rendered, input);
    rendered.addEventListener('click', () => {
      if (!view.editable) return;
      const pos = getPos(); if (typeof pos !== 'number') return;
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
      input.hidden = false; input.focus();
    });
    input.addEventListener('input', () => { const pos = getPos(); if (!view.editable || typeof pos !== 'number') return; view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { value: input.value })); });
    input.addEventListener('keydown', event => { if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) { event.preventDefault(); event.stopPropagation(); input.hidden = true; view.focus(); } });
    return { dom, update(next) { if (next.type !== current.type) return false; current = next; render(); return true; },
      selectNode() { dom.classList.add('ProseMirror-selectednode'); }, deselectNode() { input.hidden = true; dom.classList.remove('ProseMirror-selectednode'); },
      stopEvent: event => input.contains(event.target as Node), ignoreMutation: () => true,
    };
  });
}
const inlineRule = $inputRule(ctx => new InputRule(/\$([^$\n]+)\$$/, (state, match, start, end) => state.tr.replaceWith(start, end, mathInline.type(ctx).create({ value: match[1] }))));
const blockRule = $inputRule(ctx => new InputRule(/^\$\$\s$/, (state, _match, start, end) => state.tr.replaceWith(start - 1, end, mathBlock.type(ctx).create({ value: 'E = mc^2' }))));
export const mathPlugins = [mathRemark, mathInline, mathBlock, mathView(mathInline, true), mathView(mathBlock, false), inlineRule, blockRule].flat();
