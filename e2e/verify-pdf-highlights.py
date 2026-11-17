"""Compare the actual PDF page images with the browser's original mark fragments."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from pypdf import PdfReader

assets = Path('artifacts')
layout = json.loads((assets / 'highlight-rects.json').read_text())
pages = PdfReader(assets / 'highlight-alignment.pdf').pages
assert len(pages) >= 2
images = [p.images[0].image.convert('RGB') for p in pages]
joined = Image.new('RGB', (images[0].width, sum(i.height for i in images)))
y = 0
for i in images:
    joined.paste(i, (0, y))
    y += i.height
assert 'Mixed' in ''.join(p.extract_text() for p in pages)
r, g, b = joined.split()
actual = ImageChops.subtract(ImageChops.darker(r, b), g).point(lambda v: 255 if v > 100 else 0)
expected = Image.new('L', joined.size)
draw = ImageDraw.Draw(expected)
scale = joined.width / layout['width']
for x, y, w, h in layout['rects']:
    box = tuple(round(n * scale) for n in (x, y, x + w, y + h))
    draw.rectangle(box, fill=255)
    assert actual.crop(box).histogram()[255] > .65 * w * h * scale**2, box
# The small tolerance accounts for per-page raster rounding and antialiasing.
outside = ImageChops.subtract(actual, expected.filter(ImageFilter.MaxFilter(9)))
assert outside.histogram()[255] < actual.histogram()[255] * .01
print(f'Checked {len(layout["rects"])} highlight fragments on {len(pages)} searchable pages.')
