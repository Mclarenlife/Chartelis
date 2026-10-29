import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1280, height: 880 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/src/platform.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const macDesktop = false; export const windowsDesktop = true; export const nativeDialogTitle = title => title;' }));
  await page.route('**/*tauri-apps_api_window*', route => route.fulfill({ contentType: 'application/javascript', body: `
    let maximized = false; const listeners = new Set(); window.windowCalls = [];
    export const getCurrentWindow = () => ({
      isMaximized: async () => maximized,
      onResized: async callback => { listeners.add(callback); return () => listeners.delete(callback); },
      toggleMaximize: async () => { window.windowCalls.push('maximize'); maximized = !maximized; listeners.forEach(fn => fn()); },
      minimize: async () => { window.windowCalls.push('minimize'); },
      close: async () => { window.windowCalls.push('close'); },
    });
  ` }));
  await page.goto('http://127.0.0.1:1420');
  await expect(page.locator('.windows-desktop .topbar')).toBeVisible();
  await expect(page.locator('.topbar .brand, .topbar img')).toHaveCount(0);
  for (const width of [1280, 900, 720]) {
    await page.setViewportSize({ width, height: 880 });
    const layout = await page.locator('.topbar').evaluate(header => {
      const left = header.querySelector('.topbar-left').getBoundingClientRect();
      const actions = header.querySelector('.topbar-actions').getBoundingClientRect();
      const drag = header.querySelector('.window-drag-area').getBoundingClientRect();
      return { left: left.right, actions: actions.left, end: actions.right, drag: drag.width, height: header.getBoundingClientRect().height };
    });
    expect(layout.left).toBeLessThanOrEqual(layout.actions);
    expect(layout.end).toBeLessThanOrEqual(width);
    expect(layout.drag).toBeGreaterThanOrEqual(24);
    expect(layout.height).toBe(64);
  }
  await page.getByRole('button', { name: '最大化窗口', exact: true }).click();
  await page.getByRole('button', { name: '还原窗口', exact: true }).click();
  await page.getByRole('button', { name: '最小化窗口', exact: true }).click();
  await page.getByRole('button', { name: '关闭窗口', exact: true }).click();
  expect(await page.evaluate(() => window.windowCalls)).toEqual(['maximize', 'maximize', 'minimize', 'close']);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('combobox', { name: '界面语言' }).selectOption('en');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('button', { name: 'Close window', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/windows-header-720.png' });
  await page.getByRole('button', { name: 'Hide toolbar' }).click();
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.window-strip')).toHaveCSS('height', '32px');
  const restoreTop = await page.getByRole('button', { name: 'Show toolbar' }).boundingBox();
  const controls = await page.locator('.window-strip .window-controls').boundingBox();
  expect(restoreTop.x).toBeGreaterThan(500);
  expect(restoreTop.x + restoreTop.width).toBeLessThanOrEqual(controls.x);
  await page.getByRole('button', { name: 'Maximize window' }).click();
  await expect(page.getByRole('button', { name: 'Restore window' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.window-strip')).toBeVisible();
  await page.getByRole('button', { name: 'Show toolbar' }).click();
  await expect(page.locator('.topbar')).toBeVisible();
  expect(await page.locator('button[data-tauri-drag-region]').count()).toBe(0);
  expect(errors).toEqual([]);
  console.log('PASS: Windows header layout, no branding, draggable space, window API actions, language switching, collapse/restore and persistence.');
} finally { await browser.close(); }
