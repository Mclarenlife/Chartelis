import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1280, height: 880 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:1420');
  await page.keyboard.press('Control+n');
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  const markdown = '# 开始\n\n==测试高亮==\n\n' + Array.from({ length: 12 }, (_, i) => `## 章节 ${i}\n\n${('这是正文，测试大纲稳定定位。\n\n').repeat(8)}`).join('') + '## 最后标题\n';
  await page.getByRole('textbox', { name: 'Markdown 源码编辑器' }).fill(markdown);
  await page.getByRole('button', { name: '切换为即时预览' }).click();
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '大纲', exact: true }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '254px');
  const side = await page.locator('.sidebar').boundingBox();
  const top = await page.locator('.topbar').boundingBox();
  const bottom = await page.locator('.statusbar').boundingBox();
  expect(top.x).toBeGreaterThanOrEqual(side.x + side.width - 1);
  expect(bottom.x).toBe(top.x);
  expect(side.y).toBe(0); expect(side.height).toBe(880);
  expect(await page.locator('.statusbar').evaluate(el => getComputedStyle(el, '::before').backgroundImage)).toContain('linear-gradient');
  const scroller = page.locator('.document-session:not([hidden]) > .writing-scroll:not([hidden])');
  expect((await scroller.boundingBox()).height).toBe(880);
  const outline = page.getByRole('navigation', { name: '文稿大纲', exact: true });
  async function jump(name, source = false) {
    await outline.getByRole('button', { name, exact: true }).click();
    const target = source ? page.locator('.cm-line').filter({ hasText: new RegExp(`^## ${name}$`) }) : page.getByRole('heading', { name, exact: true });
    await expect.poll(async () => (await target.boundingBox())?.y).toBeGreaterThan(150);
    await expect.poll(async () => (await target.boundingBox())?.y).toBeLessThan(350);
    return (await target.boundingBox()).y;
  }
  for (const name of ['章节 8', '章节 2', '章节 2', '最后标题', '章节 6']) await jump(name);
  const first = await jump('章节 6');
  await scroller.evaluate(el => { el.scrollTop += 80; });
  expect(Math.abs(await jump('章节 6') - first)).toBeLessThan(3);
  await page.screenshot({ path: 'artifacts/independent-sidebar.png' });
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  for (const name of ['章节 10', '章节 1', '最后标题', '章节 1']) await jump(name, true);
  await page.getByRole('button', { name: '收起顶栏' }).click();
  await page.getByRole('button', { name: '收起底栏' }).click();
  await jump('章节 9', true);
  await page.getByRole('button', { name: '展开顶栏' }).click();
  await page.getByRole('button', { name: '展开底栏' }).click();
  await page.setViewportSize({ width: 720, height: 700 });
  const layout = await page.locator('.topbar').evaluate(el => ({ leftEnd: el.querySelector('.topbar-left').getBoundingClientRect().right, actionsStart: el.querySelector('.topbar-actions').getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
  expect(layout.leftEnd).toBeLessThanOrEqual(layout.actionsStart);
  expect(layout.right).toBeLessThanOrEqual(720);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(720);
  await page.setViewportSize({ width: 1280, height: 880 });
  await page.getByRole('button', { name: '切换为即时预览' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('group', { name: '高亮颜色', exact: true }).getByRole('button', { name: '蓝色', exact: true }).click();
  await page.getByLabel('自定义高亮颜色', { exact: true }).fill('#bbaadd');
  const sample = await page.locator('.highlight-sample mark').evaluate(el => getComputedStyle(el).backgroundColor);
  await page.getByRole('button', { name: '关闭对话框' }).click();
  expect(await page.locator('.ProseMirror mark').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(sample);
  await page.reload();
  await expect(page.locator('.ProseMirror mark')).toBeAttached();
  expect(await page.locator('.ProseMirror mark').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(sample);
  const exported = await page.evaluate(async () => {
    const { capturePreview, createPreviewSurface } = await import('/src/preview-export.ts');
    const surface = createPreviewSurface(capturePreview('<p><mark>测试高亮</mark></p>', 'serif'));
    const color = getComputedStyle(surface.querySelector('mark')).backgroundColor;
    surface.remove(); return color;
  });
  expect(exported).toBe(sample);
  const files = await page.evaluate(async () => {
    const { capturePreview } = await import('/src/preview-export.ts');
    const { visualBlob } = await import('/src/export.ts');
    const preview = capturePreview('<p><mark>测试高亮</mark></p>', 'serif');
    const result = [];
    for (const format of ['png', 'pdf']) {
      const blob = await visualBlob('==测试高亮==', format, '高亮测试', preview);
      result.push({ type: blob.type, size: blob.size });
    }
    return result;
  });
  expect(files.map(file => file.type)).toEqual(['image/png', 'application/pdf']);
  for (const file of files) expect(file.size).toBeGreaterThan(1000);
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  await page.getByRole('textbox', { name: 'Markdown 源码编辑器' }).press('Control+Home');
  expect(await page.getByRole('textbox', { name: 'Markdown 源码编辑器' }).innerText()).toContain('==测试高亮==');
  expect(errors).toEqual([]);
  console.log('PASS: independent sidebar, overlay footer, repeated and last-heading jumps in both modes, hidden bars, narrow layout.');
} finally { await browser.close(); }
