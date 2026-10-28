import { $node, $remark, $view, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { NodeSelection } from '@milkdown/kit/prose/state';
import remarkMath from 'remark-math';
import katex from 'katex';
import { t } from './i18n';
import { remarkLatexDelimiters, wrapLatex } from './latex-delimiters';
import { latexCompatibility, subscribeLatexCompatibility } from './latex-preference';
import 'katex/dist/katex.min.css';

export const mathRemark = $remark('chartelis-math', () => remarkMath);
const latexRemark = $remark('chartelis-latex-delimiters', () => remarkLatexDelimiters);
const schema = (name: string, inline: boolean) => $node(name, () => ({
  group: inline ? 'inline' : 'block', inline, atom: true, selectable: true,
  attrs: { value: { default: '' }, delimiter: { default: null } },
  parseDOM: [{ tag: `${inline ? 'span' : 'div'}[data-math]`, getAttrs: element => {
    const data = (element as HTMLElement).dataset;
    return { value: data.math || '', delimiter: ['paren', 'bracket'].includes(data.latexDelimiter || '') ? data.latexDelimiter : null };
  } }],
  toDOM: node => [inline ? 'span' : 'div', { 'data-math': node.attrs.value, 'data-latex-delimiter': node.attrs.delimiter, class: 'math-node' }, node.attrs.value],
  parseMarkdown: { match: node => [inline ? 'inlineMath' : 'math', inline ? 'latexInlineMath' : 'latexMath'].includes(node.type), runner: (state, node, type) => { state.addNode(type, { value: node.value, delimiter: node.delimiter ?? null }); } },
  toMarkdown: { match: node => node.type.name === name, runner: (state, node) => { state.addNode(node.attrs.delimiter ? inline ? 'latexInlineMath' : 'latexMath' : inline ? 'inlineMath' : 'math', undefined, node.attrs.value, { delimiter: node.attrs.delimiter }); } },
}));
export const mathInline = schema('math_inline', true);
export const mathBlock = schema('math_block', false);
function mathView(nodeSchema: typeof mathInline, inline: boolean) {
  return $view(nodeSchema, () => (node, view, getPos) => {
    let current = node;
    const dom = document.createElement(inline ? 'span' : 'div'); dom.className = `math-node ${inline ? 'math-inline' : 'math-block'}`;
    dom.contentEditable = 'false'; dom.title = t('点击编辑 LaTeX 公式');
    const rendered = document.createElement('span'); rendered.className = 'math-render';
    const input = document.createElement('textarea'); input.className = 'math-input'; input.setAttribute('aria-label', t('LaTeX 公式源码')); input.hidden = true; input.rows = inline ? 2 : 4;
    const render = () => {
      dom.dataset.math = current.attrs.value;
      const delimiter = current.attrs.delimiter;
      if (delimiter) dom.dataset.latexDelimiter = delimiter; else delete dom.dataset.latexDelimiter;
      const literal = !!delimiter && !latexCompatibility();
      dom.classList.toggle('math-literal', literal);
      if (literal) rendered.textContent = wrapLatex(current.attrs.value, delimiter);
      else katex.render(current.attrs.value || '\\square', rendered, { displayMode: !inline || delimiter === 'bracket', throwOnError: false, trust: false, maxExpand: 1000 });
      if (input.value !== current.attrs.value) input.value = current.attrs.value;
    };
    const unsubscribe = subscribeLatexCompatibility(render);
    render(); dom.append(rendered, input);
    rendered.addEventListener('click', () => {
      if (!view.editable) return;
      const pos = getPos(); if (typeof pos !== 'number') return;
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
      input.hidden = false; input.focus();
    });
    input.addEventListener('input', () => { const pos = getPos(); if (!view.editable || typeof pos !== 'number') return; view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, value: input.value })); });
    input.addEventListener('keydown', event => { if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) { event.preventDefault(); event.stopPropagation(); input.hidden = true; view.focus(); } });
    return { dom, update(next) { if (next.type !== current.type) return false; current = next; render(); return true; },
      selectNode() { dom.classList.add('ProseMirror-selectednode'); }, deselectNode() { input.hidden = true; dom.classList.remove('ProseMirror-selectednode'); },
      stopEvent: event => input.contains(event.target as Node), ignoreMutation: () => true, destroy: unsubscribe,
    };
  });
}
const inlineRule = $inputRule(ctx => new InputRule(/\$([^$\n]+)\$$/, (state, match, start, end) => state.tr.replaceWith(start, end, mathInline.type(ctx).create({ value: match[1] }))));
const blockRule = $inputRule(ctx => new InputRule(/^\$\$\s$/, (state, _match, start, end) => state.tr.replaceWith(start - 1, end, mathBlock.type(ctx).create({ value: 'E = mc^2' }))));
const latexRule = $inputRule(ctx => new InputRule(/\\\(((?:(?!\\[()])[^\n])+)\\\)$/, (state, match, start, end) => {
  if (!latexCompatibility() || state.doc.textBetween(Math.max(0, start - 1), start) === '\\') return null;
  return state.tr.replaceWith(start, end, mathInline.type(ctx).create({ value: match[1], delimiter: 'paren' }));
}));
export const mathPlugins = [mathRemark, latexRemark, mathInline, mathBlock, mathView(mathInline, true), mathView(mathBlock, false), inlineRule, blockRule, latexRule].flat();
