"""Draw the original town art for Echoes of Astra: a night backdrop and three buildings.

Usage: python3 -I scripts/draw-town.py
Writes public/astra/town/{backdrop,gate,smithy,hall}.png. Fixed seed, so reruns are identical.
Requires Pillow.
"""
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


def outline(img):
    """One-pixel dark outline around every opaque shape, like the hero art."""
    src = img.copy()
    px = src.load()
    out = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3]:
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[x, y] = (26, 16, 32, 255)
    return img


def gate():
    img = Image.new("RGBA", (56, 50))
    d = ImageDraw.Draw(img)
    bricks(d, 12, 20, 43, 49, STONE2, STONE1, STONE3)  # curtain wall
    for x in range(12, 44, 5):  # crenels
        rect(d, x, 17, x + 2, 19, STONE3)
    for tx in (2, 43):  # towers
        bricks(d, tx, 14, tx + 10, 49, STONE2, STONE1, STONE3)
        d.polygon([(tx - 1, 14), (tx + 5, 2), (tx + 11, 14)], fill=SLATE2)
        d.line([(tx + 5, 3), (tx + 10, 13)], fill=SLATE1)
        d.line([(tx + 5, 3), (tx, 13)], fill=SLATE3)
        rect(d, tx + 4, 22, tx + 6, 26, WIN)
        rect(d, tx + 4, 22, tx + 6, 22, GOLD1)
    # arched doorway with a gold frame
    d.rectangle([21, 30, 34, 49], fill=GOLD1)
    d.ellipse([21, 24, 34, 37], fill=GOLD1)
    d.rectangle([23, 32, 32, 49], fill=DOOR)
    d.ellipse([23, 26, 32, 37], fill=DOOR)
    d.line([(24, 31), (31, 31)], fill=GOLD2)
    for y in range(36, 49, 4):  # portcullis
        d.line([(23, y), (32, y)], fill="#2a2638")
    for x in (25, 28, 31):
        d.line([(x, 30), (x, 49)], fill="#2a2638")
    # flag over the wall
    d.line([(27, 4), (27, 17)], fill=WOOD2)
    rect(d, 28, 4, 35, 8, FLAG2)
    d.line([(28, 8), (35, 8)], fill=FLAG1)
    return outline(img)


def smithy():
    img = Image.new("RGBA", (56, 50))
    d = ImageDraw.Draw(img)
    rect(d, 38, 2, 43, 18, STONE1)  # chimney
    rect(d, 38, 2, 43, 3, STONE3)
    rect(d, 40, 0, 41, 1, FIRE2)
    d.polygon([(2, 22), (28, 8), (54, 22)], fill=SLATE2)  # roof
    for y in range(12, 22, 3):
        d.line([(28 - (y - 8) * 2, y), (28 + (y - 8) * 2, y)], fill=SLATE1)
    d.line([(2, 22), (28, 8)], fill=SLATE3)
    bricks(d, 5, 22, 51, 49, STONE2, STONE1, STONE3)
    # forge mouth
    rect(d, 10, 30, 30, 49, INK)
    rect(d, 12, 32, 28, 49, "#2a1410")
    rect(d, 14, 40, 26, 47, FIRE1)
    rect(d, 16, 41, 24, 46, FIRE2)
    rect(d, 18, 42, 22, 45, FIRE3)
    d.line([(10, 30), (30, 30)], fill=STONE4)
    # window
    rect(d, 37, 28, 46, 36, WOOD1)
    rect(d, 38, 29, 41, 35, WIN)
    rect(d, 42, 29, 45, 35, WIN)
    # anvil
    rect(d, 34, 42, 48, 44, STONE4)
    rect(d, 31, 42, 34, 43, STONE3)
    rect(d, 38, 45, 44, 49, STONE1)
    return outline(img)


def hall():
    img = Image.new("RGBA", (56, 50))
    d = ImageDraw.Draw(img)
    d.polygon([(1, 20), (24, 6), (47, 20)], fill=ROOF2)  # roof
    for y in range(10, 20, 3):
        d.line([(24 - (y - 6) * 23 // 14, y), (24 + (y - 6) * 23 // 14, y)], fill=ROOF1)
    d.line([(1, 20), (24, 6)], fill=ROOF3)
    rect(d, 4, 20, 44, 49, PLASTER1)  # timber frame
    rect(d, 4, 20, 44, 21, WOOD1)
    for x in (4, 17, 31, 44):
        d.line([(x, 20), (x, 49)], fill=WOOD2)
    d.line([(4, 34), (44, 34)], fill=WOOD2)
    for x0 in (7, 34):
        rect(d, x0, 24, x0 + 6, 31, WOOD1)
        rect(d, x0 + 1, 25, x0 + 5, 30, WIN)
        d.line([(x0 + 3, 25), (x0 + 3, 30)], fill=WOOD1)
    rect(d, 20, 37, 28, 49, WOOD1)  # door
    rect(d, 21, 38, 27, 49, WOOD2)
    rect(d, 26, 43, 26, 43, GOLD2)
    # crossed-swords sign
    d.line([(20, 12), (28, 18)], fill=STONE4)
    d.line([(28, 12), (20, 18)], fill=STONE4)
    # straw training dummy
    rect(d, 50, 30, 51, 49, WOOD2)
    rect(d, 46, 33, 55, 34, WOOD2)
    rect(d, 48, 28, 53, 40, STRAW1)
    rect(d, 49, 29, 52, 39, STRAW2)
    rect(d, 49, 24, 52, 27, STRAW2)
    rect(d, 50, 33, 51, 34, FLAG2)
    return outline(img)


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


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in (("gate", gate), ("smithy", smithy), ("hall", hall), ("backdrop", backdrop)):
        fn().save(OUT / f"{name}.png")
        print("wrote", OUT / f"{name}.png")


if __name__ == "__main__":
    main()
