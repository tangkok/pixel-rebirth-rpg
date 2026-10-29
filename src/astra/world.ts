// Exploration rules for Oakheart Village and Whispering Forest (WORLD_EXPLORATION_QUEST,
// NPC_DIALOGUE_SYSTEM). Pure functions over SaveData so quests, chests and victories are
// idempotent and testable; explore.ts only draws and forwards input.
import { ENEMIES, ITEMS, LEVEL_EXP, type EnemyId, type ItemId } from "./data";
import { effectiveStats } from "./hero";
import type { SaveData } from "./save";

export const TILE = 16;

/** Tile order of public/astra/world/tiles.png (scripts/draw-world.py). */
export const TILE_NAMES = [
  "grass", "grass_tuft", "flowers", "path", "water", "tree", "bush", "wall", "roof", "door", "fence",
  "rock", "forest", "forest_path", "forest_tree", "crystal", "chest", "chest_open", "sign", "bridge",
  "forest_chest", "forest_chest_open",
] as const;
export type TileName = (typeof TILE_NAMES)[number];
export const tileIndex = (t: TileName) => TILE_NAMES.indexOf(t);

const LEGEND: Record<string, TileName> = {
  ".": "grass", ",": "grass_tuft", "*": "flowers", "=": "path", "~": "water", T: "tree", b: "bush",
  W: "wall", R: "roof", D: "door", F: "fence", o: "rock", f: "forest", _: "forest_path",
  Y: "forest_tree", B: "bridge",
};
const SOLID = new Set<TileName>(["water", "tree", "bush", "wall", "roof", "door", "fence", "rock", "forest_tree"]);

export type MapId = "oakheart_village" | "whispering_forest";
export const MAP_IDS: MapId[] = ["oakheart_village", "whispering_forest"];
export type Dir = "up" | "down" | "left" | "right";
export const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export type Entity =
  | { kind: "npc"; id: "npc_scout_elaine"; x: number; y: number }
  | { kind: "crystal"; id: CheckpointId; x: number; y: number }
  | { kind: "chest"; id: string; x: number; y: number; item: ItemId; count: number }
  | { kind: "sign"; id: string; x: number; y: number; text: string }
  | { kind: "enemy"; id: string; x: number; y: number; enemy: EnemyId };

export interface WorldMap {
  id: MapId;
  name: string;
  rows: string[];
  entities: Entity[];
  /** Stepping on (x, y) moves the hero to `to` at the arrival anchor. */
  exits: { x: number; y: number; to: MapId; ax: number; ay: number }[];
}

// PLACEHOLDER layouts: the GDD's world poster is mood reference only, not a tile map.
export const MAPS: Record<MapId, WorldMap> = {
  oakheart_village: {
    id: "oakheart_village",
    name: "Oakheart Village",
    rows: [
      "TTTTTTTTTTTTTTTTTTTTTTTT",
      "T..,....RRRR.....RRRR..T",
      "T.*.....RRRR..,..RRRR..T",
      "T.......WDWW.....WWDW.,T",
      "T..b.....=........=....T",
      "T........==========....T",
      "T.,......=...*....=..b.T",
      "T..RRRR..=........=....T",
      "T..RRRR..=........=....T",
      "T..WWDW..=........=....T",
      "T.....====........======",
      "T..*.....=..~~~~..=....T",
      "T........=..~~~~..=..,.T",
      "T.FFFFF..=.......b=....T",
      "T........==========..*.T",
      "TTTTTTTTTTTTTTTTTTTTTTTT",
    ],
    entities: [
      { kind: "npc", id: "npc_scout_elaine", x: 12, y: 7 },
      { kind: "crystal", id: "oakheart_square", x: 14, y: 8 },
      { kind: "chest", id: "oakheart_chest", x: 2, y: 12, item: "potion", count: 1 },
      { kind: "sign", id: "oakheart_sign", x: 21, y: 9, text: "→ Whispering Forest" },
    ],
    exits: [{ x: 23, y: 10, to: "whispering_forest", ax: 1, ay: 8 }],
  },
  whispering_forest: {
    id: "whispering_forest",
    name: "Whispering Forest",
    rows: [
      "YYYYYYYYYYYYYYoooYYYYYYYYYYY",
      "YffffYYfffffff__ffffYYfffffY",
      "YffffffYff~~~f__ffffffffYffY",
      "Yfffffffff~~~f__fffYfffffffY",
      "YfYYffffffBBBf___ffffffYfffY",
      "Yffffffffff~~ffff_fffffffffY",
      "YffYfffffff~~fffff_______ffY",
      "Yfffff_____B_____fffffff_ffY",
      "______ffffffffffffYYffff_ffY",
      "YffffffYffffffYfffffffff_ffY",
      "YfYffffffffffffffffYffff_ffY",
      "Yffff___________________ffYY",
      "YffffffYfffYffffffffffffffYY",
      "YfffYffffffffffffYfffffYfffY",
      "YffffffffYffffffffffffffffYY",
      "YYYYYYYYYYYYYYYYYYYYYYYYYYYY",
    ],
    entities: [
      { kind: "enemy", id: "forest_wolf_1", x: 8, y: 7, enemy: "forest_wolf" },
      { kind: "enemy", id: "forest_wolf_2", x: 24, y: 9, enemy: "forest_wolf" },
      { kind: "enemy", id: "forest_wolf_3", x: 15, y: 11, enemy: "forest_wolf" },
      { kind: "crystal", id: "forest_clearing", x: 3, y: 10 },
      { kind: "chest", id: "forest_chest", x: 25, y: 2, item: "frost_shard", count: 1 },
      { kind: "sign", id: "shrine_sign", x: 16, y: 1, text: "Ancient Shrine · ทางถูกหินปิดไว้ (มาในขั้นถัดไป)" },
    ],
    exits: [{ x: 0, y: 8, to: "oakheart_village", ax: 22, ay: 10 }],
  },
};

