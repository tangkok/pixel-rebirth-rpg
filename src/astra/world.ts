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
  "forest_chest", "forest_chest_open", "cobble", "cobble_worn", "plaza", "lamp", "barrel", "crate", "planter",
  "plaza_worn", "plaza_crystal", "floor", "shop_wall", "shop_door", "shelf_empty", "shelf_low", "shelf_full", "counter",
] as const;
export type TileName = (typeof TILE_NAMES)[number];
export const tileIndex = (t: TileName) => TILE_NAMES.indexOf(t);

const LEGEND: Record<string, TileName> = {
  ".": "grass", ",": "grass_tuft", "*": "flowers", "=": "path", "~": "water", T: "tree", b: "bush",
  W: "wall", R: "roof", D: "door", F: "fence", o: "rock", f: "forest", _: "forest_path",
  Y: "forest_tree", B: "bridge", c: "cobble", k: "cobble_worn", p: "plaza", L: "lamp", r: "barrel", x: "crate",
  P: "planter", q: "plaza_worn", w: "shop_wall", ":": "floor", d: "shop_door",
};
const SOLID = new Set<TileName>([
  "water", "tree", "bush", "wall", "roof", "door", "fence", "rock", "forest_tree", "lamp", "barrel", "crate", "planter", "shop_wall",
]);

/**
 * Big sprites drawn over the tiles: Pixel-Deck buildings (80x80, public/astra/world/buildings.png
 * in this order, scripts/import-village.py) and the fountain (48x48). `foot` is the solid part in
 * tiles relative to the sprite's top-left [x0, x1, y0, y1]; rows above it are roof the hero walks behind.
 */
export const PROP_ART = {
  town_hall: { cell: 0, foot: [0, 4, 2, 4] },
  church: { cell: 1, foot: [0, 4, 2, 4] },
  library: { cell: 2, foot: [0, 4, 2, 4] },
  clock_tower: { cell: 3, foot: [1, 4, 2, 4] },
  mansion: { cell: 4, foot: [0, 4, 2, 4] },
  mayors: { cell: 5, foot: [0, 4, 2, 4] },
  tavern: { cell: 6, foot: [0, 4, 2, 4] },
  general_store: { cell: 7, foot: [0, 4, 2, 4] },
  blacksmith: { cell: 8, foot: [0, 4, 2, 4] },
  bakery: { cell: 9, foot: [0, 4, 2, 4] },
  guild: { cell: 10, foot: [0, 4, 2, 4] },
  merchant: { cell: 11, foot: [0, 4, 2, 4] },
  doctors: { cell: 12, foot: [0, 4, 2, 4] },
  noble: { cell: 13, foot: [0, 4, 2, 3] },
  town_house: { cell: 14, foot: [1, 3, 2, 4] },
  florist: { cell: 15, foot: [0, 4, 2, 4] },
  post: { cell: 16, foot: [0, 4, 2, 4] },
  tailor: { cell: 17, foot: [0, 4, 2, 4] },
  mill: { cell: 18, foot: [0, 4, 2, 4] },
  herbalist: { cell: 19, foot: [0, 4, 2, 4] },
  fountain: { cell: -1, foot: [0, 2, 1, 2] },
} as const;
export type PropArt = keyof typeof PROP_ART;
export const BUILDING_PX = 80;

export type MapId = "oakheart_village" | "whispering_forest" | "oakheart_player_shop_interior";
export const MAP_IDS: MapId[] = ["oakheart_village", "whispering_forest", "oakheart_player_shop_interior"];
export const SHOP_MAP: MapId = "oakheart_player_shop_interior";
export const SHELF_IDS = ["shelf_a", "shelf_b", "shelf_c", "shelf_d"] as const;
export type ShelfId = (typeof SHELF_IDS)[number];
export type Dir = "up" | "down" | "left" | "right";
export const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export type Entity =
  | { kind: "npc"; id: "npc_scout_elaine"; x: number; y: number }
  /** Walks `route` (corner tiles of a closed loop, joined by straight lines); x, y is where it starts. */
  | { kind: "merchant"; id: "npc_adventurer_kael"; x: number; y: number; route: [number, number][] }
  | { kind: "crystal"; id: CheckpointId; x: number; y: number }
  | { kind: "chest"; id: string; x: number; y: number; item: ItemId; count: number }
  | { kind: "sign"; id: string; x: number; y: number; text: string }
  | { kind: "enemy"; id: string; x: number; y: number; enemy: EnemyId }
  /** A building door: Interact walks through it to `to` at the arrival anchor. */
  | { kind: "door"; id: string; x: number; y: number; to: MapId; ax: number; ay: number }
  | { kind: "shelf"; id: ShelfId; x: number; y: number }
  | { kind: "counter"; id: "shop_counter"; x: number; y: number };

