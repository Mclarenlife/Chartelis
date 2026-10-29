import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1280, height: 880 } });
  // Exercise the Mac layout in isolation; native controls are verified on macOS.
  await page.route('**/src/platform.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const macDesktop = true; export const windowsDesktop = false; export const nativeDialogTitle = () => undefined;' }));
  await page.goto('http://127.0.0.1:1420/');
  await expect(page.locator('.mac-desktop .topbar')).toBeVisible();
  for (const width of [1280, 900, 720]) {
    await page.setViewportSize({ width, height: 880 });
    const boxes = await page.locator('.topbar').evaluate(header => {
      const brand = header.querySelector('.header-settings').getBoundingClientRect();
      const left = header.querySelector('.topbar-left').getBoundingClientRect();
      const actions = header.querySelector('.topbar-actions').getBoundingClientRect();
      return { height: header.getBoundingClientRect().height, brandLeft: brand.left, leftEnd: left.right, actionsStart: actions.left, actionsEnd: actions.right };
    });
    expect(boxes.height).toBe(64); expect(boxes.brandLeft).toBeGreaterThanOrEqual(90);
    expect(boxes.leftEnd).toBeLessThanOrEqual(boxes.actionsStart);
    expect(boxes.actionsEnd).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.getByRole('button', { name: '关闭对话框' })).toBeVisible();
    await page.getByRole('button', { name: '关闭对话框' }).click();
  }
  await page.screenshot({ path: 'artifacts/mac-header-720.png' });
  await page.getByRole('button', { name: '收起顶栏', exact: true }).click();
  await expect(page.locator('.topbar')).toBeHidden();
  await expect(page.locator('.window-strip')).toHaveCSS('height', '64px');
  expect((await page.getByRole('button', { name: '展开顶栏', exact: true }).boundingBox()).x).toBeGreaterThan(650);
  await page.reload();
  await expect(page.locator('.window-strip')).toBeVisible();
  await page.getByRole('button', { name: '展开顶栏', exact: true }).click();
  await expect(page.locator('.topbar')).toBeVisible();
  expect(await page.locator('button[data-tauri-drag-region]').count()).toBe(0);
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '大纲', exact: true }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('max-width', '220px');
  await expect.poll(async () => (await page.locator('.topbar').boundingBox()).x).toBe(220);
  const fit = await page.locator('.topbar').evaluate(el => el.querySelector('.topbar-left').getBoundingClientRect().right <= el.querySelector('.topbar-actions').getBoundingClientRect().left);
  expect(fit).toBe(true);
  console.log('PASS: Mac traffic-light space, compact responsive header, clickable settings, collapse/restore persistence; native AppKit interaction requires a Mac.');
} finally { await browser.close(); }
