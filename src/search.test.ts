import { describe, expect, it } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { findRich, findText } from './search';
import { countText, defaultCount, parseCount } from './writing-preferences';

describe('mode-preserving search', () => {
  it('matches literal queries, Unicode offsets and case options', () => {
    expect(findText('😀 Ab aB [a]', 'ab', false)).toEqual([{ from: 3, to: 5 }, { from: 6, to: 8 }]);
    expect(findText('Ab aB', 'Ab', true)).toEqual([{ from: 0, to: 2 }]);
    expect(findText('[a] [b]', '[a]', false)).toEqual([{ from: 0, to: 3 }]);
    expect(findText('text', '', false)).toEqual([]);
  });
  it('finds text spanning formatting marks without joining paragraphs', () => {
    const schema = new Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*', group: 'block' }, text: {} }, marks: { strong: {} } });
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('hel'), schema.text('lo', [schema.mark('strong')])]), schema.node('paragraph', null, schema.text('world'))]);
    expect(findRich(doc, 'hello', false)).toEqual([{ from: 1, to: 6 }]);
    expect(findRich(doc, 'loworld', false)).toEqual([]);
  });
});
describe('document count settings', () => {
  it('counts rendered text without Markdown and link URLs', () => {
    expect(countText('# Hi\n\n**你好** [go](https://example.org)', defaultCount)).toBe(6);
    expect(countText('hello中文world 123!', { ...defaultCount, mode: 'words' })).toBe(5);
    expect(countText('hello中文world 123!', { ...defaultCount, mode: 'han' })).toBe(2);
  });
  it('can exclude code/formulas, punctuation and include exact source whitespace', () => {
    expect(countText('a `code` $x$\n\n```js\ny\n```', { ...defaultCount, code: false })).toBe(1);
    expect(countText('你好，世界！', { ...defaultCount, punctuation: false })).toBe(4);
    expect(countText('a b\n', { ...defaultCount, source: true, spaces: true })).toBe(4);
    expect(countText('a **b**', { ...defaultCount, spaces: true })).toBe(3);
  });
  it('validates persisted choices', () => {
    expect(parseCount('null')).toEqual(defaultCount);
    expect(parseCount('{"mode":"unknown","spaces":"true"}')).toEqual(defaultCount);
    expect(parseCount('{"mode":"han","code":false}')).toMatchObject({ mode: 'han', code: false });
  });
});
