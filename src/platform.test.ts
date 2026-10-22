import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn() }));
import { isTauri } from '@tauri-apps/api/core';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('native window platform', () => {
  it('lets macOS choose native panel titles', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.stubGlobal('navigator', { platform: 'MacIntel' });
    const platform = await import('./platform');
    expect(platform.macDesktop).toBe(true);
    expect(platform.nativeDialogTitle('导出文稿')).toBeUndefined();
  });
  it('keeps Windows dialog titles and layout', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.stubGlobal('navigator', { platform: 'Win32' });
    const platform = await import('./platform');
    expect(platform.macDesktop).toBe(false);
    expect(platform.nativeDialogTitle('导出文稿')).toBe('导出文稿');
  });
  it('does not reserve native window controls in a Mac browser', async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.stubGlobal('navigator', { platform: 'MacIntel' });
    expect((await import('./platform')).macDesktop).toBe(false);
  });
});
