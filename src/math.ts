import { $node, $remark, $view, $inputRule, $prose } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { NodeSelection, Plugin } from '@milkdown/kit/prose/state';
import { ReplaceStep } from '@milkdown/kit/prose/transform';
import { isHistoryTransaction } from '@milkdown/kit/prose/history';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import remarkMath from 'remark-math';
import katex from 'katex';
import { t } from './i18n';
import { latexForRendering, remarkLatexDelimiters, wrapLatex } from './latex-delimiters';
import { latexCompatibility, subscribeLatexCompatibility } from './latex-preference';
import 'katex/dist/katex.min.css';

export const mathRemark = $remark('chartelis-math', () => remarkMath);
const latexRemark = $remark('chartelis-latex-delimiters', () => remarkLatexDelimiters);
const schema = (name: string, inline: boolean) => $node(name, () => ({
  group: inline ? 'inline' : 'block', inline, atom: true, selectable: true,
  attrs: { value: { default: '' }, delimiter: { default: null }, doubled: { default: false } },
  parseDOM: [{ tag: `${inline ? 'span' : 'div'}[data-math]`, getAttrs: element => {
    const data = (element as HTMLElement).dataset;
    return { value: data.math || '', doubled: data.latexDoubled === 'true', delimiter: ['paren', 'bracket'].includes(data.latexDelimiter || '') ? data.latexDelimiter : null };
  } }],
  toDOM: node => [inline ? 'span' : 'div', { 'data-math': node.attrs.value, 'data-latex-delimiter': node.attrs.delimiter, 'data-latex-doubled': node.attrs.doubled || null, class: 'math-node' }, node.attrs.value],
  parseMarkdown: { match: node => [inline ? 'inlineMath' : 'math', inline ? 'latexInlineMath' : 'latexMath'].includes(node.type), runner: (state, node, type) => { state.addNode(type, { value: node.value, delimiter: node.delimiter ?? null, doubled: !!node.doubled }); } },
  toMarkdown: { match: node => node.type.name === name, runner: (state, node) => { state.addNode(node.attrs.delimiter ? inline ? 'latexInlineMath' : 'latexMath' : inline ? 'inlineMath' : 'math', undefined, node.attrs.value, { delimiter: node.attrs.delimiter, doubled: node.attrs.doubled }); } },
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
      if (literal) rendered.textContent = wrapLatex(current.attrs.value, delimiter, current.attrs.doubled);
      else katex.render(latexForRendering(current.attrs.value, current.attrs.doubled) || '\\square', rendered, { displayMode: !inline || delimiter === 'bracket', throwOnError: false, trust: false, maxExpand: 1000 });
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

// Rich clipboard HTML and direct typing can insert literal text without going
// through the Markdown parser. Convert completed pairs in those transactions.
const liveLatex = $prose(ctx => new Plugin({
  view(view) {
    const stop = subscribeLatexCompatibility(() => {
      if (latexCompatibility()) view.dispatch(view.state.tr.setMeta('parse-literal-math', true));
    });
    return { destroy: stop };
  },
  appendTransaction(transactions, _old, state) {
    if (!latexCompatibility()) return null;
    if (!transactions.some(tr => tr.getMeta('parse-literal-math') ||
      (!isHistoryTransaction(tr) && tr.steps.some(step => step instanceof ReplaceStep &&
        /[)\]]/.test(step.slice.content.textBetween(0, step.slice.content.size)))))) return null;
    const tr = state.tr;
    const inline = mathInline.type(ctx), block = mathBlock.type(ctx);
    // Enter creates separate paragraphs, including when pasting rich HTML.
    function joinDisplay(parent: ProseNode, base: number) {
      let opener: { pos: number; slash: string; lines: string[] } | undefined;
      parent.forEach((child, offset) => {
        if (child.type.name !== 'paragraph' || child.content.content.some(n => !n.isText || n.marks.some(m => m.type.spec.code))) {
          opener = undefined;
          if (!child.isTextblock && !child.isLeaf) joinDisplay(child, base + offset + 1);
          return;
        }
        const text = child.textContent;
        const start = text.trim().match(/^(\\{1,2})\[$/);
        if (start) opener = { pos: base + offset, slash: start[1], lines: [] };
        else if (opener && text.trim() === opener.slash + ']') {
          tr.replaceWith(tr.mapping.map(opener.pos), tr.mapping.map(base + offset + child.nodeSize),
            block.create({ value: '\n' + opener.lines.join('\n') + '\n', delimiter: 'bracket', doubled: opener.slash.length === 2 }));
          opener = undefined;
        } else opener?.lines.push(text);
      });
    }
    joinDisplay(state.doc, 0);
    state.doc.descendants((node, pos, parent) => {
      if (node.type.spec.code) return false;
      if (!node.isText || node.marks.some(mark => mark.type.spec.code)) return;
      if (tr.mapping.mapResult(pos, 1).deleted) return;
      const pattern = /(\\{1,2})(?:\(([\s\S]*?)\1\)|\[([\s\S]*?)\1\])/g;
      for (const match of node.text!.matchAll(pattern)) {
        if (node.text![match.index - 1] === '\\') continue;
        const display = match[3] !== undefined;
        const wholeBlock = display && parent?.type.name === 'paragraph' && parent.content.size === match[0].length;
        const attrs = { value: match[2] ?? match[3], delimiter: display ? 'bracket' : 'paren', doubled: match[1].length === 2 };
        const start = pos + match.index;
        tr.replaceWith(tr.mapping.map(start - (wholeBlock ? 1 : 0)), tr.mapping.map(start + match[0].length + (wholeBlock ? 1 : 0)),
          wholeBlock ? block.create(attrs) : inline.create(attrs, null, node.marks));
      }
    });
    return tr.docChanged ? tr : null;
  },
}));
export const mathPlugins = [mathRemark, latexRemark, mathInline, mathBlock, mathView(mathInline, true), mathView(mathBlock, false), inlineRule, blockRule, liveLatex].flat();
