import {
  CLASS_IDS,
  DIFFICULTY_IDS,
  type DifficultyId,
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
import { parseLook, type Look } from "./looks";
import { validPath } from "./route";
import { KAEL_STOCK } from "./trade";

export const SAVE_KEY = "echoes-of-astra-save";
export const BACKUP_KEY = "echoes-of-astra-save-backup";
export const SETTINGS_KEY = "echoes-of-astra-settings";
export const SAVE_VERSION = 5;

export interface SaveData {
  version: 5;
  hero: {
    name: string;
    gender: Gender;
    classId: ClassId;
    talentId: string;
    look: Look;
    level: number;
    exp: number;
    hp: number;
    mp: number;
  };
  items: Record<ItemId, number>;
  gold: number;
  progress: {
    /** Route nodes taken this journey, start to current; a node is never applied twice. */
    path: string[];
    /** Bosses beaten (completed journeys). */
    wins: number;
    /** Difficulty of the current journey, chosen before its first step. */
    diff: DifficultyId;
  };
  /** Merchant trades: `seq` counts confirmed trades (the receipt), `kael` is his stock left. */
  trade: { seq: number; kael: Partial<Record<ItemId, number>> };
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
  look: Look,
): SaveData {
  const s = effectiveStats(classId, talentId);
  return {
    version: SAVE_VERSION,
    hero: { name, gender, classId, talentId, look, level: 1, exp: 0, hp: s.maxHp, mp: s.maxMp },
    items: { ...STARTING_ITEMS },
    gold: 0,
    progress: freshProgress(),
    trade: freshTrade(),
    savedAt: Date.now(),
  };
}

const freshProgress = (): SaveData["progress"] => ({ path: [], wins: 0, diff: "normal" });
const freshTrade = (): SaveData["trade"] => ({ seq: 0, kael: { ...KAEL_STOCK } });

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Validates untrusted save JSON. Returns null on anything unexpected. */
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(d)) return null;
  if (d.version === 1) d = migrateV1(d);
  if (isObj(d) && d.version === 2) d = { ...d, version: 3, trade: freshTrade() };
  if (isObj(d) && d.version === 4) d = dropShop(d);
  // v3 walked Oakheart and the forest; the owner replaced both with a route. Keep the hero, bag and Gold.
  if (isObj(d) && d.version === 3) d = { ...d, version: 5, progress: freshProgress() };
  if (!isObj(d) || d.version !== SAVE_VERSION) return null;
  const { hero: h, items, progress: p } = d;
  if (!isObj(h) || !isObj(items) || !isObj(p)) return null;

  const name = checkName(h.name);
  if (!name.ok || name.name !== h.name) return null;
  if (!GENDERS.includes(h.gender as Gender)) return null;
  if (!CLASS_IDS.includes(h.classId as ClassId)) return null;
  if (typeof h.talentId !== "string" || !talentById(h.talentId)) return null;
  const look = parseLook(h.look, h.gender as Gender);
  if (!look) return null;
  if (!isInt(h.level, 1, MAX_LEVEL) || !isInt(h.exp, 0, 1e7)) return null;
  const max = effectiveStats(h.classId as ClassId, h.talentId, h.level);
  if (!isInt(h.hp, 0, max.maxHp) || !isInt(h.mp, 0, max.maxMp)) return null;

  const itemIds = Object.keys(ITEMS) as ItemId[];
  if (Object.keys(items).some((k) => !itemIds.includes(k as ItemId))) return null;
  const bag = {} as Record<ItemId, number>;
  for (const id of itemIds) {
    const n = items[id] ?? 0;
    if (!isInt(n, 0, 99)) return null;
    bag[id] = n;
  }

  if (!isInt(d.gold, 0, 9_999_999)) return null;
  const path = p.path;
  if (!Array.isArray(path) || path.length > 16 || !path.every((x) => typeof x === "string") || !validPath(path as string[])) return null;
  if (!isInt(p.wins, 0, 1e6)) return null;
  const diff = p.diff ?? "normal"; // v5 saves from before difficulties
  if (!DIFFICULTY_IDS.includes(diff as DifficultyId)) return null;
  const t = d.trade;
  if (!isObj(t) || !isInt(t.seq, 0, 1e9) || !isObj(t.kael)) return null;
  const stock = t.kael as Record<string, unknown>;
  if (Object.keys(stock).some((k) => !(k in KAEL_STOCK))) return null;
  const kael: Partial<Record<ItemId, number>> = {};
  for (const [id, max] of Object.entries(KAEL_STOCK) as [ItemId, number][]) {
    if (!isInt(stock[id] ?? 0, 0, max)) return null;
    kael[id] = (stock[id] as number | undefined) ?? 0;
  }
  if (!isInt(d.savedAt, 0, Number.MAX_SAFE_INTEGER)) return null;

  return {
    version: SAVE_VERSION,
    hero: {
      name: name.name,
      gender: h.gender as Gender,
      classId: h.classId as ClassId,
      talentId: h.talentId,
      look,
      level: h.level,
      exp: h.exp,
      hp: h.hp,
      mp: h.mp,
    },
    items: bag,
    gold: d.gold,
    progress: { path: [...(path as string[])], wins: p.wins, diff: diff as DifficultyId },
    trade: { seq: t.seq, kael },
    savedAt: d.savedAt,
  };
}

/**
 * v4 saves had the player shop, since removed by the owner (pure turn-based RPG). Stock left on
 * its shelves goes back to the bag (capped like any stack) so nothing the player owned is lost.
 */
function dropShop(d: Record<string, unknown>): Record<string, unknown> {
  const { shop, ...rest } = d;
  const items = isObj(d.items) ? { ...d.items } : d.items;
  const shelves = isObj(shop) && isObj(shop.shelves) ? Object.values(shop.shelves) : [];
  for (const sh of shelves)
    if (isObj(items) && isObj(sh) && typeof sh.item === "string" && sh.item in items && Number.isInteger(sh.qty))
      items[sh.item] = Math.min(99, (items[sh.item] as number) + (sh.qty as number));
  return { ...rest, items, version: 3 };
}

/** v1 saves (creation-only slice) had no journey yet: keep the hero, start the route. */
function migrateV1(d: Record<string, unknown>): Record<string, unknown> {
  return { ...d, version: 5, gold: 0, progress: freshProgress(), trade: freshTrade() };
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
