// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defaultToolbar, documentExcerpt, readToolbar, resolveTheme } from './preferences';
import { sameFilePath } from './external-files';
describe('editor preferences', () => {
  it('follows system appearance only when requested and preserves optional palettes', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('warm', true)).toBe('warm');
    expect(resolveTheme('sage', true)).toBe('sage');
    expect(resolveTheme('unknown', true)).toBe('dark');
  });
  it('recognizes Windows association paths without merging distinct Mac paths', () => {
    expect(sameFilePath('C:/Notes/Hello.md', '\\\\?\\C:\\Notes\\hello.md')).toBe(true);
    expect(sameFilePath('/Users/me/Hello.md', '/Users/me/hello.md')).toBe(false);
    expect(sameFilePath(undefined, undefined)).toBe(false);
  });
  it('keeps toolbar order, supports hiding and rejects unknown entries', () => {
    localStorage.setItem('chartelis.toolbar', '["mathInline","bold","bold","invalid"]');
    expect(readToolbar()).toEqual(['mathInline', 'bold']);
    localStorage.setItem('chartelis.toolbar', '[]'); expect(readToolbar()).toEqual([]);
    localStorage.setItem('chartelis.toolbar', '{broken'); expect(readToolbar()).toEqual(defaultToolbar);
  });
  it('extracts body text rather than headings and link destinations', () => {
    expect(documentExcerpt('# 文稿标题\n\n这是 **正文**。\n[链接](https://example.com)')).toBe('这是 正文。 链接');
  });
});
