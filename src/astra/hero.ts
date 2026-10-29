import {
  CLASSES,
  ARMORS,
  GROWTH,
  type ArmorId,
  HONE_PER,
  WEAPON_TIERS,
  TRAIN,
  TRAIN_IDS,
  type TrainId,
  RARITY_ODDS,
  STAT_IDS,
  STAT_LABEL,
  TALENTS,
  talentById,
  type ClassId,
  type Rarity,
  type Stats,
  type TalentDef,
} from "./data";

export const NAME_MAX = 16;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Grapheme clusters when Intl.Segmenter exists, otherwise code points (stricter for Thai marks). */
export const nameLength = (s: string) =>
  segmenter ? [...segmenter.segment(s)].length : Array.from(s).length;

// Control characters and bidi overrides could disguise or break the name.
const UNSAFE = /[\p{Cc}\u202A-\u202E\u2066-\u2069\u2028\u2029]/u;

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

export function checkName(raw: unknown): NameCheck {
  if (typeof raw !== "string") return { ok: false, error: "ชื่อไม่ถูกต้อง" };
  const name = raw.normalize("NFC").trim();
  if (!name) return { ok: false, error: "กรุณาตั้งชื่อ" };
  if (UNSAFE.test(name)) return { ok: false, error: "มีอักขระที่ใช้ไม่ได้" };
  if (nameLength(name) > NAME_MAX)
    return { ok: false, error: `ยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร` };
  return { ok: true, name };
}

/** One independent Talent Awakening draw. `rng` returns [0, 1). */
export function rollTalent(rng: () => number = Math.random): TalentDef {
  const roll = Math.floor(rng() * 1000);
  let acc = 0;
  let rarity: Rarity = "mythic";
  for (const o of RARITY_ODDS) {
    acc += o.per1000;
    if (roll < acc) {
      rarity = o.rarity;
      break;
    }
  }
  const tier = TALENTS.filter((t) => t.rarity === rarity);
  return tier[Math.min(tier.length - 1, Math.floor(rng() * tier.length))];
}

/** COMBAT_SPEC §1: effective = max(1, floor(base * (1 + sum(percentMods)))); base grows per level and takes flat town bonuses. */
export function effectiveStats(classId: ClassId, talentId?: string, level = 1, extra: Partial<Stats> = {}): Stats {
  const base = CLASSES[classId].base;
  const grow = GROWTH[classId];
  const mods = talentId ? (talentById(talentId)?.stats ?? {}) : {};
  const out = {} as Stats;
  for (const s of STAT_IDS) {
    // Integer percent math avoids 18 * 1.08 float drift.
    out[s] = Math.max(1, Math.floor(((base[s] + grow[s] * (level - 1) + (extra[s] ?? 0)) * (100 + (mods[s] ?? 0))) / 100));
  }
  return out;
}

const pct = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}%`;

/** Positive and drawback lines, both always shown before confirming. */
export function describeTalent(t: TalentDef): { plus: string[]; minus: string[] } {
  const plus: string[] = [];
  const minus: string[] = [];
  const entries = Object.entries(t.stats ?? {}) as [keyof Stats, number][];
  if (t.id === "divine_chosen") plus.push("ค่าสถานะหลักทั้งหมด +25%");
  else
    for (const [s, n] of entries)
      (n > 0 ? plus : minus).push(`${STAT_LABEL[s]} ${pct(n)}`);
  if (t.plus) plus.push(t.plus);
  if (t.minus) minus.push(t.minus);
  return { plus, minus };
}

export type Training = Record<TrainId, number>;
export const noTraining = (): Training => Object.fromEntries(TRAIN_IDS.map((t) => [t, 0])) as Training;

/** Flat stat bonus from training points, the honed weapon and worn armour, added to base before the talent percents. */
export function bonusOf(train: Training, hone: number, armor?: ArmorId, weapon = 0): Partial<Stats> {
  const w = hone * HONE_PER + WEAPON_TIERS[weapon].bonus;
  const out: Partial<Stats> = { atk: w, mag: w };
  for (const [s, n] of Object.entries(armor ? ARMORS[armor].stats : {}) as [keyof Stats, number][]) out[s] = (out[s] ?? 0) + n;
  for (const t of TRAIN_IDS)
    for (const [s, per] of Object.entries(TRAIN[t].stats) as [keyof Stats, number][]) out[s] = (out[s] ?? 0) + per * train[t];
  return out;
}
/** Timing window percent bonus from Focus. */
export const focusOf = (train: Training) => train.focus * TRAIN.focus.window;
/** A hero's stats with level, talent, training, hone and armour all applied. */
export const heroMax = (h: { classId: ClassId; talentId: string; level: number; train: Training; hone: number; armor: ArmorId; weapon?: number }) =>
  effectiveStats(h.classId, h.talentId, h.level, bonusOf(h.train, h.hone, h.armor, h.weapon));
