"""Run after verify-exports.mjs. Requires pypdf and pypdfium2."""
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium

source = Path('artifacts/export-qa.pdf')
reader = PdfReader(source)
text = '\n'.join(page.extract_text() for page in reader.pages)
for phrase in ['中文搜索验证', 'ChartelisSearch2026', '中文代码注释', 'English', 'EndOfExport2026']:
    assert phrase in text, f'Missing selectable text: {phrase}'
assert '\x00' not in text, 'Missing glyphs in font mapping'
for row in range(1, 46):
    assert f'跨页表格第{row}行' in text, f'Missing table row {row}'
Path('artifacts/export-qa-extracted.txt').write_text(text, encoding='utf-8')
document = pdfium.PdfDocument(source)
for index, page in enumerate(document):
    page.render(scale=1.4).to_pil().save(f'artifacts/export-qa-page-{index + 1}.png')
print(f'PDF text verification passed: {len(reader.pages)} pages. Inspect the rendered PNGs for visible glyphs and pagination.')
