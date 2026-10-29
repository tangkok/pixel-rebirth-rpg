"""Draw original front (walking down) and back (walking up) map frames for the hero layers.

Usage: python3 -I scripts/draw-front-back.py   (run after import-heroes99.py)
Heroes99 only has side views. The shapes here are original templates; each variant takes its
colours from the matching shipped Heroes99 atlas (public/astra/h99) so skin, hair and outfit
colours match the side sprite. Writes public/astra/fb/{skin,face}.png, cloth/clothN.png and
hair/<style>.png: per variant one row walking down then one walking up, 4 frames of 40x40.
Requires Pillow.
"""
import colorsys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public/astra"
H99, OUT = ROOT / "h99", ROOT / "fb"
FW = FH = 40
FRAMES = 4
ROWS = 8  # animation rows per Heroes99 atlas variant
OX, OY = 12, 8  # template (16 wide) origin inside the frame: centre x 20, feet on y 33

# Codes: skin o s S L, face e E w, cloth x a A B c C, hair k h H J. "." is empty.
HEAD_FRONT = [
    "................",
    "................",
    "....oooooooo....",
    "...oSSSSSSSSo...",
    "..oSSSSSSSSSSo..",
    "..oSSSSSSSSSSo..",
    "..oSeeSSSSeeSo..",
    "..oSEwSSSSwESo..",
    "..osSSSSSSSSso..",
    "...osSSSSSSso...",
    "....osssssso....",
    ".....oSSSSo.....",
]
HEAD_BACK = [r.replace("e", "S").replace("E", "S").replace("w", "S") for r in HEAD_FRONT]
TORSO_FRONT = [
    "....xxCCCCxx....",
    "..xxABACCABAxx..",
    ".xAAxABAABAxAAx.",
    ".xAaxAAAAAAxaAx.",
    ".xAaxAAAAAAxaAx.",
    ".xaaxccccccxaax.",
    ".oSSxAAAAAAxSSo.",
    ".oss.xAaaAx.sso.",
]
TORSO_BACK = [
    "....xxAAAAxx....",
    "..xxAAAAAAAAxx..",
    ".xAAxAABBAAxAAx.",
    ".xAaxAAAAAAxaAx.",
    ".xAaxAaAAaAxaAx.",
    ".xaaxccccccxaax.",
    ".oSSxAAAAAAxSSo.",
    ".oss.xAaaAx.sso.",
]
# Hair families. Front templates leave the face open; back templates cover the head.
HAIR = {
    "short": (
        [".....kkkkkk.....", "...kkHHHHHHkk...", "..kHHJJHHHHHHk..", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".khHHhHHHhHHhHk.", ".kh..........hk.", ".kh..........hk.", "..k..........k.."],
        [".....kkkkkk.....", "...kkHHHHHHkk...", "..kHHJJHHHHHHk..", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".kHHHHHHHHHHHHk.", ".khHHHHHHHHHHhk.", ".khHHHhHHhHHHhk.", "..khHhHHHHhHhk..", "...khhHhhHhhk...",
         "....kkhkkhkk...."],
    ),
    "spiky": (
        ["...k..kk..k.....", "..kHkkHHkkHk.k..", "..kHHJJHHHHHkHk.", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".khHhHHhHHhHhHk.", ".kh.h..h..h..hk.", ".kh..........hk.", "..k..........k.."],
        ["...k..kk..k.....", "..kHkkHHkkHk.k..", "..kHHJJHHHHHkHk.", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".kHHHHHHHHHHHHk.", ".khHHHHHHHHHHhk.", "kHhHHhHHhHHhHhHk", ".khHkhHkkHhkHhk.", "..kk.kk..kk.kk..",
         "................"],
    ),
    "long": (
        [".....kkkkkk.....", "...kkHHHHHHkk...", "..kHHJJHHHHHHk..", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".khHHhHHHhHHhHk.", ".kh..........hk.", ".kH..........Hk.", ".kH..........Hk.", ".kh..........hk.",
         ".kh..........hk.", ".kh..........hk.", ".kk..........kk.", ".k............k."],
        [".....kkkkkk.....", "...kkHHHHHHkk...", "..kHHJJHHHHHHk..", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".kHHHHHHHHHHHHk.", ".kHHHHHHHHHHHHk.", ".khHHHHHHHHHHhk.", ".khHHHHHHHHHHhk.", ".khHHHhHHhHHHhk.",
         ".khHHHhHHhHHHhk.", "..khHhHHHHhHhk..", "..khhhHhhHhhhk..", "...kkkhkkhkkk..."],
    ),
    "pony": (
        [".....kkkkkk.....", "...kkHHHHHHkk...", "..kHHJJHHHHHHk..", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".khHHhHHHhHHhHk.", ".kh..........hk.", ".kh..........hk.", "..k..........k.."],
        [".....kkkkkk.....", "...kkHHHHHHkk...", "..kHHJJHHHHHHk..", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".kHHHHHHHHHHHHk.", ".khHHHHHHHHHHhk.", "..khHHhkkhHHhk..", "...kkkHJHkkk....", "......kHHk......",
         "......kHhk......", "......khHk......", "......khhk......", ".......kk......."],
    ),
    "bob": (
        [".....kkkkkk.....", "...kkHHHHHHkk...", "..kHHJJHHHHHHk..", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".khHHhHHHhHHhHk.", ".kh..........hk.", ".kH..........Hk.", ".kh..........hk.", ".kh..........hk.",
         ".kk..........kk."],
        [".....kkkkkk.....", "...kkHHHHHHkk...", "..kHHJJHHHHHHk..", ".kHHJHHHHHHHHHk.", ".kHHHHHHHHHHHHk.",
         ".kHHHHHHHHHHHHk.", ".kHHHHHHHHHHHHk.", ".khHHHHHHHHHHhk.", ".khHHHhHHhHHHhk.", ".khHHhHHHHhHHhk.",
         ".kkhhkhhhhkhhkk.", "..kkkkkkkkkkkk.."],
    ),
}
STYLE = {
    **{f"m{n}": "short" for n in (2, 3, 4, 7, 8, 10, 11)},
    **{f"m{n}": "spiky" for n in (1, 5, 6, 12, 13, 14)},
    "m9": "pony",
    **{f"f{n}": "bob" for n in (1, 4, 7)},
    **{f"f{n}": "long" for n in (2, 3, 6)},
    **{f"f{n}": "pony" for n in (5, 8, 9)},
}


