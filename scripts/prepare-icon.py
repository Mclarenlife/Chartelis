"""Remove the original icon's external matte without repainting its artwork.

Requires Pillow. Coordinates trace the original 1254px tile just
inside its outer rim, excluding the white backdrop and exterior shadow.
"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
source = Image.open(root / 'design/chartelis-icon-original.png').convert('RGBA')
assert source.size == (1254, 1254), 'Recheck the contour when changing the source.'
scale = 4
mask = Image.new('L', (1254 * scale, 1254 * scale))
points = []

def move(x, y):
    points.append((x, y))

def line(x, y):
    points.append((x, y))

def curve(x1, y1, x2, y2, x3, y3):
    x0, y0 = points[-1]
    for i in range(1, 129):
        t = i / 128
        u = 1 - t
        points.append((u**3*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t**3*x3,
                       u**3*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t**3*y3))

move(354, 79)
line(899, 79)
curve(1105, 79, 1175, 150, 1175, 356)
line(1175, 899)
curve(1175, 1102, 1107, 1166, 899, 1166)
line(354, 1166)
curve(146, 1166, 77, 1101, 77, 899)
line(77, 356)
curve(77, 150, 146, 79, 354, 79)
ImageDraw.Draw(mask).polygon([(x * scale, y * scale) for x, y in points], fill=255)
mask = mask.resize(source.size, Image.Resampling.LANCZOS)
source.putalpha(mask)
source.save(root / 'public/icon.png')
print('Saved transparent public/icon.png; original RGB artwork preserved.')
