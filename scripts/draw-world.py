"""Draw the original 16x16 world tileset and the Forest Wolf sprite for Echoes of Astra.

Usage: python3 -I scripts/draw-world.py
Writes public/astra/world/tiles.png (one row of 16px tiles, order = TILES below, which
src/astra/world.ts mirrors) and public/astra/world/wolf.png (2 idle frames, 32x24).
Pixel art is generated from a fixed seed so reruns give identical files. Requires Pillow.
"""
import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public/astra/world"
T = 16
rng = random.Random(7)

# Palette leans on the Heroes99 warm outline so tiles sit with the hero art.
INK = "#240000"
G1, G2, G3, G4 = "#2f6b3a", "#3f8a45", "#5aa84f", "#8fcf63"
F1, F2, F3 = "#1b3d2c", "#24523a", "#33704a"  # forest floor
D1, D2, D3 = "#7a5230", "#a0713f", "#c79a5b"  # dirt path
W1, W2, W3 = "#1f4f8a", "#2f74b5", "#8fd0f0"
WOOD1, WOOD2, WOOD3 = "#582820", "#833f1e", "#a8642a"
ROOF1, ROOF2, ROOF3 = "#5b1e2a", "#8c2f3a", "#c0524e"
STONE1, STONE2, STONE3 = "#3c4250", "#626b7d", "#9aa3b5"
GOLD, LIGHT = "#c67b02", "#faca58"
LEAF1, LEAF2, LEAF3 = "#1d4a2a", "#2f6b3a", "#4f9a4a"
CRYS1, CRYS2, CRYS3 = "#2a5fa8", "#5ab0f0", "#d8f4ff"


def tile() -> Image.Image:
    return Image.new("RGBA", (T, T))


def px(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), Image.new("RGBA", (1, 1), c).getpixel((0, 0)))


def fill(img, c):
    for x in range(T):
        for y in range(T):
            px(img, x, y, c)


def speckle(img, colors, n):
    for _ in range(n):
        px(img, rng.randrange(T), rng.randrange(T), rng.choice(colors))


def grass(alt=False):
    img = tile()
    fill(img, G2)
    speckle(img, [G1, G3], 26)
    for _ in range(3 if alt else 1):  # tufts
        x, y = rng.randrange(2, 13), rng.randrange(3, 14)
        for dx, dy in ((0, 0), (1, -1), (2, 0), (1, 0)):
            px(img, x + dx, y + dy, G4 if dy < 0 else G3)
    return img


def flowers():
    img = grass()
    for c in ("#f2e86d", "#f08fb0", "#ffffff", "#f2e86d"):
        x, y = rng.randrange(1, 14), rng.randrange(1, 14)
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            px(img, x + dx, y + dy, c)
        px(img, x, y, GOLD)
    return img


def path(floor=False):
    img = tile()
    fill(img, D2 if not floor else F3)
    speckle(img, [D1, D3] if not floor else [D1, D2, F2], 30)
    for _ in range(3):  # pebbles
        x, y = rng.randrange(1, 15), rng.randrange(1, 15)
        px(img, x, y, D3 if not floor else D2)
        px(img, x + 1, y, D1)
    return img


def water():
    img = tile()
    fill(img, W2)
    speckle(img, [W1], 20)
    for y in (3, 9, 14):
        x = rng.randrange(1, 9)
        for dx in range(4):
            px(img, x + dx, y, W3)
    return img


