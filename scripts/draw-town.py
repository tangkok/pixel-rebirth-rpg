"""Town art for Echoes of Astra: draws the night backdrop and copies the buildings the town uses.

Usage: python3 -I scripts/draw-town.py "<path to Tiny Top-Down Village folder>"
Writes public/astra/town/backdrop.png (original, fixed seed) and the used buildings from
Pixel-Deck's Tiny Top-Down Village pack (owner-supplied; its license allows use in games but not
redistributing the whole pack, so only the used buildings are copied). Requires Pillow.
"""
import shutil
import sys
import random
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public/astra/town"
rng = random.Random(11)

INK = "#1a1020"
STONE1, STONE2, STONE3, STONE4 = "#3a3f4f", "#555c70", "#737b90", "#9aa2b6"
SLATE1, SLATE2, SLATE3 = "#232a45", "#2f3c66", "#43558a"
ROOF1, ROOF2, ROOF3 = "#5b1e2a", "#8c2f3a", "#b8463e"
WOOD1, WOOD2, WOOD3 = "#4a2618", "#73401f", "#9c5e2c"
PLASTER1, PLASTER2 = "#b9a98a", "#ddd0b0"
GOLD1, GOLD2 = "#c67b02", "#faca58"
FIRE1, FIRE2, FIRE3 = "#9a2a12", "#e8601c", "#ffc04a"
WIN = "#ffd36b"
DOOR = "#0c0a14"
FLAG1, FLAG2 = "#8c1c28", "#c8323a"
STRAW1, STRAW2 = "#a8782c", "#d8ac4c"


def rect(d, x0, y0, x1, y1, c):
    d.rectangle([x0, y0, x1, y1], fill=c)


def bricks(d, x0, y0, x1, y1, base, line, hi):
    """Stone courses with staggered joints and a lit top edge per course."""
    rect(d, x0, y0, x1, y1, base)
    for row, y in enumerate(range(y0, y1 + 1, 4)):
        d.line([x0, y, x1, y], fill=line)
        if y + 1 <= y1:
            d.line([x0, y + 1, x1, y + 1], fill=hi)
        for x in range(x0 + (row % 2) * 3, x1 + 1, 6):
            d.line([x, y + 1, x, min(y + 3, y1)], fill=line)


def backdrop():
    w, h = 192, 108
    img = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(img)
    top, low = (32, 30, 72), (122, 70, 104)
    for y in range(h):  # dusk sky
        t = min(1, y / 62)
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, low)))
    for _ in range(70):
        x, y = rng.randrange(w), rng.randrange(44)
        d.point((x, y), fill=rng.choice(["#ffffff", "#cfd8ff", "#ffe9a8"]))
    d.ellipse([150, 8, 164, 22], fill="#ffd77a")  # moon
    d.ellipse([154, 7, 167, 20], fill=top)
    for i, (y0, c) in enumerate(((52, "#2c4a3a"), (60, "#23402f"))):  # hills
        pts = [(0, h)]
        for x in range(0, w + 8, 8):
            pts.append((x, y0 + int(4 * ((x * (i + 3)) % 17) / 17) - (6 if 60 < x < 120 and i == 0 else 0)))
        pts.append((w, h))
        d.polygon(pts, fill=c)
    bricks(d, 0, 72, w - 1, h - 1, STONE2, STONE1, STONE3)  # town wall
    for x in range(0, w, 8):
        rect(d, x, 68, x + 4, 71, STONE3)
    for x in range(10, w, 36):  # lanterns
        rect(d, x, 80, x + 2, 83, GOLD2)
        d.point((x + 1, 79), fill=GOLD1)
    return img


# Town spot -> Pixel-Deck building file.
BUILDINGS = {
    "gate": "Guard House",
    "hall": "Adventurers Guild",
    "smithy": "Blacksmith House",
    "farm": "Farmers House",
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    backdrop().save(OUT / "backdrop.png")
    pack = Path(sys.argv[1])
    for spot, name in BUILDINGS.items():
        shutil.copyfile(pack / f"{name}.png", OUT / f"{spot}.png")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
