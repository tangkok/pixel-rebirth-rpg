import { describe, expect, it } from "vitest";
import { CLASS_IDS, RARITY_ODDS, TALENTS } from "../src/astra/data";
import { checkName, describeTalent, effectiveStats, rollTalent } from "../src/astra/hero";
import {
  BACKUP_KEY,
  loadSave,
  newSave,
  parseSave,
  SAVE_KEY,
  writeSave,
} from "../src/astra/save";

const seq = (...xs: number[]) => () => xs.shift()!;
const memStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("character name", () => {
  it("accepts Thai and trims whitespace", () => {
    expect(checkName("  สวย  ")).toEqual({ ok: true, name: "สวย" });
  });
  it("counts Thai combining marks as one character", () => {
    expect(checkName("กิ่ง".repeat(4)).ok).toBe(true); // 16 graphemes, more code points
    expect(checkName("ก".repeat(17)).ok).toBe(false);
  });
  it("rejects empty, control and bidi-override names", () => {
    expect(checkName("   ").ok).toBe(false);
    expect(checkName("a\u0000b").ok).toBe(false);
    expect(checkName("a‮b").ok).toBe(false);
    expect(checkName(42).ok).toBe(false);
  });
});

describe("talent awakening", () => {
  it("has 20 talents in the documented tier sizes, each with a drawback", () => {
    expect(TALENTS).toHaveLength(20);
    const sizes = { common: 5, uncommon: 4, rare: 4, epic: 3, legendary: 3, mythic: 1 };
    for (const [r, n] of Object.entries(sizes))
      expect(TALENTS.filter((t) => t.rarity === r)).toHaveLength(n);
    for (const t of TALENTS) {
      const d = describeTalent(t);
      expect(d.plus.length, t.id).toBeGreaterThan(0);
      expect(d.minus.length, t.id).toBeGreaterThan(0);
    }
    expect(RARITY_ODDS.reduce((a, o) => a + o.per1000, 0)).toBe(1000);
  });
  it("maps roll boundaries to the right rarity", () => {
    const at = (r: number) => rollTalent(seq(r, 0)).rarity;
    expect(at(0)).toBe("common");
    expect(at(0.5999)).toBe("common");
    expect(at(0.6)).toBe("uncommon");
    expect(at(0.8499)).toBe("uncommon");
    expect(at(0.85)).toBe("rare");
    expect(at(0.95)).toBe("epic");
    expect(at(0.99)).toBe("legendary");
    expect(at(0.998)).toBe("legendary");
    expect(at(0.999)).toBe("mythic");
    expect(at(0.9999999)).toBe("mythic");
  });
  it("picks uniformly within a tier", () => {
    expect(rollTalent(seq(0, 0)).id).toBe("tough_skin");
    expect(rollTalent(seq(0, 0.9999)).id).toBe("swift_feet");
  });
});

describe("effective stats", () => {
  it("applies Swift Feet as in COMBAT_SPEC (SPD 18 × 1.08 = 19)", () => {
    expect(effectiveStats("ranger", "swift_feet").spd).toBe(19);
    expect(effectiveStats("ranger", "swift_feet").maxHp).toBe(106); // 110 × 0.97 floored
  });
  it("applies Divine Chosen to every core stat once", () => {
    const s = effectiveStats("knight", "divine_chosen");
    expect(s).toEqual({ maxHp: 200, maxMp: 37, atk: 17, def: 20, mag: 3, res: 15, spd: 10 });
  });
  it("leaves stats unchanged for non-stat talents", () => {
    expect(effectiveStats("cleric", "guardian_spirit")).toEqual(effectiveStats("cleric"));
  });
});

describe("save", () => {
  const good = () => newSave("สวย", "female", "ranger", "hunters_mark");

  it("round-trips every class", () => {
    for (const c of CLASS_IDS) {
      const s = newSave("Hero", "male", c, "tough_skin");
      expect(parseSave(JSON.stringify(s))).toEqual(s);
    }
  });
  it("starts at full HP/MP with the chosen talent id", () => {
    const s = good();
    expect(s.hero.talentId).toBe("hunters_mark");
    expect(s.hero.hp).toBe(110);
    expect(s.hero.mp).toBe(40);
  });
  it.each([
    ["bad json", "{"],
    ["old version", JSON.stringify({ ...good(), version: 0 })],
    ["unknown class", JSON.stringify({ ...good(), hero: { ...good().hero, classId: "ninja" } })],
    ["unknown talent", JSON.stringify({ ...good(), hero: { ...good().hero, talentId: "god_mode" } })],
    ["hp over max", JSON.stringify({ ...good(), hero: { ...good().hero, hp: 9999 } })],
    ["negative item", JSON.stringify({ ...good(), items: { ...good().items, potion: -1 } })],
    ["unknown item", JSON.stringify({ ...good(), items: { ...good().items, elixir: 1 } })],
    ["unsafe name", JSON.stringify({ ...good(), hero: { ...good().hero, name: "x‮" } })],
    ["party array", JSON.stringify({ ...good(), hero: [good().hero] })],
  ])("rejects %s", (_, raw) => {
    expect(parseSave(raw)).toBeNull();
  });
  it("keeps the previous save as backup and falls back to it", () => {
    const st = memStore();
    const first = good();
    expect(writeSave(st, first)).toBe(true);
    const second = newSave("Other", "male", "knight", "tough_skin");
    expect(writeSave(st, second)).toBe(true);
    expect(parseSave(st.getItem(BACKUP_KEY))?.hero.name).toBe("สวย");
    st.setItem(SAVE_KEY, "corrupt");
    expect(loadSave(st)?.hero.name).toBe("สวย");
  });
  it("refuses to write invalid data", () => {
    const st = memStore();
    const bad = { ...good(), hero: { ...good().hero, level: 99 } };
    expect(writeSave(st, bad)).toBe(false);
    expect(st.getItem(SAVE_KEY)).toBeNull();
  });
});
