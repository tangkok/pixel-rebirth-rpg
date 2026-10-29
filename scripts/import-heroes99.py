"""Copy the licensed Heroes99 v1.2 layers the character creator uses into public/astra/h99.

Usage: python3 -I scripts/import-heroes99.py /path/to/Heroes99_v1.2
Layers keep their original names, flattened per folder (hair/m1_c1_top.png ...).
Requires Pillow (re-saves each PNG with optimize to trim size).
"""
import sys
from pathlib import Path

from PIL import Image

KINDS = ("skin", "face", "hair", "cloth", "weapon")


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(__file__).resolve().parent.parent / "public/astra/h99"
    for kind in KINDS:
        (out / kind).mkdir(parents=True, exist_ok=True)
        for png in sorted((src / kind).rglob("*.png")):
            Image.open(png).save(out / kind / png.name, optimize=True)


if __name__ == "__main__":
    main()