export interface WorldMap {
  id: MapId;
  name: string;
  rows: string[];
  entities: Entity[];
  /** Stepping on (x, y) moves the hero to `to` at the arrival anchor. */
  exits: { x: number; y: number; to: MapId; ax: number; ay: number }[];
  props?: { art: PropArt; x: number; y: number }[];
}

// PLACEHOLDER layouts: the GDD's world poster is mood reference only, not a tile map.
export const MAPS: Record<MapId, WorldMap> = {
  oakheart_village: {
    id: "oakheart_village",
    name: "Oakheart Village",
    rows: [
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "T........................,..,..*...,.,.T",
      "T....,.,...*,....................,..,..T",
      "T.....,,.............,.........,.......T",
      "T..*..........*........*,..............T",
      "TT.,......,......................,..,.TT",
      "TcccccccckckccckLccccccLccckcccccLcckccT",
      "TcccccLcccckcccckccccccckccccccccccccccT",
      "T..,..,k.....LkPccccccccPcL.....k*,....T",
      "T......k.....cpppppppqppppc.....k......T",
      "T......k.....cppqpppppppppc....,k.,..,.T",
      "T......k...,.cppppppppqpppc.....k.,....T",
      "T..,...r....rkpppqppppppppc*...rk..,...T",
      "Tb.....r..,.xcpppppppppqppc.,..xk..L.*bT",
      "Tccccccckcccccppppqpppppppccccckcccccccc",
      "TcckcccccccckkppppppppppqpcccckccccckccT",
      "T,.,L..k.....cpppppqppppppk.....k......T",
      "T..*.,.k.,...cqppppppppppqc..,*.k,.....T",
      "T....,.k,...,cppppppqpppppc....,k.,....T",
      "T....,.k.....LcPccccccckPcL,....k.....bT",
      "Tcccccccccccccxccccckccccccccck......,.T",
      "T.,.,.....,......*.......,..........~~~T",
      "T......*.......,......,.............~~~T",
      "T*..,..,.....,..,....,..*.....*,....~~~T",
      "T,...***..,..........,..............~~~T",
      "T,...,,......,..*..............*....~~~T",
      "Tb....,...,...T..............*...*,..,bT",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
    props: [
      { art: "church", x: 2, y: 1 },
      { art: "library", x: 8, y: 1 },
      { art: "town_hall", x: 17, y: 1 },
      { art: "clock_tower", x: 23, y: 1 },
      { art: "mansion", x: 29, y: 1 },
      { art: "mayors", x: 34, y: 1 },
      { art: "tavern", x: 2, y: 8 },
      { art: "general_store", x: 8, y: 8 },
      { art: "guild", x: 27, y: 8 },
      { art: "merchant", x: 33, y: 8 },
      { art: "blacksmith", x: 2, y: 16 },
      { art: "bakery", x: 8, y: 16 },
      { art: "doctors", x: 27, y: 16 },
      { art: "noble", x: 33, y: 16 },
      { art: "town_house", x: 3, y: 21 },
      { art: "florist", x: 9, y: 21 },
      { art: "post", x: 15, y: 21 },
      { art: "tailor", x: 21, y: 21 },
      { art: "herbalist", x: 26, y: 21 },
      { art: "mill", x: 31, y: 21 },
      { art: "fountain", x: 18, y: 12 },
    ],
    entities: [
      { kind: "npc", id: "npc_scout_elaine", x: 22, y: 11 },
      // Loops the plaza around the fountain, clear of Elaine, the crystal and every door.
      { kind: "merchant", id: "npc_adventurer_kael", x: 15, y: 10, route: [[15, 10], [24, 10], [24, 15], [15, 15]] },
      { kind: "crystal", id: "oakheart_square", x: 16, y: 16 },
      { kind: "chest", id: "oakheart_chest", x: 37, y: 26, item: "potion", count: 1 },
      { kind: "sign", id: "oakheart_sign", x: 37, y: 13, text: "→ Whispering Forest" },
      // The General Store's front door (its sprite's door column) leads into the player's shop.
      { kind: "door", id: "player_shop_door", x: 10, y: 12, to: "oakheart_player_shop_interior", ax: 2, ay: 6 },
    ],
    exits: [{ x: 39, y: 14, to: "whispering_forest", ax: 1, ay: 8 }],
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
    exits: [{ x: 0, y: 8, to: "oakheart_village", ax: 38, ay: 14 }],
  },
  // SHOP_TOPDOWN_SCENE §2 sample room: four shelves, one counter, the door at (1,7), hero spawn (2,6).
  oakheart_player_shop_interior: {
    id: "oakheart_player_shop_interior",
    name: "ร้านของคุณ",
    rows: ["wwwwwwwwww", "w::::::::w", "w::::::::w", "w::::::::w", "w::::::::w", "w::::::::w", "w::::::::w", "wd:::::::w"],
    entities: [
      { kind: "shelf", id: "shelf_a", x: 3, y: 1 },
      { kind: "shelf", id: "shelf_b", x: 6, y: 1 },
      { kind: "shelf", id: "shelf_c", x: 3, y: 3 },
      { kind: "shelf", id: "shelf_d", x: 6, y: 3 },
      { kind: "counter", id: "shop_counter", x: 5, y: 5 },
    ],
    exits: [{ x: 1, y: 7, to: "oakheart_village", ax: 10, ay: 13 }],
  },
};

export type CheckpointId = "oakheart_square" | "forest_clearing";
/** Where a checkpoint restores the hero: the tile in front of its crystal. */
export const CHECKPOINTS: Record<CheckpointId, { map: MapId; x: number; y: number }> = {
  oakheart_square: { map: "oakheart_village", x: 16, y: 17 },
  forest_clearing: { map: "whispering_forest", x: 3, y: 11 },
};
export const START = CHECKPOINTS.oakheart_square;

export function tileAt(map: WorldMap, x: number, y: number): TileName | null {
  const ch = map.rows[y]?.[x];
  return ch === undefined ? null : (LEGEND[ch] ?? "forest");
}

/** Where walking NPCs stand right now, by entity id (explore.ts owns their clock). */
export type Walkers = Partial<Record<string, { x: number; y: number }>>;

/** Entities still present: defeated enemies are gone, opened chests stay (as open chests). */
export function liveEntities(map: WorldMap, save: SaveData, walkers: Walkers = {}): Entity[] {
  return map.entities
    .filter((e) => e.kind !== "enemy" || !save.progress.defeated.includes(e.id))
    .map((e) => (walkers[e.id] ? { ...e, ...walkers[e.id] } : e));
}

export function entityAt(map: WorldMap, save: SaveData, x: number, y: number, walkers: Walkers = {}) {
  return liveEntities(map, save, walkers).find((e) => e.x === x && e.y === y) ?? null;
}

/** Every tile of a merchant's loop, in walking order. */
export function routeTiles(route: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  route.forEach(([x, y], i) => {
    const [nx, ny] = route[(i + 1) % route.length];
    for (let t = 0; t < Math.abs(nx - x) + Math.abs(ny - y); t++) out.push([x + Math.sign(nx - x) * t, y + Math.sign(ny - y) * t]);
  });
  return out;
}

const footprints = new Map<MapId, Set<string>>();
/** Tiles covered by the solid part of a building or the fountain. */
export function underProp(map: WorldMap, x: number, y: number): boolean {
  let set = footprints.get(map.id);
  if (!set) {
    set = new Set();
    for (const p of map.props ?? []) {
      const [x0, x1, y0, y1] = PROP_ART[p.art].foot;
      for (let yy = p.y + y0; yy <= p.y + y1; yy++) for (let xx = p.x + x0; xx <= p.x + x1; xx++) set.add(`${xx},${yy}`);
    }
    footprints.set(map.id, set);
  }
  return set.has(`${x},${y}`);
}

export function walkable(map: WorldMap, save: SaveData, x: number, y: number, walkers: Walkers = {}): boolean {
  const t = tileAt(map, x, y);
  return t !== null && !SOLID.has(t) && !underProp(map, x, y) && !entityAt(map, save, x, y, walkers);
}

/** What the hero can interact with: the tile it faces first, then any other neighbour. */
export function interactTarget(map: WorldMap, save: SaveData, x: number, y: number, dir: Dir, walkers: Walkers = {}): Entity | null {
  const order: Dir[] = [dir, ...(["up", "down", "left", "right"] as Dir[]).filter((d) => d !== dir)];
  for (const d of order) {
    const e = entityAt(map, save, x + STEP[d][0], y + STEP[d][1], walkers);
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
export const GOLD_CAP = 9_999_999;

/** LOOT_DROP_SYSTEM encounter table; only enemies whose material item exists are listed. */
export const LOOT: Partial<Record<EnemyId, { gold: [number, number]; item: ItemId }>> = {
  forest_wolf: { gold: [8, 18], item: "wolf_pelt" }, // PLACEHOLDER: material drop chance is not authored, so it is always 1
};
/** Gold within the inclusive range, fixed by the encounter id so a reload can never reroll it. */
export function lootOf(enemy: EnemyId, encounterId: string) {
  const l = LOOT[enemy];
  if (!l) return null;
  let hash = 0;
  for (const c of encounterId) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return { gold: l.gold[0] + (hash % (l.gold[1] - l.gold[0] + 1)), item: l.item };
}

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
  const loot = lootOf(e.enemy, encounterId);
  if (loot) {
    n.gold = Math.min(n.gold + loot.gold, GOLD_CAP);
    // shortcut: a full stack drops the pelt (no pending-reward box yet); three wolves cannot reach 99.
    n.items[loot.item] = Math.min(n.items[loot.item] + 1, ITEM_CAP);
  }
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
  n.gold = Math.min(n.gold + QUEST_REWARD.gold, GOLD_CAP);
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
