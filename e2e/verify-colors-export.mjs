import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:1420/'); await page.keyboard.press('Control+n');
  const rich = page.getByRole('textbox', { name: 'Markdown 编辑器', exact: true });
  await rich.click(); await page.keyboard.type('Color test'); await page.keyboard.press('Shift+Home');
  await rich.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Markdown 格式', exact: true });
  const colors = menu.getByRole('group', { name: '颜色', exact: true });
  await expect(colors.getByRole('menuitem')).toHaveCount(9);
  await page.screenshot({ path: 'artifacts/color-menu.png' });
  await colors.getByRole('menuitem', { name: '蓝色', exact: true }).click();
  await expect(rich.locator('[data-text-color]')).toHaveCSS('color', 'rgb(57, 123, 196)');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(rich.locator('[data-text-color]')).toHaveCount(0);
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  const source = page.getByRole('textbox', { name: 'Markdown 源码编辑器' });
  await expect(source).toContainText('<span style="color: #397bc4">Color test</span>');
  await page.getByRole('button', { name: '切换为即时预览' }).click();
  await expect(rich.locator('[data-text-color]')).toHaveText('Color test');
  await rich.click(); await page.keyboard.press('Control+a'); await rich.click({ button: 'right' });
  await expect(colors.getByRole('menuitem').first()).toHaveAttribute('aria-label', '上次使用 #397bc4');
  await colors.getByLabel('自定义文字颜色').fill('#765432');
  await menu.getByRole('button', { name: '应用颜色' }).click();
  await expect(rich.locator('[data-text-color]')).toHaveCSS('color', 'rgb(118, 84, 50)');
  await page.reload(); await expect(rich.locator('[data-text-color]')).toHaveText('Color test');
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  await source.click(); await page.keyboard.press('Control+a'); await source.click({ button: 'right' });
  await colors.getByRole('menuitem', { name: '绿色', exact: true }).click();
  await expect(source).toContainText('<span style="color: #438c59">Color test</span>');
  await source.fill('<span style="color: #397bc4">outer <span style="color: #cd4c4c">inner</span> tail</span>');
  await page.getByRole('button', { name: '切换为即时预览' }).click();
  await expect(rich.locator('[data-text-color="#397bc4"]').last()).toContainText('tail');
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  const sample = '# 样式一致 Style fidelity\n\n这段文字可搜索：SearchableColor2026。 **粗体** *斜体* ==高亮==。\n\n<span style="color: #cd4c4c">红色文字 Colored text</span>\n\n## 表格与公式\n\n| 标题 | 内容 |\n| --- | --- |\n| 中文 | $E=mc^2$ |\n\n```ts\nconst text = "保持代码样式";\n```\n\n- 列表条目\n- 第二项\n\n> 引用文字\n\n' + Array.from({ length: 40 }, (_, i) => `段落 ${i}：保留当前排版与颜色，检查分页文字不会截断。`).join('\n\n') + '\n\nEndOfStyledExport';
  await source.fill(sample); await page.getByRole('button', { name: '切换为即时预览' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '暗色', exact: true }).click();
  await page.getByRole('button', { name: /书页.*宋体/ }).click();
  await page.getByRole('button', { name: '关闭对话框' }).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/export-preview-dark.png' });
  // Compare the shared surface's computed typography to the live preview.
  const comparison = await page.evaluate(async () => {
    const { capturePreview, createPreviewSurface } = await import('/src/preview-export.ts');
    const live = document.querySelector('.document-session:not([hidden]) .ProseMirror');
    const snapshot = capturePreview(live.innerHTML, 'serif');
    const surface = createPreviewSurface(snapshot);
    const props = ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'color'];
    const result = ['h1', 'p', 'strong', 'pre code', 'table', '[data-text-color]'].map(selector => {
      const a = getComputedStyle(live.querySelector(selector)); const b = getComputedStyle(surface.querySelector(selector));
      return props.every(prop => a[prop] === b[prop]);
    });
    surface.remove(); return result;
  });
  expect(comparison.every(Boolean)).toBe(true);
  for (const format of ['PNG 图片', 'PDF 文档']) {
    await page.getByRole('button', { name: '导出文稿', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: new RegExp(format) }).click();
    await (await download).saveAs(`artifacts/styled-export.${format.startsWith('PNG') ? 'png' : 'pdf'}`);
    await expect(page.getByRole('dialog', { name: '导出文稿', exact: true })).toHaveCount(0);
  }
  await expect(page.locator('.preview-export')).toHaveCount(0);
  // Exporting from source must still use preview styling and current source content.
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  await source.click(); await page.keyboard.press('Control+a');
  await page.keyboard.insertText('# Source export\n\n<span style="color: #397bc4">SOURCE-ONLY-2026</span>');
  await expect(source).toContainText('SOURCE-ONLY-2026');
  await page.getByRole('button', { name: '导出文稿', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /PDF 文档/ }).click();
  await (await download).saveAs('artifacts/styled-source-export.pdf');
  await expect(page.getByRole('button', { name: '切换为即时预览' })).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile('artifacts/styled-export.md', sample);
  console.log('PASS: preset/custom/recent colors, Markdown round-trip + undo, preview CSS parity, dark PNG/PDF and source-mode export.');
} finally { await browser.close(); }
