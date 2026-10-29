"""Draw the original bow and mace layers Heroes99 lacks, in its atlas format.

Usage: python3 -I scripts/draw-weapons.py   (run after import-heroes99.py)
Uses the Heroes99 sword atlas only to follow the hand (its gold hilt) per frame, and the
pack's palette so the new pixels sit with the rest of the art. Writes
public/astra/h99/weapon/{bow,mace}.png with rows: back idle, back run, front idle, front run.
"""
from pathlib import Path

from PIL import Image

H99 = Path(__file__).resolve().parent.parent / "public/astra/h99"
FW, FH = 100, 40
ANIMS = (6, 8)  # idle, run frame counts; atlas rows per variant follow this order
OUT, DARK, BROWN, WOOD, GOLD, LIGHT = "#240000", "#582820", "#833f1e", "#a8642a", "#c67b02", "#faca58"
STEEL, STEEL_D, STEEL_L, STRING = "#628d8d", "#31526b", "#a9d0cc", "#e8e0c8"


def hand_offsets(anim: int) -> list[tuple[int, int]]:
    """(dx, dy) of the sword hilt in each frame of an animation, relative to idle frame 0."""
    sword = Image.open(H99 / "weapon/weapon1.png").convert("RGBA")
    front = len(ANIMS)  # front-layer rows start after the back-layer rows

    def hilt(row: int, f: int) -> tuple[float, float]:
        px = sword.crop((f * FW, row * FH, f * FW + FW, row * FH + FH)).load()
        gold = [(x, y) for x in range(FW) for y in range(FH) if px[x, y][3] and px[x, y][0] > 150 and px[x, y][2] < 90]
        return sum(x for x, _ in gold) / len(gold), sum(y for _, y in gold) / len(gold)

    x0, y0 = hilt(front, 0)
    # The swung sword's hilt drifts forward as the blade tilts; the hand itself barely does.
    return [(max(-2, min(2, round(x - x0))), round(y - y0)) for x, y in (hilt(front + anim, f) for f in range(ANIMS[anim]))]


def put(img: Image.Image, pts, color: str, dx: int, dy: int, frame: int) -> None:
    for x, y in pts:
        img.putpixel((frame * FW + x + dx, y + dy), Image.new("RGBA", (1, 1), color).getpixel((0, 0)))


def mace(front: Image.Image, frame: int, dx: int, dy: int) -> None:
    # Handle from the grip (where the sword pommel sits) angled down-forward like the sword.
    handle = [(32 + i, 23 + (i * 6) // 10) for i in range(10)]
    put(front, [(x, y - 1) for x, y in handle] + [(x, y + 1) for x, y in handle], OUT, dx, dy, frame)
    put(front, handle, BROWN, dx, dy, frame)
    put(front, [(32, 23), (33, 23)], GOLD, dx, dy, frame)  # pommel cap
    put(front, [(41, 27), (41, 28), (42, 28), (42, 29)], GOLD, dx, dy, frame)  # collar
    put(front, [(42, 27), (41, 29)], LIGHT, dx, dy, frame)
    cx, cy = 45, 30  # flanged head
    ring = [(cx + x, cy + y) for x in range(-3, 4) for y in range(-3, 4) if 6 <= x * x + y * y <= 12]
    body = [(cx + x, cy + y) for x in range(-2, 3) for y in range(-2, 3) if x * x + y * y <= 5]
    flanges = [(cx, cy - 4), (cx, cy + 4), (cx + 4, cy), (cx - 3, cy - 3), (cx + 3, cy - 3), (cx + 3, cy + 3)]
    put(front, ring + [(x, y) for x, y in flanges], OUT, dx, dy, frame)
    put(front, body, STEEL, dx, dy, frame)
    put(front, [(cx + 1, cy + 1), (cx + 2, cy), (cx, cy + 2), (cx + 1, cy + 2)], STEEL_D, dx, dy, frame)
    put(front, [(cx - 1, cy - 1), (cx, cy - 1), (cx - 1, cy)], STEEL_L, dx, dy, frame)
    put(front, [(cx, cy - 3), (cx, cy + 3), (cx + 3, cy)], STEEL_D, dx, dy, frame)


def bow(front: Image.Image, back: Image.Image, frame: int, dx: int, dy: int) -> None:
    # Bow held upright in the front hand, belly curving forward; string on the archer's side.
    top, bottom, sx = 20, 34, 45
    mid = (top + bottom) / 2
    limb = []
    for y in range(top, bottom + 1):
        t = (y - mid) / (mid - top)
        limb.append((sx + round(3.5 * (1 - t * t)) + 1, y))
    put(front, [(x + 1, y) for x, y in limb] + [(x - 1, y) for x, y in limb[2:-2]], OUT, dx, dy, frame)
    put(front, [(sx, top - 1), (sx + 1, top - 1), (sx, bottom + 1), (sx + 1, bottom + 1)], OUT, dx, dy, frame)
    put(front, limb, WOOD, dx, dy, frame)
    put(front, [(x, y) for x, y in limb if abs(y - mid) > 3 and y < mid], GOLD, dx, dy, frame)  # lit upper limb
    put(front, [(sx, y) for y in range(top + 1, bottom)], STRING, dx, dy, frame)
    put(front, [(x, y) for x, y in limb if abs(y - mid) <= 1.5], DARK, dx, dy, frame)  # leather grip
    # Quiver on the back: behind the body, fletchings above the shoulder.
    quiver = [(33 + (i // 3), 14 + i) for i in range(9)]
    put(back, [(x - 1, y) for x, y in quiver] + [(x + 2, y) for x, y in quiver] + [(33 + 3, 23)], OUT, dx, dy, frame)
    put(back, quiver + [(x + 1, y) for x, y in quiver], BROWN, dx, dy, frame)
    put(back, [(x + 1, y) for x, y in quiver[2::3]], GOLD, dx, dy, frame)  # straps
    put(back, [(32, 12), (33, 11), (34, 12), (33, 12), (35, 13)], STRING, dx, dy, frame)  # fletching
    put(back, [(32, 11), (34, 11), (36, 12)], OUT, dx, dy, frame)


def main() -> None:
    n = len(ANIMS)
    for name in ("bow", "mace"):
        sheet = Image.new("RGBA", (FW * 8, FH * 2 * n))
        for anim in range(n):
            back = Image.new("RGBA", (FW * 8, FH))
            front = Image.new("RGBA", (FW * 8, FH))
            for i, (dx, dy) in enumerate(hand_offsets(anim)):
                if name == "bow":
                    bow(front, back, i, dx, dy)
                else:
                    mace(front, i, dx, dy)
            sheet.paste(back, (0, FH * anim))
            sheet.paste(front, (0, FH * (n + anim)))
        sheet.save(H99 / f"weapon/{name}.png", optimize=True)


if __name__ == "__main__":
    main()
