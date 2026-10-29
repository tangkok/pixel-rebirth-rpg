"""Crops the Dark Ages UI pieces the Astra page uses into src/astra/ui/ (bundled by astra.css).

Usage: python3 -I scripts/import-ui.py <DarkAgesUi_v1.0 folder>

Dark Ages UI by Hypnobius (https://hypnobius.itch.io/) may be used and modified in games but
not redistributed as a pack, so only these cut pieces ship. Charcoal fills are shifted to the
game's navy, and the "on" pieces are a gold recolour.
"""
import sys
from pathlib import Path

from PIL import Image

PIECES = {
    "frame": (0, 0, 96, 96),  # ornate gold frame: dialogs
    "panel": (210, 18, 270, 78),  # quiet celtic frame: panels
    "btn": (0, 104, 64, 123),
    "btn-primary": (128, 104, 192, 123),  # blue, gold rim (crest cut off so it can stretch)
    "slot": (194, 101, 222, 128),  # square buttons (d-pad, arrows)
}
GOLD = (220, 196, 124)


def navy(im: Image.Image) -> Image.Image:
    """Shifts the pack's charcoal greys toward the game's navy (#15202f), keeping their shading."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and max(r, g, b) < 80 and max(r, g, b) - min(r, g, b) < 16:
                px[x, y] = (int(r * 0.8), g, min(255, int(b * 1.55)), a)
    return out


def gold(im: Image.Image) -> Image.Image:
    """Turns the tan/grey frame line of a button gold, leaving the dark fill alone."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and max(r, g, b) > 90:
                k = max(r, g, b) / 159
                px[x, y] = (min(255, int(GOLD[0] * k)), min(255, int(GOLD[1] * k)), min(255, int(GOLD[2] * k)), a)
    return out


def main(src: str) -> None:
    sheet = Image.open(Path(src) / "32x32-Tilesheet.png").convert("RGBA")
    out = Path(__file__).resolve().parent.parent / "src" / "astra" / "ui"
    out.mkdir(parents=True, exist_ok=True)
    for name, box in PIECES.items():
        navy(sheet.crop(box)).save(out / f"{name}.png", optimize=True)
    gold(navy(sheet.crop(PIECES["btn"]))).save(out / "btn-on.png", optimize=True)
    gold(navy(sheet.crop(PIECES["slot"]))).save(out / "slot-on.png", optimize=True)


if __name__ == "__main__":
    main(sys.argv[1])
