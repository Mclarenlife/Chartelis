import { afterEach, expect, it, vi } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import { remarkLatexDelimiters } from './latex-delimiters';
import { setLatexCompatibility } from './latex-preference';
import { markdownHtml, wordBlob } from './export';
import { renderAIMarkdown } from './ai-markdown';
import { unzipSync, strFromU8 } from 'fflate';

const parser = unified().use(remarkParse).use(remarkMath).use(remarkLatexDelimiters);
vi.stubGlobal('localStorage', { setItem() {} });
const parse = (source: string) => parser.runSync(parser.parse(source)) as any;
afterEach(() => setLatexCompatibility(false));

it('preserves LaTeX before Markdown escapes and emphasis are processed', () => {
  const source = String.raw`Given \(k=4\pi+x_i*y_j\), then \(y=2\).`;
  const nodes = parse(source).children[0].children;
  expect(nodes.filter((node: any) => node.type === 'latexInlineMath').map((node: any) => node.value)).toEqual([String.raw`k=4\pi+x_i*y_j`, 'y=2']);
  expect(parse(String.raw`\[\frac{1}{2}\]`).children[0]).toMatchObject({ type: 'latexMath', value: String.raw`\frac{1}{2}`, delimiter: 'bracket' });
});

it('supports multiline matrix bodies without losing linebreaks or backslashes', () => {
  const body = '\n\\begin{pmatrix}\na & b \\\\\nc & d\n\\end{pmatrix}\n';
  expect(parse(`\\[${body}\\]`).children[0]).toMatchObject({ type: 'latexMath', value: body });
  expect(parse('\\[\na^2\n\n+b^2\n\\]').children[0]).toMatchObject({ type: 'latexMath', value: '\na^2\n\n+b^2\n' });
  expect(parse('before \\(a\n+b\\) after').children[0].children[1]).toMatchObject({ type: 'latexInlineMath', value: 'a\n+b' });
  expect(parse('> \\[\n> x_i\n> \\]').children[0].children[0]).toMatchObject({ type: 'latexMath', value: '\nx_i\n' });
});

it('leaves code, escaped openers and incomplete formulas as ordinary Markdown', async () => {
  setLatexCompatibility(true);
  const source = '`\\(x_i\\)`\n\n```latex\n\\[x_i\\]\n```\n\n\\\\(escaped\\)\n\n\\(incomplete';
  const html = await markdownHtml(source);
  expect(html).not.toContain('class="katex"');
  expect(html).toContain('<code>\\(x_i\\)</code>');
  expect(html).toContain('\\[x_i\\]');
  const streamed = 'before \\(k=4\\pi\\)\n\n\\[\n\\frac{a}{b}\n\n+x_i\n\\]';
  for (let i = 0; i <= streamed.length; i++) expect(() => renderAIMarkdown(streamed.slice(0, i))).not.toThrow();
});

it('updates AI and export rendering while always supporting dollar math', async () => {
  const source = String.raw`\(k=4\pi\)`;
  expect(await markdownHtml(source)).toContain(source);
  expect(renderAIMarkdown(source)).not.toContain('class="katex"');
  setLatexCompatibility(true);
  expect(await markdownHtml(source)).toContain('class="katex"');
  expect(renderAIMarkdown(source)).toContain('class="katex"');
  expect(await markdownHtml(String.raw`\[x^2\]`)).toContain('katex-display');
  setLatexCompatibility(false);
  expect(await markdownHtml('$x^2$')).toContain('class="katex"');
});

it('exports compatible formulas as editable Word math only when enabled', async () => {
  const source = String.raw`\(k=4\pi\)` + '\n\n' + String.raw`\[\frac{a}{b}\]`;
  const xml = async () => strFromU8(unzipSync(new Uint8Array(await (await wordBlob(source, 'Math')).arrayBuffer()))['word/document.xml']);
  expect(await xml()).not.toContain('<m:oMath>');
  setLatexCompatibility(true);
  const enabled = await xml();
  expect(enabled).toContain('<m:oMath>');
  expect(enabled).toContain('<m:f>');
  expect(enabled).not.toContain('\\frac');
});
