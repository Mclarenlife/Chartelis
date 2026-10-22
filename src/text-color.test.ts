import { describe, expect, it } from 'vitest';
import { colorSource, normalizeColor } from './text-color';
import { markdownHtml, wordBlob } from './export';
import { countText, defaultCount } from './writing-preferences';
import { unzipSync, strFromU8 } from 'fflate';
describe('Markdown text colors', () => {
  it('uses only safe six-digit colors and wraps source selections', () => {
    expect(normalizeColor('#AbCdEf')).toBe('#abcdef');
    expect(normalizeColor('red; background:url(x)')).toBeNull();
    expect(colorSource('hello', 1, 4, '#397bc4')?.insert).toBe('<span style="color: #397bc4">ell</span>');
    expect(colorSource('hello', 1, 1, '#397bc4')).toBeNull();
  });
  it('renders color with nested Markdown without allowing arbitrary HTML', async () => {
    const source = '<span style="color: #397bc4">Hello **世界**</span>';
    expect(await markdownHtml(source)).toContain('<span style="color: #397bc4">Hello <strong>世界</strong></span>');
    expect(countText(source, defaultCount)).toBe(7);
    expect(await markdownHtml('<span onclick="alert(1)" style="color: #397bc4">safe</span>')).not.toContain('onclick');
    expect(await markdownHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });
  it('retains color in editable Word text', async () => {
    const blob = await wordBlob('<span style="color: #cd4c4c">colored</span>', 'test');
    const xml = strFromU8(unzipSync(new Uint8Array(await blob.arrayBuffer()))['word/document.xml']);
    expect(xml).toContain('w:val="cd4c4c"'); expect(xml).toContain('colored');
  });
  it('recolors a complete source span without corrupting adjacent spans', () => {
    const single = '<span style="color: #397bc4">blue</span>\n';
    expect(colorSource(single, 0, single.length, '#438c59')?.insert).toBe('<span style="color: #438c59">blue</span>\n');
    const adjacent = single.trim() + single.trim();
    expect(colorSource(adjacent, 0, adjacent.length, '#438c59')?.insert).toBe(`<span style="color: #438c59">${adjacent}</span>`);
  });
});
