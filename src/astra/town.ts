// The town between journeys (owner reference): a training hall that spends stat points, a
// blacksmith that hones the class weapon or crafts battle items, and a farm that hatches pets.
// Pure, all-or-nothing changes over SaveData like trade.ts; journey.ts only draws and forwards taps.
import { HONE_MAX, honeCost, ITEMS, PADDOCK, PET_IDS, RECIPES, TRAIN_CAP, type ItemId, type TrainId } from "./data";
import { heroMax, noTraining } from "./hero";
import { ITEM_CAP } from "./route";
import type { SaveData } from "./save";

export type Change = { ok: true; save: SaveData } | { ok: false; why: string };
const clone = (s: SaveData): SaveData => JSON.parse(JSON.stringify(s));
/** Keeps current HP/MP within a max that may have just shrunk (a reset). */
const clamp = (n: SaveData) => {
  const max = heroMax(n.hero);
  n.hero.hp = Math.min(n.hero.hp, max.maxHp);
  n.hero.mp = Math.min(n.hero.mp, max.maxMp);
  return n;
};

export const pointsLeft = (s: SaveData) => s.hero.level - 1 - Object.values(s.hero.train).reduce((a, n) => a + n, 0);

/** One point into a training line; a raised MaxHP/MaxMP also raises current HP/MP by the same amount. */
export function train(s: SaveData, id: TrainId): Change {
  if (!(id in s.hero.train)) return { ok: false, why: "ไม่มีสายฝึกนี้" };
  if (pointsLeft(s) < 1) return { ok: false, why: "ไม่มีแต้มเหลือ" };
  if (s.hero.train[id] >= TRAIN_CAP) return { ok: false, why: "ถึงขีดสูงสุดแล้ว" };
  const n = clone(s);
  const was = heroMax(n.hero);
  n.hero.train[id] += 1;
  const now = heroMax(n.hero);
  n.hero.hp += now.maxHp - was.maxHp;
  n.hero.mp += now.maxMp - was.maxMp;
  return { ok: true, save: n };
}

/** Returns every point (PLACEHOLDER: free, the reference shows no cost). */
export function resetTraining(s: SaveData): Change {
  if (pointsLeft(s) === s.hero.level - 1) return { ok: false, why: "ยังไม่ได้ใช้แต้ม" };
  const n = clone(s);
  n.hero.train = noTraining();
  return { ok: true, save: clamp(n) };
}

/** Hones the weapon one level for Gold and Wolf Pelts (PLACEHOLDER: always succeeds). */
export function hone(s: SaveData): Change {
  if (s.hero.hone >= HONE_MAX) return { ok: false, why: `ตีบวกสูงสุด +${HONE_MAX} แล้ว` };
  const c = honeCost(s.hero.hone);
  if (s.gold < c.gold) return { ok: false, why: "Gold ไม่พอ" };
  if (s.items.wolf_pelt < c.wolf_pelt) return { ok: false, why: "Wolf Pelt ไม่พอ" };
  const n = clone(s);
  n.gold -= c.gold;
  n.items.wolf_pelt -= c.wolf_pelt;
  n.hero.hone += 1;
  return { ok: true, save: n };
}

/** Crafts one battle item from its recipe. */
export function craft(s: SaveData, item: ItemId): Change {
  const r = RECIPES[item];
  if (!r || !(item in ITEMS)) return { ok: false, why: "สร้างของชิ้นนี้ไม่ได้" };
  if (s.gold < r.gold) return { ok: false, why: "Gold ไม่พอ" };
  if (s.items.wolf_pelt < r.wolf_pelt) return { ok: false, why: "Wolf Pelt ไม่พอ" };
  if (s.items[item] >= ITEM_CAP) return { ok: false, why: "กระเป๋าเต็ม" };
  const n = clone(s);
  n.gold -= r.gold;
  n.items.wolf_pelt -= r.wolf_pelt;
  n.items[item] += 1;
  return { ok: true, save: n };
}

/**
 * Hatches one Pet Egg into the paddock. The species comes from the hero name and egg count, so a
 * reload can never reroll it (PLACEHOLDER: all four are equally likely, no rarities yet).
 */
export function hatch(s: SaveData): Change {
  if (s.items.pet_egg < 1) return { ok: false, why: "ไม่มีไข่" };
  if (s.pets.list.length >= PADDOCK) return { ok: false, why: "คอกเต็มแล้ว" };
  const n = clone(s);
  const id = n.pets.seq + 1;
  let hash = id;
  for (const c of n.hero.name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  n.items.pet_egg -= 1;
  n.pets.seq = id;
  n.pets.list.push({ id, species: PET_IDS[hash % PET_IDS.length], xp: 0 });
  if (n.pets.with === null) n.pets.with = id; // the first pet comes along straight away
  return { ok: true, save: n };
}

/** Picks which pet travels with the hero (null: none). */
export function bring(s: SaveData, id: number | null): Change {
  if (id !== null && !s.pets.list.some((p) => p.id === id)) return { ok: false, why: "ไม่มีสัตว์ตัวนี้" };
  const n = clone(s);
  n.pets.with = id;
  return { ok: true, save: n };
}

/** Lets a pet go to free a paddock slot. */
export function release(s: SaveData, id: number): Change {
  const pet = s.pets.list.find((p) => p.id === id);
  if (!pet) return { ok: false, why: "ไม่มีสัตว์ตัวนี้" };
  const n = clone(s);
  n.pets.list = n.pets.list.filter((p) => p.id !== id);
  if (n.pets.with === id) n.pets.with = null;
  return { ok: true, save: n };
}