export type CheckpointId = "oakheart_square" | "forest_clearing";
/** Where a checkpoint restores the hero: the tile in front of its crystal. */
export const CHECKPOINTS: Record<CheckpointId, { map: MapId; x: number; y: number }> = {
  oakheart_square: { map: "oakheart_village", x: 14, y: 9 },
  forest_clearing: { map: "whispering_forest", x: 3, y: 11 },
};
export const START = CHECKPOINTS.oakheart_square;

export function tileAt(map: WorldMap, x: number, y: number): TileName | null {
  const ch = map.rows[y]?.[x];
  return ch === undefined ? null : (LEGEND[ch] ?? "forest");
}

/** Entities still present: defeated enemies are gone, opened chests stay (as open chests). */
export function liveEntities(map: WorldMap, save: SaveData): Entity[] {
  return map.entities.filter((e) => e.kind !== "enemy" || !save.progress.defeated.includes(e.id));
}

export function entityAt(map: WorldMap, save: SaveData, x: number, y: number) {
  return liveEntities(map, save).find((e) => e.x === x && e.y === y) ?? null;
}

export function walkable(map: WorldMap, save: SaveData, x: number, y: number): boolean {
  const t = tileAt(map, x, y);
  return t !== null && !SOLID.has(t) && !entityAt(map, save, x, y);
}

/** What the hero can interact with: the tile it faces first, then any other neighbour. */
export function interactTarget(map: WorldMap, save: SaveData, x: number, y: number, dir: Dir): Entity | null {
  const order: Dir[] = [dir, ...(["up", "down", "left", "right"] as Dir[]).filter((d) => d !== dir)];
  for (const d of order) {
    const e = entityAt(map, save, x + STEP[d][0], y + STEP[d][1]);
    if (e) return e;
  }
  return null;
}

// ---------- quest: forest_troubles ----------
export const QUEST_ID = "forest_troubles";
export const QUEST_KILLS = 3;
export const QUEST_REWARD = { gold: 100, potion: 2 }; // PLACEHOLDER (NPC_DIALOGUE_SYSTEM §2: balancing TBD)
export const QUEST_REWARD_ID = "forest_troubles:turnin";
export type QuestState = "AVAILABLE" | "ACTIVE" | "READY_TO_TURN_IN" | "COMPLETED";
export const QUEST_STATES: QuestState[] = ["AVAILABLE", "ACTIVE", "READY_TO_TURN_IN", "COMPLETED"];
export const ITEM_CAP = 99;

const clone = (s: SaveData): SaveData => JSON.parse(JSON.stringify(s));
export const questOf = (s: SaveData) => s.progress.quest;

export function acceptQuest(s: SaveData): SaveData {
  if (s.progress.quest.state !== "AVAILABLE") return s;
  const n = clone(s);
  n.progress.quest = { state: "ACTIVE", kills: [] };
  return n;
}

export const levelFor = (exp: number) => LEVEL_EXP.filter((need) => exp >= need).length;

/** Applies one victory. Replaying an id (reload, double callback) changes nothing. */
/** EXP from one victory; Quick Learner adds 15% (floored). */
export const expFor = (enemy: keyof typeof ENEMIES, talentId: string) =>
  Math.floor((ENEMIES[enemy].exp * (talentId === "quick_learner" ? 115 : 100)) / 100);

