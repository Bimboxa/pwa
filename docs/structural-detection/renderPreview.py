"""Render walls.svg (lines + rects only) to preview.png with Pillow.

Optionally composites over a raster of the original plan if a file named
"plan.png" exists in the same directory.
"""

import os
import re

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SVG_PATH = os.path.join(HERE, "walls.svg")
PLAN_PATH = os.path.join(HERE, "plan.png")
OUT_PATH = os.path.join(HERE, "preview.png")

W, H = 2000, 1100
RED = (255, 0, 0, 128)

svg = open(SVG_PATH).read()

if os.path.exists(PLAN_PATH):
    base = Image.open(PLAN_PATH).convert("RGB").resize((W, H))
else:
    base = Image.new("RGB", (W, H), "white")

overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

for m in re.finditer(r"<line[^>]*>", svg):
    tag = m.group(0)

    def attr(name, default=None):
        a = re.search(rf'{name}="([^"]+)"', tag)
        return a.group(1) if a else default

    if attr("x1") is None:  # e.g. "<line>" inside the header comment
        continue
    x1, y1 = float(attr("x1")), float(attr("y1"))
    x2, y2 = float(attr("x2")), float(attr("y2"))
    width = int(float(attr("stroke-width", "20")))
    draw.line([(x1, y1), (x2, y2)], fill=RED, width=width)

for m in re.finditer(r"<rect[^>]*>", svg):
    tag = m.group(0)
    if 'id="column' not in tag:
        continue
    x = float(re.search(r'x="([^"]+)"', tag).group(1))
    y = float(re.search(r'y="([^"]+)"', tag).group(1))
    w = float(re.search(r'width="([^"]+)"', tag).group(1))
    h = float(re.search(r'height="([^"]+)"', tag).group(1))
    draw.rectangle([x, y, x + w, y + h], fill=RED)

base.paste(overlay, (0, 0), overlay)
base.save(OUT_PATH)
print(f"Wrote {OUT_PATH}")
