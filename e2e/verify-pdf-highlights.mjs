import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:1420/e2e/export-harness.html');
  const { pdf, rects, width } = await page.evaluate(async () => {
    const { textPdf } = await import('/src/pdf-export.ts');
    const { createPreviewSurface } = await import('/src/preview-export.ts');
    const paragraph = '<p>普通文字在前。<mark>跨行高亮应该紧贴文字。' +
      'Mixed words 跨行高亮。'.repeat(8) + '<strong>加粗高亮</strong></mark> 普通结尾。</p>';
    const surface = createPreviewSurface({ html: paragraph.repeat(12), width: 580, font: 'serif',
      variables: { '--highlight-color': '#ff00ff' } });
    await document.fonts.ready;
    const base = surface.getBoundingClientRect();
    const rects = [...surface.querySelectorAll('mark')].flatMap(mark =>
      [...mark.getClientRects()].map(r => [r.left - base.left, r.top - base.top, r.width, r.height]));
    const blob = await textPdf(surface, '跨行高亮定位');
    const pdf = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
    return { pdf, rects, width: base.width };
  });
  expect(rects.length).toBeGreaterThan(24);
  await writeFile('artifacts/highlight-alignment.pdf', Buffer.from(pdf, 'base64'));
  await writeFile('artifacts/highlight-rects.json', JSON.stringify({ width, rects }));
} finally { await browser.close(); }
