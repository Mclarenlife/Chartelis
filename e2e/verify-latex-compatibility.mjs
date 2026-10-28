import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const sample = '# 公式兼容\n\n行内公式 \\(k=4\\pi+x_i\\)，标准公式 $x^2$。\n\n\\[\n\\frac{1}{2}\n\n+\\sqrt{x}\n\\]\n\n`\\(code\\)`\n\n结尾';
try {
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:1420');
  await page.keyboard.press('Control+n');
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  const source = page.getByRole('textbox', { name: 'Markdown 源码编辑器' });
  await source.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText(sample);
  await page.getByRole('button', { name: '切换为即时预览' }).click();
  const editor = page.getByRole('textbox', { name: 'Markdown 编辑器', exact: true });
  await expect(editor.locator('.katex')).toHaveCount(1);
  await expect(editor.locator('.math-literal')).toHaveCount(2);
  await toggle(true);
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  expect((await source.locator('.cm-line').allTextContents()).join('\n')).toBe(sample);
  await page.getByRole('button', { name: '切换为即时预览' }).click();
  await toggle(false);
  await editor.click(); await page.keyboard.press('Control+End'); await page.keyboard.insertText('EDIT');
  async function toggle(value) {
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.getByRole('switch', { name: '兼容 LaTeX 公式分隔符' }).setChecked(value);
    await page.screenshot({ path: 'artifacts/latex-compatibility-settings.png' });
    await page.getByRole('button', { name: '关闭对话框' }).click();
  }
  await toggle(true);
  await expect(editor.locator('.katex')).toHaveCount(3);
  await expect(editor.locator('code')).toHaveText('\\(code\\)');
  await exportAndCheck('PNG 图片', 3, 0, 'enabled');
  await exportAndCheck('PDF 文档', 3, 0, 'enabled');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(editor).not.toContainText('EDIT');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await expect(editor).toContainText('EDIT');
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  expect((await source.locator('.cm-line').allTextContents()).join('\n')).toContain('\\(k=4\\pi+x_i\\)');
  expect((await source.locator('.cm-line').allTextContents()).join('\n')).toContain('\\[');
  expect((await source.locator('.cm-line').allTextContents()).join('\n')).toContain('\\frac{1}{2}\n\n+\\sqrt{x}');
  const edited = (await source.locator('.cm-line').allTextContents()).join('\n');
  await toggle(false); expect((await source.locator('.cm-line').allTextContents()).join('\n')).toBe(edited);
  await toggle(true); expect((await source.locator('.cm-line').allTextContents()).join('\n')).toBe(edited);
  await page.getByRole('button', { name: '切换为即时预览' }).click();
  await expect(editor.locator('.katex')).toHaveCount(3);
  await page.reload();
  await expect(editor.locator('.katex')).toHaveCount(3);
  await toggle(false);
  await expect(editor.locator('.math-literal')).toHaveCount(2);
  await expect(editor.locator('.katex')).toHaveCount(1);
  await exportAndCheck('PNG 图片', 1, 2, 'disabled');
  await page.getByRole('button', { name: '切换为 Markdown 源码' }).click();
  expect((await source.locator('.cm-line').allTextContents()).join('\n')).toBe(edited);
  expect(errors).toEqual([]);
  async function exportAndCheck(format, math, literal, state) {
    await page.evaluate(() => {
      window.exportMath = null;
      window.exportObserver = new MutationObserver(() => {
        const surface = document.querySelector('.preview-export');
        if (surface) window.exportMath = { math: surface.querySelectorAll('.katex').length, literal: surface.querySelectorAll('.math-literal').length };
      });
      window.exportObserver.observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole('button', { name: '导出文稿', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: new RegExp(format) }).click();
    await (await download).saveAs(`artifacts/latex-${state}.${format.startsWith('PNG') ? 'png' : 'pdf'}`);
    expect(await page.evaluate(() => { window.exportObserver.disconnect(); return window.exportMath; })).toEqual({ math, literal });
    await expect(page.getByRole('dialog', { name: '导出文稿', exact: true })).toHaveCount(0);
  }
  console.log('PASS: default off, live preview toggle, multiline formulas, code protection, undo/redo, delimiter preservation, source-mode stability and restart persistence.');
} finally { await browser.close(); }