export function recordVictory(s: SaveData, encounterId: string): SaveData {
  const e = MAPS[s.progress.map].entities.find((x) => x.kind === "enemy" && x.id === encounterId);
  if (!e || e.kind !== "enemy" || s.progress.defeated.includes(encounterId)) return s;
  const n = clone(s);
  n.progress.defeated.push(encounterId);
  n.hero.exp = Math.min(n.hero.exp + expFor(e.enemy, n.hero.talentId), 1e7);
  n.hero.level = levelFor(n.hero.exp);
  const q = n.progress.quest;
  if (q.state === "ACTIVE" && e.enemy === "forest_wolf" && !q.kills.includes(encounterId)) {
    q.kills.push(encounterId);
    if (q.kills.length >= QUEST_KILLS) q.state = "READY_TO_TURN_IN";
  }
  return n;
}

/** Grants the turn-in reward once. Returns null (nothing consumed) if the bag cannot hold it. */
export function claimQuestReward(s: SaveData): SaveData | null {
  if (s.progress.quest.state !== "READY_TO_TURN_IN" || s.progress.claimed.includes(QUEST_REWARD_ID)) return s;
  if (s.items.potion + QUEST_REWARD.potion > ITEM_CAP) return null;
  const n = clone(s);
  n.gold = Math.min(n.gold + QUEST_REWARD.gold, 9_999_999);
  n.items.potion += QUEST_REWARD.potion;
  n.progress.claimed.push(QUEST_REWARD_ID);
  n.progress.quest.state = "COMPLETED";
  return n;
}

/** Opens a chest once. Returns null (chest stays closed) if the bag cannot hold the item. */
export function openChest(s: SaveData, chestId: string): SaveData | null {
  const c = MAPS[s.progress.map].entities.find((x) => x.kind === "chest" && x.id === chestId);
  if (!c || c.kind !== "chest" || s.progress.claimed.includes(chestId)) return s;
  if (s.items[c.item] + c.count > ITEM_CAP) return null;
  const n = clone(s);
  n.items[c.item] += c.count;
  n.progress.claimed.push(chestId);
  return n;
}

/** Save crystals set the respawn point and fully restore HP/MP (PLACEHOLDER: GDD has no rest rule yet). */
export function setCheckpoint(s: SaveData, id: CheckpointId): SaveData {
  const n = clone(s);
  const max = effectiveStats(n.hero.classId, n.hero.talentId);
  n.progress.checkpoint = id;
  n.hero.hp = max.maxHp;
  n.hero.mp = max.maxMp;
  return n;
}

export const itemName = (id: ItemId) => ITEMS[id].name;

/** Elaine's dialogue node is chosen from authoritative quest state on every open. */
export function elaineNode(s: SaveData): { text: string; choices: { id: "accept" | "later" | "claim" | "ok"; label: string }[] } {
  const q = s.progress.quest;
  switch (q.state) {
    case "AVAILABLE":
      return {
        text: "เส้นทางผ่านป่ามีหมาป่าดุร้าย ช่วยกำจัด Forest Wolf สามตัวได้ไหม?",
        choices: [
          { id: "accept", label: "รับภารกิจ" },
          { id: "later", label: "ไว้ก่อน" },
        ],
      };
    case "ACTIVE":
      return { text: `ตอนนี้จัดการได้ ${q.kills.length}/${QUEST_KILLS} ตัวแล้ว ระวังตัวด้วยนะ`, choices: [{ id: "ok", label: "ตกลง" }] };
    case "READY_TO_TURN_IN":
      return {
        text: "เจ้าช่วยให้ทางเดินปลอดภัยขึ้นมาก มารับรางวัลได้เลย",
        choices: [
          { id: "claim", label: `รับรางวัล (${QUEST_REWARD.gold} Gold + Potion ×${QUEST_REWARD.potion})` },
          { id: "later", label: "ไว้ก่อน" },
        ],
      };
    case "COMPLETED":
      return { text: "ขอบคุณอีกครั้ง เส้นทางไปวิหารเริ่มปลอดภัยแล้ว", choices: [{ id: "ok", label: "ปิด" }] };
  }
}

export function questLine(s: SaveData): string {
  const q = s.progress.quest;
  if (q.state === "AVAILABLE") return "คุยกับ Elaine ที่ลานหมู่บ้าน";
  if (q.state === "ACTIVE") return `กำจัด Forest Wolf ${q.kills.length}/${QUEST_KILLS}`;
  if (q.state === "READY_TO_TURN_IN") return "กลับไปรายงาน Elaine";
  return "ภารกิจ Forest Troubles สำเร็จ";
}