def canopy(img, cx, cy, r, dark, mid, light):
    for x in range(T):
        for y in range(T):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d <= r * r:
                px(img, x, y, mid)
            if d <= r * r and (x - cx + 2) ** 2 + (y - cy + 2) ** 2 > (r - 1) ** 2 and x >= cx or y > cy + r - 2 and d <= r * r:
                px(img, x, y, dark)
            if (x - cx + 2) ** 2 + (y - cy + 2) ** 2 <= (r // 2) ** 2:
                px(img, x, y, light)
    for x in range(T):
        for y in range(T):
            if img.getpixel((x, y))[3] == 0 and any(
                0 <= x + a < T and 0 <= y + b < T and img.getpixel((x + a, y + b))[3] and img.getpixel((x + a, y + b))[:3] != (0, 0, 0)
                for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ) and (x - cx) ** 2 + (y - cy) ** 2 <= (r + 1) ** 2:
                px(img, x, y, INK)


def tree(base, dense=False):
    img = base.copy()
    # trunk
    for y in range(10, 15):
        for x in (7, 8):
            px(img, x, y, WOOD2 if x == 7 else WOOD1)
        px(img, 6, y, INK)
        px(img, 9, y, INK)
    px(img, 7, 15, INK)
    px(img, 8, 15, INK)
    top = tile()
    canopy(top, 8, 6, 6 if not dense else 7, LEAF1, LEAF2 if not dense else LEAF1, LEAF3 if not dense else LEAF2)
    img.alpha_composite(top)
    return img


def bush():
    img = grass()
    top = tile()
    canopy(top, 8, 9, 5, LEAF1, LEAF2, LEAF3)
    img.alpha_composite(top)
    return img


def wall():
    img = tile()
    fill(img, WOOD3)
    for y in range(T):
        for x in (0, 5, 10, 15):
            px(img, x, y, WOOD2)
    for y in (0, 15):
        for x in range(T):
            px(img, x, y, WOOD1)
    speckle(img, [WOOD2], 10)
    # window
    for x in range(6, 10):
        for y in range(5, 9):
            px(img, x, y, "#ffe9a8" if (x, y) != (6, 5) else "#fff6d0")
    for x in range(5, 11):
        px(img, x, 4, INK)
        px(img, x, 9, INK)
    for y in range(4, 10):
        px(img, 5, y, INK)
        px(img, 10, y, INK)
    return img


def roof():
    img = tile()
    fill(img, ROOF2)
    for y in range(0, T, 4):
        for x in range(T):
            px(img, x, y, ROOF1)
        for x in range((y // 4) % 2 * 4, T, 8):
            for yy in range(y, y + 4):
                px(img, x, yy, ROOF1)
    speckle(img, [ROOF3], 12)
    return img


def door():
    img = wall()
    for x in range(4, 12):
        for y in range(4, 16):
            px(img, x, y, WOOD1 if x in (4, 11) or y == 4 else WOOD2)
    px(img, 9, 10, LIGHT)
    return img


def fence(base):
    img = base.copy()
    for x in range(T):
        px(img, x, 6, WOOD3)
        px(img, x, 7, WOOD2)
        px(img, x, 11, WOOD3)
        px(img, x, 12, WOOD2)
        px(img, x, 5, INK)
        px(img, x, 13, INK)
    for x in (2, 13):
        for y in range(3, 15):
            px(img, x, y, WOOD3)
            px(img, x + 1, y, WOOD1)
    return img


def rock(base):
    img = base.copy()
    for x in range(T):
        for y in range(T):
            d = ((x - 8) / 7) ** 2 + ((y - 9) / 6) ** 2
            if d <= 1:
                px(img, x, y, STONE2 if y > 7 else STONE3)
            elif d <= 1.3:
                px(img, x, y, INK)
    speckle_in = [(rng.randrange(3, 13), rng.randrange(6, 14)) for _ in range(6)]
    for x, y in speckle_in:
        px(img, x, y, STONE1)
    return img


def forest_floor():
    img = tile()
    fill(img, F2)
    speckle(img, [F1, F3], 30)
    return img


def crystal(base):
    """Save crystal (checkpoint) on a stone base."""
    img = base.copy()
    for x in range(3, 13):
        px(img, x, 14, STONE2)
        px(img, x, 15, INK)
    for x in range(4, 12):
        px(img, x, 13, STONE3)
    for y in range(1, 13):
        w = min(y, 13 - y) // 2 + 1
        for x in range(8 - w, 8 + w):
            px(img, x, y, CRYS2 if x >= 8 else CRYS3)
        px(img, 8 - w - 1, y, INK)
        px(img, 8 + w, y, INK)
    px(img, 8, 0, INK)
    for y in range(3, 11):
        px(img, 9, y, CRYS1)
    return img


def chest(base, opened):
    img = base.copy()
    for x in range(2, 14):
        for y in range(6, 15):
            px(img, x, y, WOOD2)
    for x in range(2, 14):
        px(img, x, 9, GOLD)
        px(img, x, 15, INK)
        px(img, x, 5, INK)
    for y in range(5, 16):
        px(img, 1, y, INK)
        px(img, 14, y, INK)
    if opened:
        for x in range(2, 14):
            for y in range(6, 9):
                px(img, x, y, "#1a0d06")
        for x in range(2, 14):
            px(img, x, 3, WOOD3)
            px(img, x, 4, WOOD2)
            px(img, x, 2, INK)
    else:
        for x in range(2, 14):
            px(img, x, 6, WOOD3)
        for x, y in ((7, 9), (8, 9), (7, 10), (8, 10)):
            px(img, x, y, LIGHT)
    return img


def sign(base):
    img = base.copy()
    for y in range(9, 16):
        px(img, 7, y, WOOD1)
        px(img, 8, y, WOOD2)
    for x in range(2, 14):
        for y in range(3, 9):
            px(img, x, y, WOOD3)
        px(img, x, 2, INK)
        px(img, x, 9, INK)
    for y in range(2, 10):
        px(img, 1, y, INK)
        px(img, 14, y, INK)
    for x in range(4, 12, 2):
        px(img, x, 5, WOOD1)
        px(img, x + 1, 6, WOOD1)
    return img


def bridge():
    img = water()
    for y in range(T):
        for x in range(1, 15):
            px(img, x, y, WOOD3 if y % 4 else WOOD1)
        px(img, 0, y, INK)
        px(img, 15, y, INK)
    return img


def wolf_frames() -> Image.Image:
    """Side-view grey wolf facing left, 32x24, two breathing frames."""
    sheet = Image.new("RGBA", (64, 24))
    FUR1, FUR2, FUR3, EYE = "#3a3f4f", "#5d6478", "#9aa3b5", "#ffcf4a"
    for f in range(2):
        img = Image.new("RGBA", (32, 24))
        b = f  # body rises a pixel on frame 1
        body = [(x, y) for x in range(9, 27) for y in range(10 - b, 18) if ((x - 18) / 9) ** 2 + ((y - 14 + b / 2) / 4.5) ** 2 <= 1]
        head = [(x, y) for x in range(2, 13) for y in range(5 - b, 14 - b) if ((x - 8) / 5) ** 2 + ((y - 9 + b) / 4) ** 2 <= 1]
        snout = [(x, y) for x in range(0, 5) for y in range(10 - b, 13 - b)]
        ears = [(6, 3 - b), (7, 2 - b), (7, 3 - b), (9, 3 - b), (10, 2 - b), (10, 3 - b), (6, 4 - b), (10, 4 - b)]
        tail = [(26 + i, 11 - b - i // 2) for i in range(6)] + [(27 + i, 12 - b - i // 2) for i in range(5)]
        legs = [(x, y) for x in (11, 12, 16, 17, 21, 22, 24, 25) for y in range(17, 22)]
        shape = set(body + head + snout + ears + tail + legs)
        for x, y in shape:
            px(img, x, y, FUR2)
        for x, y in shape:  # belly / underside shade
            if (x, y + 1) not in shape or y > 15:
                px(img, x, y, FUR1)
        for x, y in head + [(x, y) for x, y in body if y < 12 - b]:
            if (x, y - 1) not in shape:
                px(img, x, y, FUR3)
        for x in range(32):
            for y in range(24):
                if (x, y) not in shape and any((x + a, y + c) in shape for a, c in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    px(img, x, y, INK)
        px(img, 5, 8 - b, EYE)
        px(img, 0, 10 - b, INK)
        px(img, 1, 12 - b, "#e8e0c8")  # fang
        sheet.paste(img, (32 * f, 0))
    return sheet


def battle_forest() -> Image.Image:
    """240x136 side-view Whispering Forest duel backdrop with a raised earth platform."""
    W, H = 240, 136
    img = Image.new("RGBA", (W, H))
    sky = ["#16304a", "#1d3f5c", "#26506c", "#356a7c", "#4f8a86"]
    for y in range(H):  # banded sky with ordered dither between bands
        band = min(len(sky) - 1, y * len(sky) // 70)
        nxt = min(len(sky) - 1, band + 1)
        frac = (y * len(sky) / 70) % 1
        for x in range(W):
            px(img, x, y, sky[nxt] if frac > 0.5 and (x + y) % 2 else sky[band])
    # light shafts through the canopy
    for sx in (40, 120, 190):
        for y in range(0, 90):
            for x in range(sx + y // 3, sx + y // 3 + 6):
                if (x + y) % 3 == 0:
                    px(img, x, y, "#6fa58f")

    def trunks(color, dark, count, top, width, seed):
        r = random.Random(seed)
        for i in range(count):
            x0 = r.randrange(-10, W)
            w = r.randrange(width - 2, width + 3)
            for x in range(x0, x0 + w):
                for y in range(top, 100):
                    px(img, x, y, dark if x in (x0, x0 + w - 1) or (x - x0) * 3 > w * 2 else color)
            # canopy blob
            cx, cy, cr = x0 + w // 2, top + 4, w + 8
            for x in range(cx - cr, cx + cr):
                for y in range(cy - cr // 2 - 6, cy + cr // 2):
                    if ((x - cx) / cr) ** 2 + ((y - cy) / (cr * 0.6)) ** 2 <= 1 and r.random() > 0.05:
                        px(img, x, y, dark if y > cy + 2 else color)

    trunks("#24453f", "#1a3330", 9, 18, 7, 1)  # far layer
    trunks("#2f5a3c", "#1d3a2a", 6, 6, 11, 2)  # near layer
    # overhead canopy band and ground bushes frame the clearing
    r = random.Random(3)
    for x in range(W):
        depth = 8 + int(5 * abs(((x / 37.0) % 2) - 1)) + r.randrange(3)
        for y in range(depth):
            px(img, x, y, "#1d3a2a" if y < depth - 2 else ("#2f5a3c" if (x + y) % 2 else "#1d3a2a"))
    for cx in (8, 60, 150, 228):
        for x in range(cx - 14, cx + 14):
            for y in range(84, 97):
                d = ((x - cx) / 14) ** 2 + ((y - 97) / 12) ** 2
                if d <= 1:
                    px(img, x, y, "#2f6b3a" if d > 0.55 or (x + y) % 3 else "#4f9a4a")
                elif d <= 1.12 and y < 96:
                    px(img, x, y, INK)
    # ground strip
    for y in range(96, H):
        for x in range(W):
            px(img, x, y, "#2f5a2c" if (x * 7 + y * 3) % 11 else "#3f7a3a")
    for x in range(W):  # grass fringe
        h = 1 + (x * 5 % 3)
        for y in range(96 - h, 97):
            px(img, x, y, "#4f9a4a")
    # raised earth platform (trapezoid) where the duel happens
    top, bottom = 100, 126
    for y in range(top, bottom):
        inset = (bottom - y) // 2
        for x in range(14 + inset, W - 14 - inset):
            edge = y in (top, top + 1)
            c = "#c79a5b" if edge else ("#a0713f" if (x // 6 + y // 3) % 2 else "#94673a")
            px(img, x, y, c)
        px(img, 13 + inset, y, INK)
        px(img, W - 14 - inset, y, INK)
    for x in range(14 + (bottom - top) // 2, W - 14 - (bottom - top) // 2):
        px(img, x, top - 1, INK)
    for y in range(bottom, bottom + 4):  # front face
        for x in range(14, W - 14):
            px(img, x, y, "#7a5230" if y < bottom + 3 else INK)
    for _ in range(40):  # pebbles
        x, y = rng.randrange(30, W - 30), rng.randrange(top + 3, bottom - 2)
        px(img, x, y, D3)
    return img



# ---------- town (separate seed so the tiles above stay byte-identical) ----------
r2 = random.Random(11)
CB0, CB1, CB2, CB3 = "#3b332d", "#6a5d50", "#857765", "#a89a84"  # cobble gap, stone, light, highlight


def cobble(worn=False):
    img = tile()
    fill(img, CB0)
    for row in range(4):
        y0 = row * 4
        x = -r2.randrange(0, 4) if row % 2 else 0
        while x < T:
            w = r2.randrange(4, 7)
            body = r2.choice([CB1, CB1, CB2]) if not worn else r2.choice([CB1, "#5f6b4a", CB2])
            for xx in range(x, x + w - 1):
                for yy in range(y0, y0 + 3):
                    px(img, xx, yy, body)
            px(img, x, y0, CB3)
            px(img, x + 1, y0, CB3)
            x += w
    if worn:
        for _ in range(5):
            px(img, r2.randrange(T), r2.randrange(T), "#4f7a3a")  # moss
    return img


def plaza(worn=False):
    """Warm flagstones laid in staggered courses; the worn variant adds cracks and moss."""
    img = tile()
    fill(img, "#5e5246")
    tones = ["#9a8b76", "#a6977f", "#8f816d", "#b0a189"]
    for row in range(2):
        y0 = row * 8
        x = -4 if row % 2 else 0
        while x < T:
            w = 8
            body = r2.choice(tones)
            for xx in range(x, x + w - 1):
                for yy in range(y0, y0 + 7):
                    px(img, xx, yy, body)
            for xx in range(x, x + w - 1):
                px(img, xx, y0, "#c2b49b")  # lit top edge
                px(img, xx, y0 + 6, "#7b6e5c")  # shaded bottom edge
            x += w
    for _ in range(10):
        px(img, r2.randrange(T), r2.randrange(T), "#7f7262")
    if worn:
        x, y = r2.randrange(2, 12), r2.randrange(2, 12)
        for k in range(5):
            px(img, x + k, y + (k % 2), "#5e5246")  # crack
        for _ in range(6):
            px(img, r2.randrange(T), r2.randrange(T), "#5f7a43")
    return img


def lamp(base):
    img = base.copy()
    for y in range(13, 16):  # foot
        for x in range(5, 11):
            px(img, x, y, INK if y == 15 or x in (5, 10) else STONE1)
    for y in range(5, 13):  # pole
        px(img, 7, y, STONE1)
        px(img, 8, y, INK)
    for y in range(0, 6):  # lantern
        for x in range(5, 11):
            edge = x in (5, 10) or y in (0, 5)
            px(img, x, y, INK if edge else ("#fff6d0" if (x, y) == (7, 2) else LIGHT))
    px(img, 6, 0, "#2b2b34")
    px(img, 9, 0, "#2b2b34")
    return img


def barrel(base):
    img = base.copy()
    for y in range(3, 16):
        for x in range(3, 13):
            bulge = 1 if 5 <= y <= 12 else 0
            if x < 4 - bulge or x > 11 + bulge:
                continue
            c = WOOD3 if x < 7 else WOOD2
            if y in (5, 11):
                c = STONE1
            if x in (4 - bulge, 11 + bulge) or y in (3, 15):
                c = INK
            px(img, x, y, c)
    for x in range(5, 11):
        px(img, x, 4, D3)
    return img


def crate(base):
    img = base.copy()
    for y in range(4, 16):
        for x in range(2, 14):
            c = WOOD3
            if x in (2, 13) or y in (4, 15):
                c = INK
            elif x == y - 2 or x in (3, 12) or y in (5, 14):
                c = WOOD2
            px(img, x, y, c)
    return img


def planter(base):
    img = base.copy()
    top = tile()
    canopy(top, 8, 7, 5, LEAF1, LEAF2, LEAF3)
    img.alpha_composite(top)
    for c in ("#f08fb0", "#f2e86d", "#ffffff", "#c0524e"):
        x, y = r2.randrange(4, 12), r2.randrange(4, 9)
        px(img, x, y, c)
    for y in range(10, 16):
        for x in range(1, 15):
            px(img, x, y, INK if x in (1, 14) or y in (10, 15) else (WOOD3 if y < 13 else WOOD2))
    return img


def fountain() -> Image.Image:
    """48x48 stone fountain for the town square, drawn top-down to sit on plaza tiles."""
    img = Image.new("RGBA", (48, 48))
    for y in range(48):
        for x in range(48):
            d = ((x - 23.5) / 22) ** 2 + ((y - 26) / 20) ** 2
            if d <= 0.62:
                px(img, x, y, W2 if (x * 7 + y * 3) % 11 else W3)  # basin water
            elif d <= 0.72:
                px(img, x, y, STONE3)  # inner rim highlight
            elif d <= 0.92:
                px(img, x, y, STONE2 if y < 30 else STONE1)
            elif d <= 1.0:
                px(img, x, y, INK)
    for y in range(8, 30):  # centre column
        for x in range(21, 27):
            px(img, x, y, INK if x in (21, 26) else (STONE3 if x < 24 else STONE2))
    for y in range(4, 10):  # top bowl
        for x in range(16, 32):
            if abs(x - 23.5) <= 7 - (9 - y) * 0.5:
                px(img, x, y, INK if y in (4, 9) else (W3 if y < 6 else STONE2))
    for x, y in ((18, 12), (29, 12), (16, 17), (31, 17), (20, 22), (27, 22)):  # falling water
        for k in range(5):
            px(img, x, y + k, W3 if k % 2 == 0 else "#ffffff")
    return img


TILES = [
    ("grass", lambda: grass()),
    ("grass_tuft", lambda: grass(True)),
    ("flowers", flowers),
    ("path", lambda: path()),
    ("water", water),
    ("tree", lambda: tree(grass())),
    ("bush", bush),
    ("wall", wall),
    ("roof", roof),
    ("door", door),
    ("fence", lambda: fence(grass())),
    ("rock", lambda: rock(grass())),
    ("forest", forest_floor),
    ("forest_path", lambda: path(True)),
    ("forest_tree", lambda: tree(forest_floor(), True)),
    ("crystal", lambda: crystal(grass())),
    ("chest", lambda: chest(grass(), False)),
    ("chest_open", lambda: chest(grass(), True)),
    ("sign", lambda: sign(grass())),
    ("bridge", bridge),
    ("forest_chest", lambda: chest(forest_floor(), False)),
    ("forest_chest_open", lambda: chest(forest_floor(), True)),
]
# Appended after the originals so earlier tile indices (and their pixels) never move.
TOWN_TILES = [
    ("cobble", lambda: cobble()),
    ("cobble_worn", lambda: cobble(True)),
    ("plaza", lambda: plaza()),
    ("lamp", lambda: lamp(cobble())),
    ("barrel", lambda: barrel(cobble())),
    ("crate", lambda: crate(cobble())),
    ("planter", lambda: planter(cobble())),
    ("plaza_worn", lambda: plaza(True)),
    ("plaza_crystal", lambda: crystal(plaza())),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    old = [make() for _, make in TILES]  # draw these first: they share the original seed
    wolf, battle = wolf_frames(), battle_forest()
    every = old + [make() for _, make in TOWN_TILES]
    sheet = Image.new("RGBA", (T * len(every), T))
    for i, img in enumerate(every):
        sheet.paste(img, (T * i, 0))
    sheet.save(OUT / "tiles.png", optimize=True)
    wolf.save(OUT / "wolf.png", optimize=True)
    battle.save(OUT / "battle_forest.png", optimize=True)
    fountain().save(OUT / "fountain.png", optimize=True)
    print(" ".join(name for name, _ in TILES + TOWN_TILES))


if __name__ == "__main__":
    main()
