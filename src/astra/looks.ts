// Heroes99 v1.2 layer catalog. public/astra/h99 holds idle + run atlases built by
// scripts/import-heroes99.py; the row order here must match that script.
import type { ClassId, Gender } from "./data";

export const FRAME_W = 100;
export const FRAME_H = 40;
export const STRIP_W = 800; // one animation row: 8 frame slots
/** Animations each atlas variant stores, in row order. */
export const ANIMS = { idle: { row: 0, frames: 6 }, run: { row: 1, frames: 8 } } as const;
export type Anim = keyof typeof ANIMS;
export const ANIM_ROWS = Object.keys(ANIMS).length;

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

export const SKINS = range(6);
export const FACES = range(7);
export const HAIR_COLORS = range(10);
export const HAIR_STYLES: Record<Gender, string[]> = {
  male: range(14).map((n) => `m${n}`),
  female: range(9).map((n) => `f${n}`),
};
export const OUTFITS = range(17);
export const OUTFIT_COLORS = range(8);
export interface Look {
  skin: number;
  face: number;
  hair: string;
  hairColor: number;
  outfit: number;
  outfitColor: number;
}

/** Class starting outfits; players can restyle them in the look step. */
export const CLASS_OUTFIT: Record<ClassId, Pick<Look, "outfit" | "outfitColor">> = {
  knight: { outfit: 13, outfitColor: 8 },
  ranger: { outfit: 11, outfitColor: 3 },
  sorcerer: { outfit: 8, outfitColor: 4 },
  cleric: { outfit: 10, outfitColor: 1 },
  berserk: { outfit: 2, outfitColor: 1 },
};

/**
 * Weapon is fixed by class (GDD v1.7): Knight sword, Ranger bow, Sorcerer staff,
 * Cleric mace, Berserk axe. Bow and mace are original layers from scripts/draw-weapons.py;
 * the Heroes99 wand stands in for the staff.
 */
export const CLASS_WEAPON: Record<ClassId, string> = {
  knight: "weapon1",
  ranger: "bow",
  sorcerer: "weapon5_c1",
  cleric: "mace",
  berserk: "weapon2",
};

export const defaultLook = (gender: Gender, classId: ClassId): Look => ({
  skin: 1,
  face: 1,
  hair: HAIR_STYLES[gender][0],
  hairColor: 1,
  ...CLASS_OUTFIT[classId],
});

/** One layer: atlas URL and its variant index (the variant spans ANIM_ROWS strips). */
export type Layer = [src: string, row: number];

/** Layers bottom to top, following Heroes99's layer.gif order. */
export function layers(l: Look, classId: ClassId): Layer[] {
  // Paired atlases store each colour as a bot row then a top row.
  const pair = (src: string, color: number, top: boolean): Layer => [src, (color - 1) * 2 + (top ? 1 : 0)];
  const hair = `h99/hair/${l.hair}.png`;
  const cloth = `h99/cloth/cloth${l.outfit}.png`;
  const [w, wc] = CLASS_WEAPON[classId].split("_c");
  const weapon = `h99/weapon/${w}.png`;
  const wColor = wc ? Number(wc) : 1;
  return [
    pair(weapon, wColor, false),
    ["h99/skin.png", l.skin - 1] as Layer,
    ["h99/face.png", l.face - 1] as Layer,
    pair(hair, l.hairColor, false),
    pair(cloth, l.outfitColor, false),
    pair(hair, l.hairColor, true),
    pair(cloth, l.outfitColor, true),
    pair(weapon, wColor, true),
  ];
}

const inList = <T>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

/** Validates an untrusted look for the given gender; null if any field is unknown. */
export function parseLook(v: unknown, gender: Gender): Look | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (
    !inList(SKINS, o.skin) ||
    !inList(FACES, o.face) ||
    !inList(HAIR_STYLES[gender], o.hair) ||
    !inList(HAIR_COLORS, o.hairColor) ||
    !inList(OUTFITS, o.outfit) ||
    !inList(OUTFIT_COLORS, o.outfitColor)
  )
    return null;
  return {
    skin: o.skin,
    face: o.face,
    hair: o.hair,
    hairColor: o.hairColor,
    outfit: o.outfit,
    outfitColor: o.outfitColor,
  };
}
