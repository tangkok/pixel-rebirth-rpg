import { describe, expect, it } from "vitest";
import { act, guard, startBattle } from "../src/astra/battle";
import { PADDOCK, petBite, petLevel, STARTING_ITEMS } from "../src/astra/data";
import { heroMax } from "../src/astra/hero";
import { defaultLook } from "../src/astra/looks";
import { recordVictory } from "../src/astra/route";
import { newSave, parseSave, type SaveData } from "../src/astra/save";
import { bring, hatch, release } from "../src/astra/town";

const fresh = () => newSave("Hero", "male", "knight", "tough_skin", defaultLook("male", "knight"));
const ok = (r: ReturnType<typeof hatch>): SaveData => {
  if (!r.ok) throw new Error(r.why);
  return r.save;
};

describe("farm", () => {
  it("hatches the starting egg into a pet that comes along, the same species on every reload", () => {
    const s = ok(hatch(fresh()));
    expect(s.items.pet_egg).toBe(0);
    expect(s.pets.list).toHaveLength(1);
    expect(s.pets.with).toBe(1);
    expect(ok(hatch(fresh())).pets.list[0].species).toBe(s.pets.list[0].species);
    expect(hatch(s)).toEqual({ ok: false, why: "ไม่มีไข่" });
  });
  it("refuses a full paddock; release frees a slot and the travelling pet stays home", () => {
    let s = fresh();
    s.items.pet_egg = PADDOCK + 1;
    for (let i = 0; i < PADDOCK; i++) s = ok(hatch(s));
    expect(hatch(s).ok).toBe(false);
    s = ok(release(s, 1));
    expect([s.pets.list.length, s.pets.with]).toEqual([PADDOCK - 1, null]);
    s = ok(bring(s, 2));
    expect(s.pets.with).toBe(2);
    expect(bring(s, 99).ok).toBe(false);
  });
  it("save keeps pets and rejects a travelling pet that is not in the paddock", () => {
    const s = ok(hatch(fresh()));
    expect(parseSave(JSON.stringify(s))?.pets).toEqual(s.pets);
    expect(parseSave(JSON.stringify({ ...s, pets: { ...s.pets, with: 5 } }))).toBeNull();
    const old = JSON.parse(JSON.stringify(fresh()));
    delete old.pets;
    delete old.items.pet_egg;
    expect(parseSave(JSON.stringify(old))?.pets).toEqual({ seq: 0, list: [], with: null });
  });
});

describe("pet in battle", () => {
  const hero = () => {
    const m = heroMax(fresh().hero);
    return { classId: "knight" as const, talentId: "tough_skin", hp: m.maxHp, mp: m.maxMp };
  };
  it("bites after the hero's action and uses its ability on the third", () => {
    let b = startBattle(hero(), STARTING_ITEMS, "r1a", "forest_wolf", "normal", { species: "kitten", level: 1 });
    const hp0 = b.foe.hp;
    let r = act(b, "a1", { type: "defend" });
    expect(r.events.find((e) => e.type === "pet")).toMatchObject({ name: "กัด", damage: petBite(1) });
    expect(hp0 - r.state.foe.hp).toBe(petBite(1));
    let g = 0;
    const foes = (x: typeof b) => {
      while (x.queue[0] === "foe" && !x.over) x = guard(x, `g${++g}`).state;
      return x;
    };
    b = foes(act(foes(r.state), "a2", { type: "defend" }).state);
    r = act(b, "a3", { type: "defend" });
    expect(r.events.find((e) => e.type === "pet")).toMatchObject({ name: "ข่วนรัว", damage: petBite(1) * 3 });
  });
  it("no pet, no bite", () => {
    const r = act(startBattle(hero(), STARTING_ITEMS, "r1a", "forest_wolf"), "a1", { type: "defend" });
    expect(r.events.some((e) => e.type === "pet")).toBe(false);
  });
});

describe("pet rewards", () => {
  it("the travelling pet gets half the EXP; the boss leaves an egg", () => {
    const s = ok(hatch(fresh()));
    const won = recordVictory(s, "r1a");
    expect(won.pets.list[0].xp).toBe(Math.floor((won.hero.exp - s.hero.exp) / 2));
    const boss = recordVictory({ ...won, progress: { ...won.progress, path: ["r1b", "r2c", "r3b", "r4c", "r5b"] } }, "boss");
    expect(boss.items.pet_egg).toBe(1);
  });
  it("pet levels follow 10 × (L² − 1)", () => {
    expect([petLevel(0), petLevel(29), petLevel(30), petLevel(80), petLevel(1e7)]).toEqual([1, 1, 2, 3, 30]);
  });
});
