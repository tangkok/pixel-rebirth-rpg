"""Draw the original bow and mace layers Heroes99 lacks, in its atlas format.

Usage: python3 -I scripts/draw-weapons.py   (run after import-heroes99.py)
Uses the Heroes99 sword atlas only to follow the hand (its gold hilt) per frame, and the
pack's palette so the new pixels sit with the rest of the art. Writes
public/astra/h99/weapon/{bow,mace}.png with the back-layer rows of every animation, then the
front-layer rows, in import-heroes99.py SOURCE_ROWS order.
"""
import math
from pathlib import Path

from PIL import Image

H99 = Path(__file__).resolve().parent.parent / "public/astra/h99"
FW, FH = 100, 40
# Frame counts per animation, in atlas row order: idle, run, slash, thrust, cast, hurt, dying, block.
ANIMS = (6, 8, 6, 4, 5, 4, 5, 5)
OUT, DARK, BROWN, WOOD, GOLD, LIGHT = "#240000", "#582820", "#833f1e", "#a8642a", "#c67b02", "#faca58"
STEEL, STEEL_D, STEEL_L, STRING = "#628d8d", "#31526b", "#a9d0cc", "#e8e0c8"


def hand_poses(anim: int) -> list[tuple[int, int, float]]:
    """(dx, dy, turn) of the sword hand per frame relative to idle frame 0; turn is the blade's
    rotation in radians (clockwise on screen) so a held weapon can swing with it."""
    sword = Image.open(H99 / "weapon/weapon1.png").convert("RGBA")
    front = len(ANIMS)  # front-layer rows start after the back-layer rows

    def pose(f: int, row: int):
        for r in (front + row, row):  # the hand may be drawn on either layer
            px = sword.crop((f * FW, r * FH, f * FW + FW, r * FH + FH)).load()
            opaque = [(x, y) for x in range(FW) for y in range(FH) if px[x, y][3]]
            gold = [(x, y) for x, y in opaque if px[x, y][0] > 150 and px[x, y][2] < 90]
            if not gold:
                continue
            hx, hy = sum(x for x, _ in gold) / len(gold), sum(y for _, y in gold) / len(gold)
            near = [(x, y) for x, y in opaque if (x, y) not in gold and 3 < math.hypot(x - hx, y - hy) < 14]
            ang = math.atan2(sum(y - hy for _, y in near), sum(x - hx for x, _ in near)) if near else None
            return hx, hy, ang
        return None

    x0, y0, a0 = pose(0, 0)
    out, last = [], (0, 0, 0.0)
    for f in range(ANIMS[anim]):
        p = pose(f, anim)
        if p:
            dx, dy = round(p[0] - x0), round(p[1] - y0)
            if anim < 2:  # map poses: the swung hilt drifts forward as the blade tilts; the hand barely does
                dx = max(-2, min(2, dx))
            last = (dx, dy, (p[2] - a0) if p[2] is not None and anim == 2 else 0.0)
        out.append(last)
    return out


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


GRIP = (32, 23)  # where the mace handle starts, at rest


def swung_mace(front: Image.Image, frame: int, dx: int, dy: int, turn: float) -> None:
    if abs(turn) < 0.05:
        return mace(front, frame, dx, dy)
    one = Image.new("RGBA", (FW, FH))
    mace(one, 0, 0, 0)
    one = one.rotate(-math.degrees(turn), resample=Image.NEAREST, center=GRIP)
    front.alpha_composite(one, (frame * FW + dx, dy))


def main() -> None:
    n = len(ANIMS)
    for name in ("bow", "mace"):
        sheet = Image.new("RGBA", (FW * 8, FH * 2 * n))
        for anim in range(n):
            back = Image.new("RGBA", (FW * 8, FH))
            front = Image.new("RGBA", (FW * 8, FH))
            for i, (dx, dy, turn) in enumerate(hand_poses(anim)):
                if name == "bow":
                    # The bow's grip sits ~13px ahead of the sword hilt, so an outstretched arm
                    # already reaches it: follow only a quarter of the reach on duel moves.
                    bow(front, back, i, dx if anim < 2 else round(dx / 4), dy)
                else:
                    swung_mace(front, i, dx, dy, turn)
            sheet.paste(back, (0, FH * anim))
            sheet.paste(front, (0, FH * (n + anim)))
        sheet.save(H99 / f"weapon/{name}.png", optimize=True)


if __name__ == "__main__":
    main()
