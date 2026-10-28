import type { Processor } from 'unified';
import { latexCompatibility } from './latex-preference';

export type LatexDelimiter = 'paren' | 'bracket';
export function wrapLatex(value: string, delimiter: LatexDelimiter) {
  return delimiter === 'bracket' ? `\\[${value}\\]` : `\\(${value}\\)`;
}

// Parse before Markdown processes backslash escapes/emphasis. The tokenizer only
// runs in prose, so fenced/inline code, link destinations and raw HTML stay intact.
// Keep separate nodes even when display is disabled: toggling the setting must
// not rebuild editor state, change Markdown delimiters or reset undo history.
export function remarkLatexDelimiters(this: Processor) {
  const data = this.data() as any;
  const construct = (block: boolean) => ({
    name: block ? 'chartelisLatexFlow' : 'chartelisLatex',
    concrete: block,
    tokenize(this: any, effects: any, ok: any, nok: any) {
      let close = 0;
      const token = block ? 'chartelisLatexFlow' : 'chartelisLatex';
      return start;
      function start(code: number | null): any {
        if (code !== 92) return nok(code);
        effects.enter(token); effects.enter('chartelisLatexData'); effects.consume(code); return opening;
      }
      function opening(code: number | null): any {
        if (block ? code !== 91 : code !== 40 && code !== 91) return nok(code);
        close = code === 40 ? 41 : 93;
        effects.consume(code); return body;
      }
      function body(code: number | null): any {
        if (code === null) return nok(code);
        if (code === -5 || code === -4 || code === -3) {
          effects.exit('chartelisLatexData');
          effects.enter('lineEnding'); effects.consume(code); effects.exit('lineEnding');
          return nextLine;
        }
        effects.consume(code); return code === 92 ? afterSlash : body;
      }
      function nextLine(code: number | null): any {
        if (code === null) return nok(code);
        if (code === -5 || code === -4 || code === -3) {
          effects.enter('lineEnding'); effects.consume(code); effects.exit('lineEnding'); return nextLine;
        }
        effects.enter('chartelisLatexData'); return body(code);
      }
      function afterSlash(code: number | null): any {
        if (code === close) { effects.consume(code); return finish; }
        if (code === 92) { effects.consume(code); return body; }
        return body(code);
      }
      function finish(code: number | null): any {
        if (block && (code === 32 || code === -2 || code === -1)) { effects.consume(code); return finish; }
        if (block && code !== null && code !== -5 && code !== -4 && code !== -3) return nok(code);
        effects.exit('chartelisLatexData'); effects.exit(token); return ok(code);
      }
    },
  });
  (data.micromarkExtensions ||= []).push({ text: { 92: construct(false) }, flow: { 92: construct(true) } });
  function enter(this: any, token: any) {
    const raw = this.sliceSerialize(token).trimEnd();
    this.enter({ type: token.type === 'chartelisLatexFlow' ? 'latexMath' : 'latexInlineMath', value: raw.slice(2, -2), delimiter: raw[1] === '[' ? 'bracket' : 'paren' }, token);
    this.buffer();
  }
  function exit(this: any, token: any) { this.resume(); this.exit(token); }
  (data.fromMarkdownExtensions ||= []).push({
    enter: { chartelisLatex: enter, chartelisLatexFlow: enter },
    exit: { chartelisLatex: exit, chartelisLatexFlow: exit },
  });
  (data.toMarkdownExtensions ||= []).push({ handlers: {
    latexInlineMath: (node: any) => wrapLatex(node.value, node.delimiter),
    latexMath: (node: any) => wrapLatex(node.value, 'bracket'),
  } });
  return (tree: any) => {
    function visit(parent: any) {
      if (!parent.children) return;
      parent.children = parent.children.map((node: any) => {
        visit(node);
        if (node.type === 'paragraph' && node.children.length === 1 && node.children[0].type === 'latexInlineMath' && node.children[0].delimiter === 'bracket') {
          return { ...node.children[0], type: 'latexMath', position: node.position };
        }
        return node;
      });
    }
    visit(tree);
  };
}

// Used for read-only HTML/AI/Word rendering, never for editing or serialization.
export function resolveLatexDelimiters(options: { enabled?: boolean } = {}) {
  return (tree: any) => {
    const enabled = options.enabled ?? latexCompatibility();
    function visit(parent: any) {
      if (!parent.children) return;
      parent.children = parent.children.map((node: any) => {
        if (node.type !== 'latexMath' && node.type !== 'latexInlineMath') { visit(node); return node; }
        const block = node.type === 'latexMath';
        if (!enabled) {
          const text = { type: 'text', value: wrapLatex(node.value, node.delimiter) };
          return block ? { type: 'paragraph', children: [text] } : text;
        }
        const code = { type: 'element', tagName: 'code', properties: { className: ['language-math', node.delimiter === 'bracket' ? 'math-display' : 'math-inline'] }, children: [{ type: 'text', value: node.value }] };
        return { type: block ? 'math' : 'inlineMath', value: node.value, data: block ? { hName: 'pre', hChildren: [code] } : { hName: 'code', hProperties: code.properties, hChildren: code.children } };
      });
    }
    visit(tree);
  };
}
