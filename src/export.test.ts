import { expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { markdownHtml, wordBlob } from './export';
import { latexToOmml } from './word-math';
import { DOMParser } from '@xmldom/xmldom';
import { paginate } from './pdf-export';

const sample = '# 中文标题\n\n这是 **粗体**、~~删除~~和 ==高亮==。\n\n| 列一 | 列二 |\n| --- | --- |\n| 可编辑 | 中文内容 |\n\n```ts\nconst a = 1\n```';
it('exports custom highlight colors as editable Word run shading', async () => {
  const blob = await wordBlob('==自定义高亮==', '高亮', '#a6c9ee');
  const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
  expect(xml).toContain('w:fill="d3e4f7"');
  expect(xml).toContain('自定义高亮');
  expect(xml).not.toContain('==');
});
it('exports inline and display equations as native editable Office Math', async () => {
  const math = 'Inline $x^2$\n\n$$\n\\frac{a}{b}\n$$';
  const html = await markdownHtml(math);
  expect(html).toContain('katex-display');
  expect(html).toContain('application/x-tex');
  const blob = await wordBlob(math, '公式');
  const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
  expect(xml).toContain('<m:oMath>');
  expect(xml).toContain('<m:sSup>');
  expect(xml).toContain('<m:f>');
  expect(xml).not.toContain('$x^2$');
  expect(xml).not.toContain('\\frac{a}{b}');
});
it('preserves editable nested fractions, roots, scripts, limits, matrices, cases and accents', async () => {
  const formulas = [String.raw`\frac{1}{\sqrt{x_i^2+1}}+x_i`, String.raw`\int_0^1 x^2\,dx`, String.raw`\sum_{n=1}^{\infty}\frac{1}{n^2}`, String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`, String.raw`f(x)=\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}`, String.raw`\hat{x}+\overline{AB}`];
  const blob = await wordBlob(formulas.map(value => `$$\n${value}\n$$`).join('\n\n'), '数学结构');
  const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
  const parsed = new DOMParser().parseFromString(xml, 'text/xml');
  const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
  for (const name of ['f', 'rad', 'sSub', 'sSup', 'sSubSup', 'nary', 'd', 'm', 'mr', 'acc', 'bar']) expect(parsed.getElementsByTagNameNS(ns, name).length, name).toBeGreaterThan(0);
  expect(parsed.getElementsByTagNameNS(ns, 'oMath').length).toBe(6);
  expect(xml).not.toContain('\\begin');
});
it('escapes formula text and rejects invalid LaTeX instead of quietly exporting source', () => {
  const xml = latexToOmml(String.raw`x<y \quad \text{A\&B}`);
  expect(xml).toContain('&lt;'); expect(xml).toContain('&amp;');
  expect(() => latexToOmml(String.raw`\notARealCommand{x}`)).toThrow('公式无法导出');
  const variant = latexToOmml(String.raw`\mathbb{R}+\mathcal{F}+\mathbf{x}`);
  expect(variant).toContain('<m:scr m:val="double-struck"/>');
  expect(variant).toContain('<m:scr m:val="script"/>');
  expect(variant).toContain('<m:sty m:val="b"/>');
});
it('keeps short code blocks and rows together, and never drops text at page cuts', () => {
  const pages = paginate(285, 100, [{ top: 80, bottom: 130 }], [{ top: 175, bottom: 190 }]);
  expect(pages).toEqual([{ start: 0, end: 80 }, { start: 80, end: 175 }, { start: 175, end: 275 }, { start: 275, end: 285 }]);
  const long = paginate(300, 100, [{ top: 0, bottom: 300 }], []);
  expect(long).toHaveLength(3);
});
it('renders safe HTML with headings, highlight, code and tables', async () => {
  const html = await markdownHtml(sample + '\n\n<script>alert(1)</script>');
  expect(html).toContain('<h1>中文标题</h1>');
  expect(html).toContain('<mark>高亮</mark>');
  expect(html).toContain('<table>');
  expect(html).not.toContain('<script>');
});
it('exports editable OOXML text, styles and tables instead of a screenshot', async () => {
  const blob = await wordBlob(sample, '测试');
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const xml = strFromU8(files['word/document.xml']);
  expect(xml).toContain('中文标题');
  expect(xml).toContain('可编辑');
  expect(xml).toContain('<w:tbl>');
  expect(xml).toContain('w:fill="f4edd2"');
  expect(xml).toContain('Heading1');
  expect(xml).toContain('w:tblHeader');
  expect(xml).toContain('Consolas');
  expect(xml).toContain('w:keepNext');
});