def legs(back: bool, step: int) -> list[str]:
    """Six leg rows. step 0 stands; 1 lifts the right leg, 2 lifts the left (screen sides)."""
    rows = []
    for y in range(6):
        row = list("................")
        for side, x0 in ((0, 4), (1, 8)):
            lift = (step == 1 and side == 1) or (step == 2 and side == 0)
            yy = y + (1 if lift else 0)  # a lifted leg is one row shorter
            if yy > 5:
                continue
            pal = "xAax" if side == 0 else "xaAx"
            if yy >= 3:
                pal = "xccx"
            if yy == 5:
                pal = "xxxx"
            row[x0:x0 + 4] = pal
        rows.append("".join(row))
    return rows


def body(back: bool, step: int, bob: int) -> list[str]:
    upper = (HEAD_BACK if back else HEAD_FRONT) + (TORSO_BACK if back else TORSO_FRONT)
    grid = upper + legs(back, step)
    # Bob: the upper body rises a row on passing frames (legs keep the ground).
    if bob:
        grid = upper[1:] + [upper[-1]] + legs(back, step)
    return grid


# Frame sequence: step (right lifted, body up a row), stand, step (left lifted), stand. Idle uses frame 1.
SEQ = [(1, 1), (0, 0), (2, 1), (0, 0)]


def lum(c):
    r, g, b = c[:3]
    return 0.299 * r + 0.587 * g + 0.114 * b


def colours(paths_rows: list[tuple[Path, int]]) -> dict[tuple, int]:
    count: dict[tuple, int] = {}
    for p, variant in paths_rows:
        im = Image.open(p).convert("RGBA")
        y = variant * ROWS * FH  # idle strip of this variant
        crop = im.crop((0, y, im.width, y + FH * 2))  # idle + run rows
        for c in crop.get_flattened_data():
            if c[3] > 200:
                count[c[:3]] = count.get(c[:3], 0) + 1
    return count


def trio(cs: list[tuple], count: dict[tuple, int]) -> tuple:
    """(shadow, base, light): base is the most used colour, the others the most used darker/lighter."""
    if not cs:
        return ((128, 128, 128),) * 3
    base = max(cs, key=lambda c: count[c])
    dark = [c for c in cs if lum(c) < lum(base) - 8]
    light = [c for c in cs if lum(c) > lum(base) + 8]
    pick = lambda xs, fb: max(xs, key=lambda c: count[c]) if xs else fb
    return pick(dark, base), base, pick(light, base)


def quant(cs: list[tuple], count: dict[tuple, int], qs=(0.25, 0.6, 0.9)) -> tuple:
    """Colours at count-weighted luminance quantiles (shaded art is mostly mid and dark pixels)."""
    if not cs:
        return ((128, 128, 128),) * len(qs)
    cs = sorted(cs, key=lum)
    total = sum(count[c] for c in cs)
    out = []
    for q in qs:
        acc = 0
        for c in cs:
            acc += count[c]
            if acc >= q * total:
                out.append(c)
                break
    return tuple(out)


