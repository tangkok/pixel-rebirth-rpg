import { describe, expect, it } from "vitest";
import {
  act,
  chooseIntent,
  damage,
  guard,
  heroStats,
  illegal,
  judge,
  magicBase,
  physicalBase,
  skillCost,
  startBattle,
  type BattleEvent,
  type BattleState,
  type Command,
  type Timing,
} from "../src/astra/battle";
import { CLASS_IDS, CLASSES, STARTING_ITEMS } from "../src/astra/data";
import { effectiveStats } from "../src/astra/hero";

const fight = (classId: (typeof CLASS_IDS)[number] = "knight", talentId = "tough_skin") => {
  const s = effectiveStats(classId, talentId);
  return startBattle({ classId, talentId, hp: s.maxHp, mp: s.maxMp }, STARTING_ITEMS, "forest_wolf_1", "forest_wolf");
};
let n = 0;
/** One hero command plus every enemy action until the hero's next turn. */
const run = (b: BattleState, c: Command, strike: Timing = "normal", block: Timing = "normal") => {
  let r = act(b, `t${++n}`, c, strike);
  const events: BattleEvent[] = [...r.events];
  while (events.length && !r.state.over && r.state.queue[0] === "foe") {
    r = guard(r.state, `t${++n}`, block);
    events.push(...r.events);
  }
  return { state: r.state, events };
};
const hits = (ev: BattleEvent[], by: "hero" | "foe") => ev.filter((e) => e.type === "hit" && e.by === by) as Extract<BattleEvent, { type: "hit" }>[];

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
    expect(illegal(b, { type: "item", item: "frost_shard" })).toBeNull();
  });
  it("ends in a win with the foe at 0 and stops accepting commands", () => {
    let b = fight("berserk");
    for (let i = 0; i < 20 && !b.over; i++) b = run(b, { type: "attack" }).state;
    expect(b.over).toBe("win");
    expect(b.foe.hp).toBe(0);
    expect(run(b, { type: "attack" }).events).toEqual([]);
  });
  it("ends in a loss when the hero falls, never below 0 HP", () => {
    let b = fight("sorcerer");
    b = { ...b, hero: { ...b.hero, hp: 5, mp: 0 } };
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

const with_ = (b: BattleState, hero: Partial<BattleState["hero"]> = {}, foe: Partial<BattleState["foe"]> = {}): BattleState => ({
  ...b,
  hero: { ...b.hero, ...hero },
  foe: { ...b.foe, ...foe },
});

describe("Perfect Strike / Guard (§3–4)", () => {
  it("judges by absolute offset: <=80 Perfect, <=180 Good, else Normal", () => {
    expect([judge(0), judge(-80), judge(81), judge(180), judge(-181), judge(999)]).toEqual(["perfect", "perfect", "good", "good", "normal", "normal"]);
  });
  it("strike timing multiplies damage once and grants Astra 15/10/5", () => {
    const b = fight("ranger");
    const base = physicalBase(heroStats(b).atk, 0, 8);
    for (const [t, mod, astra] of [["perfect", 1.2, 15], ["good", 1.1, 10], ["normal", 1, 5]] as const) {
      const e = act(b, `s-${t}`, { type: "attack" }, t).events[0];
      expect(e).toMatchObject({ damage: damage(base, mod), timing: t, astra });
    }
  });
  it("Perfect Guard blocks all damage, Good stacks with Defend, and guard grants Astra", () => {
    const b = fight("ranger");
    const bite = physicalBase(13, 4, heroStats(b).def);
    const r = run(b, { type: "defend" }, "normal", "perfect");
    expect(hits(r.events, "foe")[0]).toMatchObject({ damage: 0, astra: 15 }); // Perfect blocks fully
    expect(hits(run(b, { type: "attack" }, "normal", "perfect").events, "foe")[0].damage).toBe(0);
    expect(hits(run(b, { type: "defend" }, "normal", "good").events, "foe")[0].damage).toBe(damage(bite, 0.5, 0.75));
    expect(hits(run(b, { type: "defend" }, "normal", "good").events, "foe")[0].astra).toBe(10);
    expect(hits(run(b, { type: "defend" }).events, "foe")[0].astra).toBe(3);
  });
  it("clamps Astra at 100 (95 + 15)", () => {
    expect(act(with_(fight("ranger"), { astra: 95 }), "c", { type: "attack" }, "perfect").state.hero.astra).toBe(100);
  });
});

describe("Astra Burst (§5)", () => {
  it("needs exactly 100, spends all of it and has no timing bonus", () => {
    const b = fight("ranger");
    expect(illegal(with_(b, { astra: 99 }), { type: "burst" })).toBe("Astra ยังไม่เต็ม");
    const r = act(with_(b, { astra: 100 }), "b", { type: "burst" }, "perfect");
    expect(r.events[0]).toMatchObject({ name: "Celestial Arrow", damage: damage(physicalBase(heroStats(b).atk, 0, 8), 1.8), astra: 0 });
    expect(r.events[0]).not.toHaveProperty("timing", "perfect");
  });
  it("Berserk Crimson Rupture costs up to 5% MaxHP but never drops below 1", () => {
    const b = fight("berserk");
    const r = act(with_(b, { astra: 100, hp: 3 }), "b", { type: "burst" });
    expect(r.events.find((e) => e.type === "recoil")).toMatchObject({ damage: 2, hp: 1 });
  });
  it("Cleric Divine Judgment heals 25% MaxHP; Knight Aegis Breaker weakens the next bite", () => {
    const c = fight("cleric");
    const max = heroStats(c).maxHp;
    const r = act(with_(c, { astra: 100, hp: 10 }), "b", { type: "burst" });
    expect(r.events.find((e) => e.type === "heal")).toMatchObject({ amount: Math.floor(max / 4) });
    const k = fight("knight");
    const kr = run(with_(k, { astra: 100 }), { type: "burst" });
    expect(hits(kr.events, "foe")[0].damage).toBe(physicalBase(Math.floor(13 * 0.85), 4, heroStats(k).def));
    expect(hits(kr.events, "foe")[1].damage).toBe(physicalBase(13, 4, heroStats(k).def)); // only one action
  });
  it("resets Astra to 0 at each encounter", () => {
    expect(fight().hero.astra).toBe(0);
  });
});

describe("elemental reactions (§6)", () => {
  const item = (item: "water_flask" | "frost_shard" | "storm_vial"): Command => ({ type: "item", item });
  it("Water then Lightning is Conduct ×1.25 and clears the aura", () => {
    let b = fight("ranger");
    b = run(b, item("water_flask")).state;
    expect(b.foe.aura).toBe("water");
    const e = hits(run(b, item("storm_vial")).events, "hero")[0];
    expect(e).toMatchObject({ reaction: "conduct", aura: null, damage: damage(magicBase(heroStats(b).mag, 8, 6), 1.25) });
  });
  it("Water then Ice freezes: the enemy skips its next action", () => {
    let b = fight("ranger");
    b = run(b, item("water_flask")).state;
    const r = run(b, item("frost_shard"));
    expect(hits(r.events, "hero")[0].reaction).toBe("freeze");
    expect(r.events.some((e) => e.type === "frozen")).toBe(true);
    expect(hits(r.events, "foe")).toHaveLength(0);
  });
  it("Fire then Ice is Thermal Shock: DEF -15% for the next physical hit only", () => {
    let b = fight("sorcerer");
    b = run(b, { type: "skill" }).state; // Firebolt applies fire
    const t = run(b, item("frost_shard"));
    expect(hits(t.events, "hero")[0].reaction).toBe("thermal");
    const atk = heroStats(b).atk;
    const next = run(t.state, { type: "attack" });
    expect(hits(next.events, "hero")[0].damage).toBe(physicalBase(atk, 0, Math.floor(8 * 0.85)));
    expect(hits(run(next.state, { type: "attack" }).events, "hero")[0].damage).toBe(physicalBase(atk, 0, 8));
  });
  it("an unused aura expires after the next hero action", () => {
    let b = fight("ranger");
    b = run(b, item("water_flask")).state;
    b = run(b, { type: "attack" }).state;
    expect(b.foe.aura).toBeNull();
    expect(hits(run(b, item("storm_vial")).events, "hero")[0].reaction).toBeUndefined();
  });
  it("a boss is immune to a second Freeze for two of its own actions", () => {
    const s = heroStats({ classId: "ranger", talentId: "tough_skin", level: 1 });
    let b = startBattle({ classId: "ranger", talentId: "tough_skin", hp: s.maxHp, mp: s.maxMp }, { ...STARTING_ITEMS, potion: 0, water_flask: 9, frost_shard: 9, storm_vial: 0 }, "boss", "ancient_guardian");
    b = run(b, item("water_flask")).state;
    b = run(b, item("frost_shard")).state;
    expect(b.foe.freezeImmune).toBe(2);
    b = run(b, item("water_flask")).state;
    expect(hits(run(b, item("frost_shard")).events, "hero")[0].reaction).toBe("freeze_immune");
  });
});

describe("talent effects (§7)", () => {
  it("Hunter's Mark: +20% below 50% target HP (pre-hit), -4% otherwise", () => {
    const b = fight("ranger", "hunters_mark");
    const base = physicalBase(heroStats(b).atk, 0, 8);
    expect(act(with_(b, {}, { hp: 28 }), "h", { type: "attack" }).events[0]).toMatchObject({ damage: damage(base, 1.2) });
    expect(act(b, "h2", { type: "attack" }).events[0]).toMatchObject({ damage: damage(base, 0.96) });
  });
  it("Guardian Spirit and Undying Resolve change incoming damage", () => {
    const g = fight("ranger", "guardian_spirit");
    expect(hits(run(g, { type: "defend" }).events, "foe")[0].damage).toBe(damage(physicalBase(13, 4, heroStats(g).def), 0.5, 0.85));
    const u = fight("knight", "undying_resolve");
    const bite = physicalBase(13, 4, heroStats(u).def);
    expect(hits(run(u, { type: "defend" }).events, "foe")[0].damage).toBe(damage(bite, 0.5, 1.05));
    expect(hits(run(with_(u, { hp: 20 }), { type: "defend" }).events, "foe")[0].damage).toBe(damage(bite, 0.5, 0.65));
  });
  it("Blood Hunter heals 20% of HP actually removed", () => {
    const b = with_(fight("berserk", "blood_hunter"), { hp: 50 }, { hp: 10 });
    const r = act(b, "bh", { type: "attack" });
    expect(r.events[0]).toMatchObject({ damage: 10 }); // capped at the HP it had
    expect(r.events[1]).toMatchObject({ type: "heal", amount: 2 });
  });
  it("Phoenix Soul revives at 50% MaxHP once per encounter", () => {
    const b = with_(fight("sorcerer", "phoenix_soul"), { hp: 1 });
    const r = run(b, { type: "defend" });
    expect(r.events.find((e) => e.type === "revive")).toMatchObject({ hp: Math.floor(heroStats(b).maxHp / 2) });
    expect(r.state.over).toBeNull();
    expect(run(with_(r.state, { hp: 1 }), { type: "defend" }).state.over).toBe("lose");
  });
  it("Time Weaver: an extra opening action and skill MP ×1.10 rounded up", () => {
    const b = fight("knight", "time_weaver");
    const first = act(b, "tw1", { type: "attack" });
    expect(first.state.queue[0]).toBe("bonus");
    expect(hits(first.events, "foe")).toHaveLength(0);
    expect(skillCost(fight("berserk", "time_weaver"))).toBe(11); // 10 × 1.10, not 12 from float error
    expect(skillCost(fight("knight", "divine_chosen"))).toBe(Math.ceil((8 * 110) / 100));
    expect(Math.ceil((12 * 110) / 100)).toBe(14); // COMBAT_SPEC table
  });
  it("Mana Flow and Vital Surge apply at each normal turn start", () => {
    const m = with_(fight("ranger", "mana_flow"), { mp: 0 });
    const r = run(m, { type: "defend" });
    expect(r.events.find((e) => e.type === "mp")).toMatchObject({ amount: 5, mp: 5 });
    const v = with_(fight("ranger", "vital_surge"), { hp: 50 });
    const max = heroStats(v).maxHp;
    expect(run(v, { type: "defend" }).events.find((e) => e.type === "heal")).toMatchObject({ amount: Math.floor(max / 20) });
  });
});
