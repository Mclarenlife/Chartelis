// Run against `pnpm dev`; this fresh browser context never touches the user's workspace.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import assert from 'node:assert/strict';

const sample = String.raw`# 中文导出与公式验证

这段正文应当可以选中和搜索。关键词：ChartelisSearch2026，中文搜索验证。

保留 **粗体文字**、*斜体文字*、~~删除线~~、==高亮文字==，以及行内公式 $E=mc^2$ 和分式 $\frac{a+b}{c}$。English words should remain searchable.

## 原生公式

$$
\int_0^1 x^2\,dx=\frac{1}{3},\qquad \sum_{n=1}^{\infty}\frac{1}{n^2}=\frac{\pi^2}{6}
$$

$$
A=\begin{pmatrix}a&b\\c&d\end{pmatrix},\qquad f(x)=\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}
$$

$$
\sqrt[3]{x^2+1}+\hat{x}+\overline{AB}
$$

## 表格与代码

| 名称 | 公式 | 数值 |
| :--- | :---: | ---: |
| 面积 | $S=\pi r^2$ | 12.56 |
| 分式 | $\frac{1}{2}$ | 0.50 |

> 引用中的中文文字也必须可以搜索，而不是一张图片。

- 第一项列表
- 第二项列表

3. 从三开始
4. 编号延续

` + '```ts\nfunction greet(name: string) {\n    // 中文代码注释，保持缩进\n    const message = "你好，Chartelis";\n    return `${message}, ${name}`;\n}\n```\n\n' +
'## 跨页表格\n\n| 序号 | 正文内容 | 数据 |\n| --- | --- | ---: |\n' +
Array.from({ length: 45 }, (_, i) => `| ${i + 1} | 跨页表格第${i + 1}行，检查行内换行和文字完整性。 | ${(i + 1) * 7} |`).join('\n') +
'\n\n## 最后一段\n\n导出验证结束 EndOfExport2026。\n';

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/export-qa.md', sample);
const browser = await chromium.launch({ channel: process.env.EXPORT_BROWSER || 'msedge', headless: true });
try {
  const page = await browser.newPage({ locale: 'zh-CN' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.EXPORT_TEST_URL || 'http://127.0.0.1:1420'}/e2e/export-harness.html`);
  await page.waitForFunction(() => typeof window.exportSample === 'function');
  for (const format of ['pdf', 'docx', 'png']) {
    const start = Date.now();
    const bytes = Buffer.from(await page.evaluate(async ({ sample, format }) => window.exportSample(sample, format), { sample, format }), 'base64');
    await writeFile(`artifacts/export-qa.${format}`, bytes);
    if (format === 'docx') {
      const xml = strFromU8(unzipSync(bytes)['word/document.xml']);
      assert.equal((xml.match(/<m:oMath>/g) || []).length, 7);
      assert.ok(xml.includes('<m:m>') && xml.includes('<m:f>') && xml.includes('w:tblHeader'));
      assert.ok(!xml.includes('\\frac') && !xml.includes('\\begin'));
    }
    console.log(`${format}: ${bytes.length} bytes, ${Date.now() - start} ms`);
  }
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('.preview-export').count(), 0, 'temporary export surfaces are removed');
} finally { await browser.close(); }
