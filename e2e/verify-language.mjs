import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1100, height: 900 } });
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:1420/');
  await expect(page.getByRole('button',{name:'File',exact:true})).toBeVisible();
  await page.keyboard.press('Control+n');
  const editor=page.getByRole('textbox',{name:'Markdown editor',exact:true});
  await editor.click(); await page.keyboard.insertText('Keep my words 你好');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Interface language'})).toHaveValue('system');
  const settingsText=await page.getByRole('dialog').innerText();
  expect(settingsText.replaceAll('简体中文','')).not.toMatch(/[\u3400-\u9fff]/);
  await page.screenshot({path:'artifacts/settings-english.png'});
  await page.getByRole('combobox',{name:'Interface language'}).selectOption('zh-CN');
  await expect(page.getByRole('dialog',{name:'设置',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'关闭对话框'}).click();
  await expect(page.getByRole('textbox',{name:'Markdown 编辑器',exact:true})).toHaveText('Keep my words 你好');
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Markdown 编辑器',exact:true})).not.toContainText('Keep my words');
  await page.getByRole('button',{name:'重做',exact:true}).click();
  await page.getByRole('button',{name:'切换为 Markdown 源码'}).click();
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('combobox',{name:'界面语言'}).selectOption('en');
  await page.getByRole('button',{name:'Close dialog'}).click();
  await expect(page.getByRole('textbox',{name:'Markdown source editor'})).toContainText('Keep my words 你好');
  await page.reload();
  await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Markdown source editor'})).toContainText('Keep my words 你好');
  await page.keyboard.press('Control+f');
  await expect(page.getByRole('search',{name:'Search document'})).toBeVisible();
  await page.getByRole('button',{name:'Close search'}).click();
  await page.getByRole('button',{name:'Help',exact:true}).click();
  await page.getByRole('menuitem',{name:'Character palette',exact:true}).click();
  await page.getByRole('textbox',{name:'Search characters'}).fill('copyright');
  await expect(page.getByRole('button',{name:'Copyright ©',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).click();
  for (const width of [900, 720]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.locator('.topbar').evaluate(header => ({
      left: header.querySelector('.topbar-left').getBoundingClientRect().right,
      right: header.querySelector('.topbar-actions').getBoundingClientRect().left,
      end: header.querySelector('.topbar-actions').getBoundingClientRect().right,
    }));
    expect(layout.left).toBeLessThanOrEqual(layout.right);
    expect(layout.end).toBeLessThanOrEqual(width);
  }
  expect(errors).toEqual([]);
  const mac = await browser.newPage({ locale: 'en-US', viewport: { width: 720, height: 900 } });
  await mac.route('**/src/platform.ts*', route => route.fulfill({ contentType: 'application/javascript', body: 'export const macDesktop = true; export const windowsDesktop = false; export const nativeDialogTitle = () => undefined;' }));
  await mac.goto('http://127.0.0.1:1420/');
  await expect(mac.getByRole('button',{name:'File',exact:true})).toBeVisible();
  const macLayout = await mac.locator('.topbar').evaluate(header => ({
    brand: header.querySelector('.header-settings').getBoundingClientRect().left,
    left: header.querySelector('.topbar-left').getBoundingClientRect().right,
    right: header.querySelector('.topbar-actions').getBoundingClientRect().left,
    end: header.querySelector('.topbar-actions').getBoundingClientRect().right,
  }));
  expect(macLayout.brand).toBeGreaterThanOrEqual(90);
  expect(macLayout.left).toBeLessThanOrEqual(macLayout.right);
  expect(macLayout.end).toBeLessThanOrEqual(720);
  console.log('PASS: system English, settings coverage, instant language switching, undo/history + source preservation, restart, English search and character lookup.');
} finally { await browser.close(); }
