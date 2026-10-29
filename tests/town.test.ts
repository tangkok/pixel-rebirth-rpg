import { describe, expect, it } from "vitest";
import { startBattle } from "../src/astra/battle";
import { LEVEL_EXP, MAX_LEVEL } from "../src/astra/data";
import { heroMax } from "../src/astra/hero";
import { defaultLook } from "../src/astra/looks";
import { craft, forgeArmor, hone, pointsLeft, resetTraining, train, wear } from "../src/astra/town";
import { newSave, parseSave, type SaveData } from "../src/astra/save";

const at = (level: number, extra: (s: SaveData) => void = () => {}): SaveData => {
  const s = newSave("Hero", "male", "knight", "tough_skin", defaultLook("male", "knight"));
  s.hero.level = level;
  extra(s);
  return s;
};
const ok = (r: ReturnType<typeof train>) => {
  if (!r.ok) throw new Error(r.why);
  return r.save;
};

describe("levels", () => {
  it("keeps the GDD's first thresholds and continues to level 20", () => {
    expect(LEVEL_EXP.slice(0, 3)).toEqual([0, 30, 80]);
    expect(MAX_LEVEL).toBe(20);
  });
});

describe("training hall", () => {
  it("gives one point per level above 1 and spends it on a percent bonus", () => {
    const s = at(3);
    expect(pointsLeft(s)).toBe(2);
    const t = ok(train(s, "vitality"));
    expect(pointsLeft(t)).toBe(1);
    expect(heroMax(t.hero).maxHp).toBeGreaterThan(heroMax(s.hero).maxHp);
    expect(t.hero.hp - s.hero.hp).toBe(heroMax(t.hero).maxHp - heroMax(s.hero).maxHp); // raised max fills too
  });
  it("refuses with no points left or at the cap, and resets for free", () => {
    expect(train(at(1), "strength")).toEqual({ ok: false, why: "ไม่มีแต้มเหลือ" });
    expect(train(at(20, (s) => (s.hero.train.strength = 10)), "strength").ok).toBe(false);
    const r = ok(resetTraining(ok(train(at(2), "strength"))));
    expect(pointsLeft(r)).toBe(1);
    expect(resetTraining(at(2)).ok).toBe(false);
  });
  it("Focus widens the battle timing window and points reach the battle stats", () => {
    const s = ok(train(ok(train(at(3), "focus")), "strength"));
    const b = startBattle(s.hero, s.items, "r1a", "forest_wolf");
    expect(b.focus).toBe(3);
    expect(b.bonus?.atk).toBe(1);
  });
  it("save rejects more points spent than the level gives, and loads pre-town saves", () => {
    const bad = at(2, (s) => (s.hero.train.guard = 2));
    expect(parseSave(JSON.stringify(bad))).toBeNull();
    const old = JSON.parse(JSON.stringify(at(2)));
    delete old.hero.train;
    delete old.hero.hone;
    expect(parseSave(JSON.stringify(old))?.hero).toMatchObject({ hone: 0, train: { strength: 0 } });
  });
});

describe("blacksmith", () => {
  it("hones the weapon for Gold and Wolf Pelts, raising ATK", () => {
    const s = at(1, (x) => ((x.gold = 100), (x.items.wolf_pelt = 3)));
    const h = ok(hone(s));
    expect([h.hero.hone, h.gold, h.items.wolf_pelt]).toEqual([1, 80, 2]);
    expect(heroMax(h.hero).atk).toBeGreaterThan(heroMax(s.hero).atk);
    expect(hone(at(1)).ok).toBe(false); // no Gold
  });
  it("crafts a Potion from a pelt and Gold, all or nothing", () => {
    const s = at(1, (x) => ((x.gold = 5), (x.items.wolf_pelt = 1)));
    const c = ok(craft(s, "potion"));
    expect([c.gold, c.items.wolf_pelt, c.items.potion]).toEqual([0, 0, s.items.potion + 1]);
    expect(craft(c, "potion")).toEqual({ ok: false, why: "Gold ไม่พอ" });
    expect(craft(s, "wolf_pelt").ok).toBe(false);
  });
});

describe("armour", () => {
  it("a new hero wears the plain tunic with its ordinary stats", () => {
    const s = at(1);
    expect([s.hero.armor, s.hero.armors, s.hero.look.outfit]).toEqual(["tunic", ["tunic"], 16]);
    expect(heroMax(s.hero).def).toBe(heroMax({ ...s.hero, armor: "tunic" }).def);
  });
  it("forges a set once for Pelts and Gold, then wearing it changes stats and outfit", () => {
    const s = at(1, (x) => ((x.gold = 50), (x.items.wolf_pelt = 3)));
    const f = ok(forgeArmor(s, "hunter"));
    expect([f.gold, f.items.wolf_pelt, f.hero.armors]).toEqual([10, 0, ["tunic", "hunter"]]);
    expect(forgeArmor(f, "hunter").ok).toBe(false);
    const w = ok(wear(f, "hunter"));
    expect(w.hero.look.outfit).toBe(11);
    expect(heroMax(w.hero).spd).toBeGreaterThan(heroMax(f.hero).spd);
    expect(wear(s, "plate").ok).toBe(false);
  });
  it("save rejects wearing an unowned set and loads pre-armour saves in the tunic", () => {
    expect(parseSave(JSON.stringify(at(1, (x) => (x.hero.armor = "plate"))))).toBeNull();
    const old = JSON.parse(JSON.stringify(at(1)));
    delete old.hero.armor;
    delete old.hero.armors;
    expect(parseSave(JSON.stringify(old))?.hero).toMatchObject({ armor: "tunic", armors: ["tunic"] });
  });
});
