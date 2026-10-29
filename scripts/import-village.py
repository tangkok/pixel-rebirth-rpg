"""Build the town building atlas from a licensed Pixel-Deck "Tiny Top-Down Village" pack.

Usage: python3 -I scripts/import-village.py "/path/to/Tiny Top-Down Village"
Writes public/astra/world/buildings.png: the 80x80 buildings in BUILDINGS order (mirrored
by BUILDING_ART in src/astra/world.ts), 10 per row. Only the buildings the town uses ship,
never the complete pack (its license forbids redistributing it unchanged).
Pixel Art Assets by Pixel-Deck.com. Requires Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

BUILDINGS = [
    "Town Hall", "Church", "Library", "Clock Tower Building", "Mansion", "Mayors Residence",
    "Tavern", "General Store", "Blacksmith House", "Bakery", "Adventurers Guild", "Merchant House",
    "Doctors House", "Noble House", "Town House", "Florists House", "Post House", "Tailors House",
    "Mill House", "Herbalist House",
]
OUT = Path(__file__).resolve().parent.parent / "public/astra/world/buildings.png"
S, COLS = 80, 10


def main(src: Path) -> None:
    rows = (len(BUILDINGS) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (S * COLS, S * rows))
    for i, name in enumerate(BUILDINGS):
        img = Image.open(src / f"{name}.png").convert("RGBA")
        if img.size != (S, S):
            sys.exit(f"{name}: expected {S}x{S}, got {img.size}")
        sheet.paste(img, (S * (i % COLS), S * (i // COLS)))
        print(f"{i:2} {name:22} bbox={img.getbbox()}")
    sheet.save(OUT, optimize=True)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
