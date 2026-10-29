import { describe, expect, it } from "vitest";
import { act, chooseIntent, damage, illegal, magicBase, physicalBase, startBattle, type BattleState, type Command } from "../src/astra/battle";
import { CLASS_IDS, CLASSES, STARTING_ITEMS } from "../src/astra/data";
import { effectiveStats } from "../src/astra/hero";

const fight = (classId: (typeof CLASS_IDS)[number] = "knight", talentId = "tough_skin") => {
  const s = effectiveStats(classId, talentId);
  return startBattle({ classId, talentId, hp: s.maxHp, mp: s.maxMp }, STARTING_ITEMS, "forest_wolf_1", "forest_wolf");
};
let n = 0;
const run = (b: BattleState, c: Command) => act(b, `t${++n}`, c);

describe("COMBAT_SPEC deterministic cases", () => {
  it("matches the damage table", () => {
    expect(physicalBase(16, 18, 8)).toBe(26);
    expect(magicBase(20, 12, 9)).toBe(23);
    expect(damage(26, 1.2)).toBe(31);
    expect(damage(26, 1.1)).toBe(28);
    expect(damage(100, 0.4)).toBe(40);
    expect(damage(100, 0.5, 0.4)).toBe(20);
    expect(damage(30, 1.2, 1.25)).toBe(45);
    expect(damage(100, 0.85)).toBe(85);
    expect(physicalBase(1, 0, 50)).toBe(1); // never below 1
  });
  it("wolf intent: heavy every third action, ferocious under 30% HP, else bite", () => {
    expect(chooseIntent(0, 90, 90)).toBe("bite");
    expect(chooseIntent(1, 90, 90)).toBe("bite");
    expect(chooseIntent(2, 90, 90)).toBe("heavy_bite");
    expect(chooseIntent(0, 26, 90)).toBe("ferocious_bite"); // 26 < 27 = 30% of 90
    expect(chooseIntent(0, 27, 90)).toBe("bite"); // exactly 30% is not below
    expect(chooseIntent(5, 10, 90)).toBe("heavy_bite"); // scripted heavy wins
  });
});

describe("battle turns", () => {
  it("reveals the opening intent and lets the hero act first in round 1", () => {
    const b = fight("knight");
    expect(b.intent).toBe("bite");
    const r = run(b, { type: "attack" });
    expect(r.events[0]).toMatchObject({ type: "hit", by: "hero", name: "Attack", damage: 14 + 0 - 8 });
    // Wolf SPD 14 > Knight 8: it answers in round 1 and also opens round 2.
    expect(r.events.filter((e) => e.type === "hit" && e.by === "foe")).toHaveLength(2);
    expect(r.state.round).toBe(2);
  });
  it("a faster hero gets exactly one enemy action per command", () => {
    const r = run(fight("ranger"), { type: "attack" }); // SPD 18 vs 14
    expect(r.events.filter((e) => e.type === "hit" && e.by === "foe")).toHaveLength(1);
  });
  it("uses the locked intent's power and Defend halves it", () => {
    const b = fight("ranger");
    const hs = effectiveStats("ranger", "tough_skin");
    const bite = physicalBase(13, 4, hs.def);
    expect(run(b, { type: "attack" }).state.hero.hp).toBe(hs.maxHp - bite);
    expect(run(b, { type: "defend" }).state.hero.hp).toBe(hs.maxHp - Math.floor(bite * 0.5));
  });
  it("spends skill MP once and refuses an unaffordable skill without any change", () => {
    const b = fight("berserk");
    const r = run(b, { type: "skill" });
    expect(r.state.hero.mp).toBe(b.hero.mp - CLASSES.berserk.skill.mp);
    const broke = { ...b, hero: { ...b.hero, mp: 3 } };
    expect(illegal(broke, { type: "skill" })).toBe("MP ไม่พอ");
    expect(act(broke, "x", { type: "skill" })).toEqual({ state: broke, events: [] });
  });
  it("magic skills use MAG against RES", () => {
    const r = run(fight("sorcerer"), { type: "skill" });
    expect(r.events[0]).toMatchObject({ name: "Firebolt", damage: magicBase(20, 12, 6) });
  });
  it("ignores a repeated action id (double tap, replay)", () => {
    const b = fight();
    const once = act(b, "same", { type: "attack" });
    expect(act(once.state, "same", { type: "attack" })).toEqual({ state: once.state, events: [] });
  });
  it("potions heal up to max and are consumed once; full HP refuses", () => {
    const b = fight("ranger");
    expect(illegal(b, { type: "item", item: "potion" })).toBe("HP เต็มแล้ว");
    const hurt = { ...b, hero: { ...b.hero, hp: 20 } };
    const r = run(hurt, { type: "item", item: "potion" });
    expect(r.events[0]).toMatchObject({ type: "heal", amount: 50 });
    expect(r.state.items.potion).toBe(STARTING_ITEMS.potion - 1);
    expect(illegal(b, { type: "item", item: "frost_shard" })).toMatch(/ขั้นที่ 4/);
  });
  it("ends in a win with the foe at 0 and stops accepting commands", () => {
    let b = fight("berserk");
    for (let i = 0; i < 20 && !b.over; i++) b = run(b, { type: "attack" }).state;
    expect(b.over).toBe("win");
    expect(b.foe.hp).toBe(0);
    expect(run(b, { type: "attack" }).events).toEqual([]);
  });
  it("ends in a loss when the hero falls, never below 0 HP", () => {
    let b = { ...fight("sorcerer"), hero: { hp: 5, mp: 0, defending: false } };
    b = run(b, { type: "defend" }).state;
    expect(b.over).toBe("lose");
    expect(b.hero.hp).toBe(0);
  });
  it("every class can beat one wolf from full HP by attacking and using skills", () => {
    for (const c of CLASS_IDS) {
      let b = fight(c, "tough_skin");
      for (let i = 0; i < 60 && !b.over; i++) b = run(b, illegal(b, { type: "skill" }) ? { type: "attack" } : { type: "skill" }).state;
      expect(b.over, c).toBe("win");
    }
  });
});
