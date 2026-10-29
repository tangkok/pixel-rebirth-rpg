// The town between journeys (owner reference): a training hall that spends stat points, a
// blacksmith that hones the class weapon or crafts battle items, and a farm that hatches pets.
// Pure, all-or-nothing changes over SaveData like trade.ts; journey.ts only draws and forwards taps.
import { ARMORS, EGGS, FARM_TIERS, HONE_MAX, honeChance, honeCost, ITEMS, PET_IDS, PET_RARITIES, RECIPES, TRAIN_CAP, WEAPON_TIERS, type ArmorId, type EggId, type ItemId, type TrainId } from "./data";
import { checkName, heroMax, noTraining } from "./hero";
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

/**
 * Tries to hone the weapon one level for Gold and Wolf Pelts; on a miss the materials are spent and
 * the level stays. The roll comes from the save itself, so reloading cannot reroll it (each try
 * spends Gold, which changes the next roll).
 */
export function hone(s: SaveData): { ok: true; save: SaveData; hit: boolean } | { ok: false; why: string } {
  if (s.hero.hone >= HONE_MAX) return { ok: false, why: `ตีบวกสูงสุด +${HONE_MAX} แล้ว` };
  const c = honeCost(s.hero.hone);
  if (s.gold < c.gold) return { ok: false, why: "Gold ไม่พอ" };
  if (s.items.wolf_pelt < c.wolf_pelt) return { ok: false, why: "Wolf Pelt ไม่พอ" };
  const n = clone(s);
  n.gold -= c.gold;
  n.items.wolf_pelt -= c.wolf_pelt;
  let hash = s.gold * 7 + s.items.wolf_pelt * 13 + s.hero.hone * 101;
  for (const ch of s.hero.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hit = hash % 100 < honeChance(s.hero.hone);
  if (hit) n.hero.hone += 1;
  return { ok: true, save: n, hit };
}

/** Forges the class weapon into its next tier; the hone level carries over. */
export function forgeWeapon(s: SaveData): Change {
  const c = WEAPON_TIERS[s.hero.weapon + 1]?.cost;
  if (!c) return { ok: false, why: "อาวุธขั้นสูงสุดแล้ว" };
  if (s.gold < c.gold) return { ok: false, why: "Gold ไม่พอ" };
  if (s.items.wolf_pelt < c.wolf_pelt) return { ok: false, why: "Wolf Pelt ไม่พอ" };
  const n = clone(s);
  n.gold -= c.gold;
  n.items.wolf_pelt -= c.wolf_pelt;
  n.hero.weapon += 1;
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

/** Forges an armour set for Wolf Pelts and Gold; it is kept and can be worn any time after. */
export function forgeArmor(s: SaveData, id: ArmorId): Change {
  const c = ARMORS[id]?.cost;
  if (!c) return { ok: false, why: "หลอมชุดนี้ไม่ได้" };
  if (s.hero.armors.includes(id)) return { ok: false, why: "มีชุดนี้แล้ว" };
  if (s.gold < c.gold) return { ok: false, why: "Gold ไม่พอ" };
  if (s.items.wolf_pelt < c.wolf_pelt) return { ok: false, why: "Wolf Pelt ไม่พอ" };
  const n = clone(s);
  n.gold -= c.gold;
  n.items.wolf_pelt -= c.wolf_pelt;
  n.hero.armors.push(id);
  return { ok: true, save: n };
}

/** Wears an owned armour set: its stats apply and the hero's outfit changes to it. */
export function wear(s: SaveData, id: ArmorId): Change {
  if (!s.hero.armors.includes(id)) return { ok: false, why: "ยังไม่มีชุดนี้" };
  const n = clone(s);
  n.hero.armor = id;
  n.hero.look = { ...n.hero.look, ...ARMORS[id].look };
  return { ok: true, save: clamp(n) };
}

/** Paddock slots at the farm's current tier. */
export const slotsOf = (s: SaveData) => FARM_TIERS[s.pets.farm].slots;
/** True when the farm tier is high enough to hatch this egg's rarity. */
export const canHatch = (s: SaveData, egg: EggId) =>
  PET_RARITIES.indexOf(EGGS[egg]) <= PET_RARITIES.indexOf(FARM_TIERS[s.pets.farm].hatch);

/**
 * Hatches one egg into the paddock. The species comes from the hero name and egg count, so a
 * reload can never reroll it (PLACEHOLDER: all four species are equally likely).
 */
export function hatch(s: SaveData, egg: EggId = "pet_egg"): Change {
  if (!(egg in EGGS) || s.items[egg] < 1) return { ok: false, why: "ไม่มีไข่" };
  if (!canHatch(s, egg)) return { ok: false, why: "อัปเกรดฟาร์มก่อน" };
  if (s.pets.list.length >= slotsOf(s)) return { ok: false, why: "คอกเต็มแล้ว" };
  const n = clone(s);
  const id = n.pets.seq + 1;
  let hash = id;
  for (const c of n.hero.name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  n.items[egg] -= 1;
  n.pets.seq = id;
  n.pets.list.push({ id, species: PET_IDS[hash % PET_IDS.length], rarity: EGGS[egg], xp: 0, name: "", locked: false });
  if (n.pets.with === null) n.pets.with = id; // the first pet comes along straight away
  return { ok: true, save: n };
}

/** Open All: hatches eggs of one kind until none are left or the paddock is full. */
export function hatchAll(s: SaveData, egg: EggId): { save: SaveData; count: number; why: string } {
  let cur = s;
  let count = 0;
  for (;;) {
    const r = hatch(cur, egg);
    if (!r.ok) return { save: cur, count, why: r.why };
    cur = r.save;
    count += 1;
  }
}

/** Buys the next farm tier with Knowledge. */
export function upgradeFarm(s: SaveData): Change {
  const next = FARM_TIERS[s.pets.farm + 1];
  if (!next) return { ok: false, why: "ฟาร์มขั้นสูงสุดแล้ว" };
  if (s.knowledge < next.cost) return { ok: false, why: `ต้องการความรู้อีก ${next.cost - s.knowledge}` };
  const n = clone(s);
  n.knowledge -= next.cost;
  n.pets.farm += 1;
  return { ok: true, save: n };
}

/** Picks which pet travels with the hero (null: none). */
export function bring(s: SaveData, id: number | null): Change {
  if (id !== null && !s.pets.list.some((p) => p.id === id)) return { ok: false, why: "ไม่มีสัตว์ตัวนี้" };
  const n = clone(s);
  n.pets.with = id;
  return { ok: true, save: n };
}

/** Lets a pet go to free a paddock slot; a locked pet stays. */
export function release(s: SaveData, id: number): Change {
  const pet = s.pets.list.find((p) => p.id === id);
  if (!pet) return { ok: false, why: "ไม่มีสัตว์ตัวนี้" };
  if (pet.locked) return { ok: false, why: "สัตว์ตัวนี้ถูกล็อคอยู่" };
  const n = clone(s);
  n.pets.list = n.pets.list.filter((p) => p.id !== id);
  if (n.pets.with === id) n.pets.with = null;
  return { ok: true, save: n };
}

/** Locks or unlocks a pet against release and fusion. */
export function toggleLock(s: SaveData, id: number): Change {
  if (!s.pets.list.some((p) => p.id === id)) return { ok: false, why: "ไม่มีสัตว์ตัวนี้" };
  const n = clone(s);
  const p = n.pets.list.find((q) => q.id === id)!;
  p.locked = !p.locked;
  return { ok: true, save: n };
}

/** Names a pet (same rules as the hero name); an empty name goes back to the species name. */
export function renamePet(s: SaveData, id: number, raw: string): Change {
  if (!s.pets.list.some((p) => p.id === id)) return { ok: false, why: "ไม่มีสัตว์ตัวนี้" };
  let name = "";
  if (raw.trim()) {
    const c = checkName(raw);
    if (!c.ok) return { ok: false, why: c.error };
    name = c.name;
  }
  const n = clone(s);
  n.pets.list.find((q) => q.id === id)!.name = name;
  return { ok: true, save: n };
}

/** Partners `keep` can fuse with: same species and rarity, not locked, below legendary. */
export const fusePartners = (s: SaveData, keep: number) => {
  const k = s.pets.list.find((p) => p.id === keep);
  if (!k || k.rarity === "legendary") return [];
  return s.pets.list.filter((p) => p.id !== keep && p.species === k.species && p.rarity === k.rarity && !p.locked);
};

/** Fuses two pets of one family and rarity: `keep` rises one rarity with the higher XP, `other` is gone. */
export function fuse(s: SaveData, keep: number, other: number): Change {
  if (!fusePartners(s, keep).some((p) => p.id === other)) return { ok: false, why: "ผสานคู่นี้ไม่ได้" };
  const n = clone(s);
  const k = n.pets.list.find((p) => p.id === keep)!;
  const o = n.pets.list.find((p) => p.id === other)!;
  k.rarity = PET_RARITIES[PET_RARITIES.indexOf(k.rarity) + 1];
  k.xp = Math.max(k.xp, o.xp);
  n.pets.list = n.pets.list.filter((p) => p.id !== other);
  if (n.pets.with === other) n.pets.with = keep;
  return { ok: true, save: n };
}
