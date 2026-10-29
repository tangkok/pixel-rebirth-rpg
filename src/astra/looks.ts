// Heroes99 v1.2 layer catalog. public/astra/h99 holds idle-pose atlases built by
// scripts/import-heroes99.py; the row order here must match that script.
import type { ClassId, Gender } from "./data";

export const FRAME_W = 100;
export const FRAME_H = 40;
export const STRIP_W = 800; // one idle row: 8 frame slots, 6 used
export const IDLE_FRAMES = 6;

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
/** "none" plus every Heroes99 weapon variant. Only the wand (weapon5) has colours. */
export const WEAPONS = ["none", "weapon1", "weapon2", "weapon3", "weapon4", "weapon5_c1", "weapon5_c2", "weapon5_c3", "weapon5_c4"];
export const WEAPON_LABEL: Record<string, string> = {
  none: "ไม่ถือ",
  weapon1: "ดาบ",
  weapon2: "ขวาน",
  weapon3: "มีดสั้น",
  weapon4: "หอก",
  weapon5_c1: "คทา (แดง)",
  weapon5_c2: "คทา 2",
  weapon5_c3: "คทา 3",
  weapon5_c4: "คทา 4",
};

export interface Look {
  skin: number;
  face: number;
  hair: string;
  hairColor: number;
  outfit: number;
  outfitColor: number;
  weapon: string;
}

/**
 * Class starting looks (GDD v1.7 weapons: Knight sword, Ranger bow, Sorcerer staff,
 * Cleric mace, Berserk axe). Heroes99 has no bow or mace, so Ranger and Cleric start
 * unarmed; PLACEHOLDER art until those weapons exist.
 */
export const CLASS_LOOK: Record<ClassId, Pick<Look, "outfit" | "outfitColor" | "weapon">> = {
  knight: { outfit: 13, outfitColor: 8, weapon: "weapon1" },
  ranger: { outfit: 11, outfitColor: 3, weapon: "none" },
  sorcerer: { outfit: 8, outfitColor: 4, weapon: "weapon5_c1" },
  cleric: { outfit: 10, outfitColor: 1, weapon: "none" },
  berserk: { outfit: 2, outfitColor: 1, weapon: "weapon2" },
};
export const CLASS_WEAPON_MISSING: Partial<Record<ClassId, string>> = {
  ranger: "ธนู",
  cleric: "กระบอง",
};

export const defaultLook = (gender: Gender, classId: ClassId): Look => ({
  skin: 1,
  face: 1,
  hair: HAIR_STYLES[gender][0],
  hairColor: 1,
  ...CLASS_LOOK[classId],
});

/** One layer: atlas URL and the 40px row inside it. */
export type Layer = [src: string, row: number];

/** Layers bottom to top, following Heroes99's layer.gif order. */
export function layers(l: Look): Layer[] {
  // Paired atlases store each colour as a bot row then a top row.
  const pair = (src: string, color: number, top: boolean): Layer => [src, (color - 1) * 2 + (top ? 1 : 0)];
  const hair = `h99/hair/${l.hair}.png`;
  const cloth = `h99/cloth/cloth${l.outfit}.png`;
  const [w, wc] = l.weapon.split("_c");
  const weapon = l.weapon === "none" ? null : `h99/weapon/${w}.png`;
  const wColor = wc ? Number(wc) : 1;
  return [
    weapon && pair(weapon, wColor, false),
    ["h99/skin.png", l.skin - 1] as Layer,
    ["h99/face.png", l.face - 1] as Layer,
    pair(hair, l.hairColor, false),
    pair(cloth, l.outfitColor, false),
    pair(hair, l.hairColor, true),
    pair(cloth, l.outfitColor, true),
    weapon && pair(weapon, wColor, true),
  ].filter((x): x is Layer => !!x);
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
    !inList(OUTFIT_COLORS, o.outfitColor) ||
    !inList(WEAPONS, o.weapon)
  )
    return null;
  return {
    skin: o.skin,
    face: o.face,
    hair: o.hair,
    hairColor: o.hairColor,
    outfit: o.outfit,
    outfitColor: o.outfitColor,
    weapon: o.weapon,
  };
}
