// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => false), invoke: vi.fn() }));
import { isTauri, invoke } from '@tauri-apps/api/core';
import { initializeLanguage, needsLanguageChoice, resolveLanguage, setLanguage, t, tf } from './i18n';
afterEach(() => { localStorage.clear(); setLanguage('zh-CN'); localStorage.clear(); vi.mocked(isTauri).mockReturnValue(false); vi.unstubAllGlobals(); });
describe('language selection', () => {
  it('resolves supported system languages in preference order', () => {
    expect(resolveLanguage('system', ['fr', 'en-US', 'zh-CN'])).toBe('en');
    expect(resolveLanguage('system', ['zh-TW', 'en'])).toBe('zh-CN');
    expect(resolveLanguage('system', ['ja'])).toBe('en');
    expect(resolveLanguage('zh-CN', ['en'])).toBe('zh-CN');
  });
  it('persists explicit choices and safely interpolates values', async () => {
    setLanguage('en'); expect(t('保存')).toBe('Save');
    expect(tf`打开失败：${'<script>'}`).toBe('Could not open: <script>');
    await initializeLanguage(); expect(t('设置')).toBe('Settings');
    expect(document.documentElement.lang).toBe('en');
  });
  it('uses installer language once and never overrides an existing preference', async () => {
    vi.mocked(isTauri).mockReturnValue(true); vi.mocked(invoke).mockResolvedValue('en');
    await initializeLanguage(); expect(t('设置')).toBe('Settings'); expect(needsLanguageChoice).toBe(false);
    setLanguage('zh-CN'); await initializeLanguage(); expect(t('设置')).toBe('设置');
  });
  it('offers first-launch selection without installer metadata, then remembers it', async () => {
    vi.mocked(isTauri).mockReturnValue(true); vi.mocked(invoke).mockResolvedValue(null);
    vi.stubGlobal('navigator', { languages: ['en-GB'] });
    await initializeLanguage(); expect(needsLanguageChoice).toBe(true);
    setLanguage('system'); await initializeLanguage(); expect(needsLanguageChoice).toBe(false);
  });
});
