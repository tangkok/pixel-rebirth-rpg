"""Compose Echoes of Astra hero sheets from a licensed Heroes99 v1.2 pack.

Usage: python3 -I scripts/compose-heroes.py /path/to/Heroes99_v1.2 public/astra/heroes
Only the flattened class sheets are committed; the raw pack stays out of the repo.
Requires Pillow.
"""
import json
import sys
from pathlib import Path

from PIL import Image

FRAME_W, FRAME_H, COLS = 100, 40, 8
# Heroes99 animation rows, top to bottom (see list_of_animation_full.gif).
ROWS = ["idle1", "idle2", "jump", "run1", "run2", "attack1", "attack2", "attack3",
        "airAttack1", "airAttack2", "cast1", "cast2", "dash", "hurt", "dying", "block", "roll"]
# class: (cloth, cloth colour, weapon or None, weapon colour or None, male hair, female hair, hair colour)
# GDD v1.7 weapons: Knight sword, Ranger bow, Sorcerer staff, Cleric mace, Berserk axe.
# Heroes99 has no bow or mace, so Ranger and Cleric are composed unarmed until that art exists.
LOOKS = {
    "knight": (13, 8, 1, None, "m1", "f1", 4),
    "ranger": (11, 3, None, None, "m5", "f5", 2),
    "sorcerer": (8, 4, 5, 1, "m9", "f9", 6),  # wand stands in for the staff
    "cleric": (10, 1, None, None, "m3", "f3", 9),
    "berserk": (2, 1, 2, None, "m11", "f7", 1),
}


def layer(root: Path, rel: str) -> Image.Image:
    return Image.open(root / rel).convert("RGBA")


def compose(root: Path, cls: str, gender: str) -> Image.Image:
    cloth, cc, weapon, wc, male, female, hc = LOOKS[cls]
    hair = male if gender == "male" else female
    w = f"weapon{weapon}" + (f"_c{wc}" if wc else "")
    wdir = f"weapon/weapon{weapon}/weapon{weapon}"
    order = [  # bottom to top, per layer.gif
        weapon and f"{wdir}_bot/{w}_bot.png",
        "skin/skin_c1.png",
        "face/face_c1.png",
        f"hair/{hair}/{hair}_bot/{hair}_c{hc}_bot.png",
        f"cloth/cloth{cloth}/cloth{cloth}_bot/cloth{cloth}_c{cc}_bot.png",
        f"hair/{hair}/{hair}_top/{hair}_c{hc}_top.png",
        f"cloth/cloth{cloth}/cloth{cloth}_top/cloth{cloth}_c{cc}_top.png",
        weapon and f"{wdir}_top/{w}_top.png",
    ]
    sheet = Image.new("RGBA", (FRAME_W * COLS, FRAME_H * len(ROWS)))
    for rel in filter(None, order):
        sheet.alpha_composite(layer(root, rel))
    return sheet


def frame_counts(sheet: Image.Image) -> dict:
    alpha = sheet.getchannel("A")
    counts = {}
    for r, name in enumerate(ROWS):
        n = sum(1 for c in range(COLS)
                if alpha.crop((c * FRAME_W, r * FRAME_H, (c + 1) * FRAME_W, (r + 1) * FRAME_H)).getbbox())
        counts[name] = n
    return counts


def main() -> None:
    root, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    counts = None
    for cls in LOOKS:
        for gender in ("male", "female"):
            sheet = compose(root, cls, gender)
            sheet.save(out / f"{cls}_{gender}.png", optimize=True)
            counts = counts or frame_counts(sheet)
    (out / "frames.json").write_text(json.dumps(
        {"frameWidth": FRAME_W, "frameHeight": FRAME_H, "rows": ROWS, "frames": counts}, indent=2) + "\n")


if __name__ == "__main__":
    main()