def ramp(cs: list[tuple], n: int) -> list[tuple]:
    cs = sorted(cs, key=lum)
    if not cs:
        return [(128, 128, 128)] * n
    return [cs[min(len(cs) - 1, round(i * (len(cs) - 1) / max(1, n - 1)))] for i in range(n)]


def hue_group(count: dict[tuple, int], seed: tuple, exclude=()) -> list[tuple]:
    h0, _, s0 = colorsys.rgb_to_hls(*[v / 255 for v in seed])
    out = []
    for c in count:
        if c in exclude:
            continue
        h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in c])
        grey = s < 0.15 or l < 0.12 or l > 0.92
        if (grey and s0 < 0.15) or (not grey and s0 >= 0.15 and min(abs(h - h0), 1 - abs(h - h0)) < 0.07):
            out.append(c)
    return out


def skin_pal(v: int) -> dict:
    count = colours([(H99 / "skin.png", v)])
    cs = sorted(count, key=lum)
    o = cs[0]
    body = [c for c in cs if count[c] > 20 and c != o]
    s, S, L = trio(body, count)
    return {"o": o, "s": s, "S": S, "L": L}


def face_pal(v: int) -> dict:
    count = colours([(H99 / "face.png", v)])
    cs = sorted(count, key=lum)
    vivid = max(count, key=lambda c: colorsys.rgb_to_hls(*[x / 255 for x in c])[2] * (1 if lum(c) > 40 else 0))
    return {"e": cs[0], "E": vivid, "w": cs[-1]}


def cloth_pal(n: int, v: int) -> dict:
    p = H99 / f"cloth/cloth{n}.png"
    count = colours([(p, v * 2), (p, v * 2 + 1)])
    dark = min(count, key=lum)
    main = max((c for c in count if c != dark), key=lambda c: count[c])
    g1 = hue_group(count, main, (dark,))
    rest = {c: k for c, k in count.items() if c not in g1 and c != dark}
    sec = max(rest, key=lambda c: rest[c]) if rest else main
    g2 = hue_group(rest, sec) or [sec]
    a, A, B = quant(g1, count)
    c, C = ramp(g2, 2)
    return {"x": dark, "a": a, "A": A, "B": B, "c": c, "C": C}


def hair_pal(style: str, v: int) -> dict:
    p = H99 / f"hair/{style}.png"
    count = colours([(p, v * 2), (p, v * 2 + 1)])
    cs = sorted(count, key=lum)
    k = cs[0]
    main = [c for c in cs[1:] if count[c] > 4] or cs
    h, H, J = quant(main, count)
    return {"k": k, "h": h, "H": H, "J": J}


def paint(sheet: Image.Image, grid: list[str], pal: dict, fx: int, fy: int, dy: int = 0) -> None:
    for y, row in enumerate(grid):
        assert len(row) == 16, row
        for x, ch in enumerate(row):
            if ch in pal:
                sheet.putpixel((fx + OX + x, fy + OY + y + dy), (*pal[ch], 255))


def write(path: Path, variants: list[dict], draw) -> None:
    sheet = Image.new("RGBA", (FW * FRAMES, FH * 2 * len(variants)))
    for i, pal in enumerate(variants):
        for back in (0, 1):
            for f, (step, bob) in enumerate(SEQ):
                draw(sheet, pal, back, step, bob, f * FW, (i * 2 + back) * FH)
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, optimize=True)


def main() -> None:
    def draw_body(codes):
        def d(sheet, pal, back, step, bob, fx, fy):
            g = body(bool(back), step, bob)
            paint(sheet, [("".join(ch if ch in codes else "." for ch in r)) for r in g], pal, fx, fy)
        return d

    write(OUT / "skin.png", [skin_pal(v) for v in range(6)], draw_body("osSL"))
    write(OUT / "face.png", [face_pal(v) for v in range(7)], lambda s, p, back, st, bob, fx, fy: None if back else
          paint(s, [("".join(ch if ch in "eEw" else "." for ch in r)) for r in body(False, st, bob)], p, fx, fy))
    for n in range(1, 18):
        write(OUT / f"cloth/cloth{n}.png", [cloth_pal(n, v) for v in range(8)], draw_body("xaABcC"))
    for style, fam in STYLE.items():
        front, back = HAIR[fam]
        write(OUT / f"hair/{style}.png", [hair_pal(style, v) for v in range(10)],
              lambda s, p, b, st, bob, fx, fy, f=front, bk=back: paint(s, bk if b else f, p, fx, fy, -bob))


if __name__ == "__main__":
    main()
