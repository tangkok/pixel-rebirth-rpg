"""Build the idle-pose atlases the character creator uses from a licensed Heroes99 v1.2 pack.

Usage: python3 -I scripts/import-heroes99.py /path/to/Heroes99_v1.2
Each atlas stacks, per variant in a fixed order that src/astra/looks.ts mirrors, the idle
strip (source row 0, 6 frames) then the run strip (source row 2, 8 frames), 800x40 each.
Only these strips ship, not the full source sheets.
Requires Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

SOURCE_ROWS = (0, 2)  # idle1, run1


def atlas(paths: list[Path], out: Path) -> None:
    n = len(SOURCE_ROWS)
    sheet = Image.new("RGBA", (800, 40 * n * len(paths)))
    for i, p in enumerate(paths):
        img = Image.open(p).convert("RGBA")
        for j, row in enumerate(SOURCE_ROWS):
            sheet.paste(img.crop((0, 40 * row, 800, 40 * row + 40)), (0, 40 * (i * n + j)))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, optimize=True)


def pairs(folder: Path, stem: str, colors: int) -> list[Path]:
    # rows: c1 bot, c1 top, c2 bot, c2 top, ...
    return [folder / f"{stem}_{side}" / f"{stem}_c{c}_{side}.png" for c in range(1, colors + 1) for side in ("bot", "top")]


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(__file__).resolve().parent.parent / "public/astra/h99"
    atlas([src / f"skin/skin_c{c}.png" for c in range(1, 7)], out / "skin.png")
    atlas([src / f"face/face_c{c}.png" for c in range(1, 8)], out / "face.png")
    for style in [f"m{n}" for n in range(1, 15)] + [f"f{n}" for n in range(1, 10)]:
        atlas(pairs(src / "hair" / style, style, 10), out / f"hair/{style}.png")
    for n in range(1, 18):
        atlas(pairs(src / "cloth" / f"cloth{n}", f"cloth{n}", 8), out / f"cloth/cloth{n}.png")
    # Weapons are fixed by class: sword (1), axe (2), wand-as-staff (5, colour 1).
    # Bow and mace are not in Heroes99; scripts/draw-weapons.py draws them.
    for n in (1, 2):
        w = src / "weapon" / f"weapon{n}"
        atlas([w / f"weapon{n}_bot/weapon{n}_bot.png", w / f"weapon{n}_top/weapon{n}_top.png"], out / f"weapon/weapon{n}.png")
    atlas(pairs(src / "weapon/weapon5", "weapon5", 1), out / "weapon/weapon5.png")


if __name__ == "__main__":
    main()
