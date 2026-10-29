import {
  CLASS_IDS,
  GENDERS,
  ITEMS,
  MAX_LEVEL,
  STARTING_ITEMS,
  talentById,
  type ClassId,
  type Gender,
  type ItemId,
} from "./data";
import { checkName, effectiveStats } from "./hero";

export const SAVE_KEY = "echoes-of-astra-save";
export const BACKUP_KEY = "echoes-of-astra-save-backup";
export const SETTINGS_KEY = "echoes-of-astra-settings";
export const SAVE_VERSION = 1;

export interface SaveData {
  version: 1;
  hero: {
    name: string;
    gender: Gender;
    classId: ClassId;
    talentId: string;
    level: number;
    exp: number;
    hp: number;
    mp: number;
  };
  items: Record<ItemId, number>;
  progress: {
    map: "oakheart_village";
    x: number;
    y: number;
    checkpoint: string;
    defeated: string[];
  };
  savedAt: number;
}

export interface Settings {
  autoTiming: boolean;
  reducedMotion: boolean;
}
export const DEFAULT_SETTINGS: Settings = { autoTiming: false, reducedMotion: false };

export function newSave(
  name: string,
  gender: Gender,
  classId: ClassId,
  talentId: string,
): SaveData {
  const s = effectiveStats(classId, talentId);
  return {
    version: SAVE_VERSION,
    hero: { name, gender, classId, talentId, level: 1, exp: 0, hp: s.maxHp, mp: s.maxMp },
    items: { ...STARTING_ITEMS },
    progress: { map: "oakheart_village", x: 4, y: 10, checkpoint: "oakheart_square", defeated: [] }, // PLACEHOLDER spawn
    savedAt: Date.now(),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const ID = /^[a-z0-9_]{1,32}$/;

/** Validates untrusted save JSON. Returns null on anything unexpected. */
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d) || d.version !== SAVE_VERSION) return null;
  const { hero: h, items, progress: p } = d;
  if (!isObj(h) || !isObj(items) || !isObj(p)) return null;

  const name = checkName(h.name);
  if (!name.ok || name.name !== h.name) return null;
  if (!GENDERS.includes(h.gender as Gender)) return null;
  if (!CLASS_IDS.includes(h.classId as ClassId)) return null;
  if (typeof h.talentId !== "string" || !talentById(h.talentId)) return null;
  if (!isInt(h.level, 1, MAX_LEVEL) || !isInt(h.exp, 0, 1e7)) return null;
  const max = effectiveStats(h.classId as ClassId, h.talentId);
  // Level-up growth is not designed yet, so caps use the level 1 maximum.
  if (!isInt(h.hp, 0, max.maxHp) || !isInt(h.mp, 0, max.maxMp)) return null;

  const itemIds = Object.keys(ITEMS) as ItemId[];
  if (Object.keys(items).some((k) => !itemIds.includes(k as ItemId))) return null;
  const bag = {} as Record<ItemId, number>;
  for (const id of itemIds) {
    const n = items[id] ?? 0;
    if (!isInt(n, 0, 99)) return null;
    bag[id] = n;
  }

  if (p.map !== "oakheart_village" || !isInt(p.x, 0, 999) || !isInt(p.y, 0, 999)) return null;
  if (typeof p.checkpoint !== "string" || !ID.test(p.checkpoint)) return null;
  if (
    !Array.isArray(p.defeated) ||
    p.defeated.length > 64 ||
    p.defeated.some((x) => typeof x !== "string" || !ID.test(x))
  )
    return null;
  if (!isInt(d.savedAt, 0, Number.MAX_SAFE_INTEGER)) return null;

  return {
    version: SAVE_VERSION,
    hero: {
      name: name.name,
      gender: h.gender as Gender,
      classId: h.classId as ClassId,
      talentId: h.talentId,
      level: h.level,
      exp: h.exp,
      hp: h.hp,
      mp: h.mp,
    },
    items: bag,
    progress: {
      map: "oakheart_village",
      x: p.x,
      y: p.y,
      checkpoint: p.checkpoint,
      defeated: [...p.defeated] as string[],
    },
    savedAt: d.savedAt,
  };
}

export function parseSettings(raw: string | null): Settings {
  try {
    const d = raw ? JSON.parse(raw) : null;
    if (isObj(d))
      return {
        autoTiming: d.autoTiming === true,
        reducedMotion: d.reducedMotion === true,
      };
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_SETTINGS };
}

type Store = Pick<Storage, "getItem" | "setItem">;

/** Loads the primary save, falling back to the backup copy if the primary is damaged. */
export function loadSave(store: Store): SaveData | null {
  return parseSave(store.getItem(SAVE_KEY)) ?? parseSave(store.getItem(BACKUP_KEY));
}

/**
 * Writes a save and verifies it reads back. The previous valid save is kept as a backup
 * first, so a failed or malformed write never destroys the last good state.
 */
export function writeSave(store: Store, data: SaveData): boolean {
  const json = JSON.stringify(data);
  if (!parseSave(json)) return false;
  try {
    const prev = store.getItem(SAVE_KEY);
    if (parseSave(prev)) store.setItem(BACKUP_KEY, prev!);
    store.setItem(SAVE_KEY, json);
    return store.getItem(SAVE_KEY) === json;
  } catch {
    return false;
  }
}
