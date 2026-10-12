// Fresh context: leaves the user's open editor and drafts untouched.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: process.env.EXPORT_BROWSER || 'msedge', headless: true });
try {
  const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:1420/');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '跟随系统', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: '亮色', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await dialog.getByRole('button', { name: '暗色', exact: true }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/settings-dark.png' });
  await dialog.getByRole('button', { name: '晨光', exact: true }).click();
  await expect(root).toHaveAttribute('data-theme', 'warm');
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'warm');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '跟随系统', exact: true }).click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'artifacts/settings-light.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: live system appearance, manual override, optional palettes, persisted preference; no page errors.');
} finally { await browser.close(); }
