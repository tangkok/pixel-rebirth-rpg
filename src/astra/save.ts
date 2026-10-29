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
import { parseLook, type Look } from "./looks";
import { KAEL_STOCK } from "./trade";
import {
  CHECKPOINTS,
  MAP_IDS,
  MAPS,
  QUEST_REWARD_ID,
  QUEST_STATES,
  START,
  type CheckpointId,
  type Dir,
  type MapId,
  type QuestState,
} from "./world";

export const SAVE_KEY = "echoes-of-astra-save";
export const BACKUP_KEY = "echoes-of-astra-save-backup";
export const SETTINGS_KEY = "echoes-of-astra-settings";
export const SAVE_VERSION = 3;

export interface SaveData {
  version: 3;
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
    map: MapId;
    x: number;
    y: number;
    facing: Dir;
    checkpoint: CheckpointId;
    /** Map-scoped encounter ids that were won; they never respawn or count twice. */
    defeated: string[];
    /** One-time chest and reward ids already granted. */
    claimed: string[];
    quest: { state: QuestState; kills: string[] };
  };
  /** Merchant trades: `seq` counts confirmed trades (the receipt), `kael` is his stock left. */
  trade: { seq: number; kael: Partial<Record<ItemId, number>> };
  savedAt: number;
}

export interface Settings {
  autoTiming: boolean;
  reducedMotion: boolean;
  /** HD-2D light, colour grade and depth-of-field blur on the map. */
  lighting: boolean;
}
export const DEFAULT_SETTINGS: Settings = { autoTiming: false, reducedMotion: false, lighting: true };

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
    progress: {
      ...START,
      facing: "down",
      checkpoint: "oakheart_square",
      defeated: [],
      claimed: [],
      quest: { state: "AVAILABLE", kills: [] },
    },
    trade: freshTrade(),
    savedAt: Date.now(),
  };
}

const freshTrade = (): SaveData["trade"] => ({ seq: 0, kael: { ...KAEL_STOCK } });

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const ID = /^[a-z0-9_:]{1,40}$/;
const idList = (v: unknown, allowed: (id: string) => boolean): string[] | null =>
  Array.isArray(v) && v.length <= 64 && v.every((x) => typeof x === "string" && ID.test(x) && allowed(x)) && new Set(v).size === v.length
    ? [...(v as string[])]
    : null;
const enemyIds = new Set(Object.values(MAPS).flatMap((m) => m.entities.filter((e) => e.kind === "enemy").map((e) => e.id)));
const claimIds = new Set([QUEST_REWARD_ID, ...Object.values(MAPS).flatMap((m) => m.entities.filter((e) => e.kind === "chest").map((e) => e.id))]);

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
  if (!MAP_IDS.includes(p.map as MapId)) return null;
  const map = MAPS[p.map as MapId];
  if (!isInt(p.x, 0, map.rows[0].length - 1) || !isInt(p.y, 0, map.rows.length - 1)) return null;
  if (!["up", "down", "left", "right"].includes(p.facing as string)) return null;
  if (typeof p.checkpoint !== "string" || !(p.checkpoint in CHECKPOINTS)) return null;
  const defeated = idList(p.defeated, (x) => enemyIds.has(x));
  const claimed = idList(p.claimed, (x) => claimIds.has(x));
  if (!defeated || !claimed) return null;
  const q = p.quest;
  if (!isObj(q) || !QUEST_STATES.includes(q.state as QuestState)) return null;
  const kills = idList(q.kills, (x) => defeated.includes(x));
  if (!kills || kills.length > 3) return null;
  // Cross-field invariants keep a hand-edited save from skipping or repeating quest steps.
  const state = q.state as QuestState;
  if ((state === "AVAILABLE" && kills.length) || (state === "ACTIVE" && kills.length >= 3)) return null;
  if ((state === "READY_TO_TURN_IN" || state === "COMPLETED") && kills.length !== 3) return null;
  if ((state === "COMPLETED") !== claimed.includes(QUEST_REWARD_ID)) return null;
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
    progress: {
      map: p.map as MapId,
      x: p.x,
      y: p.y,
      facing: p.facing as Dir,
      checkpoint: p.checkpoint as CheckpointId,
      defeated,
      claimed,
      quest: { state, kills },
    },
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

/** v1 saves (creation-only slice) had no world yet: keep the hero, start at the village. */
function migrateV1(d: Record<string, unknown>): Record<string, unknown> {
  return {
    ...d,
    version: 2,
    gold: 0,
    progress: { ...START, facing: "down", checkpoint: "oakheart_square", defeated: [], claimed: [], quest: { state: "AVAILABLE", kills: [] } },
  };
}

export function parseSettings(raw: string | null): Settings {
  try {
    const d = raw ? JSON.parse(raw) : null;
    if (isObj(d))
      return {
        autoTiming: d.autoTiming === true,
        reducedMotion: d.reducedMotion === true,
        lighting: d.lighting !== false,
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
