// The journey: a branching route of nodes (battle, chest, rest, Kael, boss) chosen one at a
// time, in the style of a route-choice RPG. Pure functions over SaveData so a replayed choice
// or victory never pays twice; journey.ts only draws and forwards taps.
import { ENEMIES, ITEMS, LEVEL_EXP, type EnemyId, type ItemId } from "./data";
import { effectiveStats } from "./hero";
import type { SaveData } from "./save";

export type NodeKind = "battle" | "chest" | "rest" | "shop" | "boss";
export interface RouteNode {
  kind: NodeKind;
  /** Row from the start (1) to the boss (last). */
  row: number;
  /** Column slot 0–2 for drawing. */
  col: number;
  next: string[];
  enemy?: EnemyId;
  loot?: Partial<Record<ItemId, number>>;
}

/** PLACEHOLDER route: the GDD has no route map yet. Every path passes 3–4 fights before the boss. */
export const ROUTE: Record<string, RouteNode> = {
  r1a: { kind: "battle", row: 1, col: 0, enemy: "forest_wolf", next: ["r2a", "r2b"] },
  r1b: { kind: "battle", row: 1, col: 2, enemy: "forest_wolf", next: ["r2b", "r2c"] },
  r2a: { kind: "chest", row: 2, col: 0, loot: { potion: 1, frost_shard: 1 }, next: ["r3a"] },
  r2b: { kind: "battle", row: 2, col: 1, enemy: "forest_wolf", next: ["r3a", "r3b"] },
  r2c: { kind: "rest", row: 2, col: 2, next: ["r3b"] },
  r3a: { kind: "battle", row: 3, col: 0, enemy: "forest_wolf", next: ["r4a", "r4b"] },
  r3b: { kind: "shop", row: 3, col: 2, next: ["r4b", "r4c"] },
  r4a: { kind: "rest", row: 4, col: 0, next: ["r5a"] },
  r4b: { kind: "battle", row: 4, col: 1, enemy: "forest_wolf", next: ["r5a", "r5b"] },
  r4c: { kind: "chest", row: 4, col: 2, loot: { potion: 2, storm_vial: 1 }, next: ["r5b"] },
  r5a: { kind: "battle", row: 5, col: 0, enemy: "forest_wolf", next: ["boss"] },
  r5b: { kind: "rest", row: 5, col: 2, next: ["boss"] },
  boss: { kind: "boss", row: 6, col: 1, enemy: "ancient_guardian", next: [] },
};
export const ROUTE_START = ["r1a", "r1b"];
export const ROUTE_ROWS = 6;

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

export const levelFor = (exp: number) => LEVEL_EXP.filter((need) => exp >= need).length;
/** EXP from one victory; Quick Learner adds 15% (floored). */
export const expFor = (enemy: keyof typeof ENEMIES, talentId: string) =>
  Math.floor((ENEMIES[enemy].exp * (talentId === "quick_learner" ? 115 : 100)) / 100);

const clone = (s: SaveData): SaveData => JSON.parse(JSON.stringify(s));
const maxOf = (s: SaveData) => effectiveStats(s.hero.classId, s.hero.talentId, s.hero.level);
const heal = (n: SaveData) => {
  const max = maxOf(n);
  n.hero.hp = max.maxHp;
  n.hero.mp = max.maxMp;
};

export const here = (s: SaveData): string | null => s.progress.path.at(-1) ?? null;
/** Nodes the hero may pick next; none once the boss is beaten. */
export const choices = (s: SaveData): string[] => {
  const at = here(s);
  return at ? ROUTE[at].next : ROUTE_START;
};
/** True when `path` starts at a start node and follows route edges. */
export function validPath(path: string[]): boolean {
  return path.every((id, i) => id in ROUTE && (i === 0 ? ROUTE_START.includes(id) : ROUTE[path[i - 1]].next.includes(id)));
}

/**
 * Steps onto a chest or rest node and applies it, or onto a shop node (Kael's menu opens after).
 * Battles and the boss go through `recordVictory` instead. Null if the node is not reachable now.
 */
export function visit(s: SaveData, id: string): SaveData | null {
  const node = ROUTE[id];
  if (!node || !choices(s).includes(id) || node.kind === "battle" || node.kind === "boss") return null;
  const n = clone(s);
  n.progress.path.push(id);
  if (node.kind === "rest") heal(n); // PLACEHOLDER: a rest fully restores HP/MP
  for (const [item, qty] of Object.entries(node.loot ?? {}) as [ItemId, number][])
    n.items[item] = Math.min(n.items[item] + qty, ITEM_CAP);
  return n;
}

/** Applies a won fight on a reachable battle/boss node. Replaying it changes nothing. */
export function recordVictory(s: SaveData, id: string): SaveData {
  const node = ROUTE[id];
  if (!node?.enemy || !choices(s).includes(id)) return s;
  const n = clone(s);
  n.progress.path.push(id);
  n.hero.exp = Math.min(n.hero.exp + expFor(node.enemy, n.hero.talentId), 1e7);
  const was = n.hero.level;
  n.hero.level = levelFor(n.hero.exp);
  if (n.hero.level > was) heal(n); // PLACEHOLDER: a level-up fully restores HP/MP (no rule in the GDD yet)
  const loot = lootOf(node.enemy, id);
  if (loot) {
    n.gold = Math.min(n.gold + loot.gold, GOLD_CAP);
    n.items[loot.item] = Math.min(n.items[loot.item] + 1, ITEM_CAP);
  }
  if (node.kind === "boss") n.progress.wins += 1;
  return n;
}

/** A lost fight, or a new journey after the boss: back to the start at full strength. Level, items and Gold stay. */
export function restartRun(s: SaveData): SaveData {
  const n = clone(s);
  n.progress.path = [];
  heal(n);
  return n;
}

export const itemName = (id: ItemId) => ITEMS[id].name;
export const NODE_LABEL: Record<NodeKind, string> = { battle: "ต่อสู้", chest: "หีบสมบัติ", rest: "จุดพัก", shop: "Kael", boss: "บอส" };
