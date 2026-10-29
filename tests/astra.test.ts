import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { CLASS_IDS, RARITY_ODDS, TALENTS } from "../src/astra/data";
import {
  defaultLook,
  FACES,
  HAIR_COLORS,
  HAIR_STYLES,
  layers,
  OUTFIT_COLORS,
  OUTFITS,
  parseLook,
  SKINS,
  WEAPONS,
} from "../src/astra/looks";
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
  const good = () => newSave("สวย", "female", "ranger", "hunters_mark", defaultLook("female", "ranger"));

  it("round-trips every class", () => {
    for (const c of CLASS_IDS) {
      const s = newSave("Hero", "male", c, "tough_skin", defaultLook("male", c));
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
    ["missing look", JSON.stringify({ ...good(), hero: { ...good().hero, look: undefined } })],
    ["male hair on female hero", JSON.stringify({ ...good(), hero: { ...good().hero, look: { ...good().hero.look, hair: "m1" } } })],
    ["path in weapon id", JSON.stringify({ ...good(), hero: { ...good().hero, look: { ...good().hero.look, weapon: "../x" } } })],
  ])("rejects %s", (_, raw) => {
    expect(parseSave(raw)).toBeNull();
  });
  it("keeps the previous save as backup and falls back to it", () => {
    const st = memStore();
    const first = good();
    expect(writeSave(st, first)).toBe(true);
    const second = newSave("Other", "male", "knight", "tough_skin", defaultLook("male", "knight"));
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

describe("Heroes99 looks", () => {
  it("every catalogued layer exists in public/astra/h99", () => {
    const files = new Set<string>();
    for (const g of ["male", "female"] as const)
      for (const hair of HAIR_STYLES[g])
        for (const hairColor of HAIR_COLORS)
          for (const outfit of OUTFITS)
            for (const outfitColor of OUTFIT_COLORS)
              if (outfit === 1 || hairColor === 1) // full cross product is 30k looks; this still touches every file
                for (const weapon of WEAPONS)
                  for (const f of layers({ skin: 1, face: 1, hair, hairColor, outfit, outfitColor, weapon })) files.add(f);
    for (const skin of SKINS) for (const face of FACES)
      for (const f of layers({ ...defaultLook("male", "knight"), skin, face })) files.add(f);
    expect(files.size).toBe(761);
    for (const f of files) expect(existsSync(`public/astra/${f}`), f).toBe(true);
  });
  it("class defaults follow the GDD weapon contract where Heroes99 has the weapon", () => {
    expect(defaultLook("male", "knight").weapon).toBe("weapon1"); // sword
    expect(defaultLook("male", "berserk").weapon).toBe("weapon2"); // axe
    expect(defaultLook("male", "sorcerer").weapon).toBe("weapon5_c1"); // wand as staff
    expect(defaultLook("female", "ranger").weapon).toBe("none"); // no bow in Heroes99
    expect(defaultLook("female", "cleric").weapon).toBe("none"); // no mace in Heroes99
  });
  it("draws layers bottom to top per layer.gif", () => {
    expect(layers(defaultLook("female", "knight"))).toEqual([
      "h99/weapon/weapon1_bot.png",
      "h99/skin/skin_c1.png",
      "h99/face/face_c1.png",
      "h99/hair/f1_c1_bot.png",
      "h99/cloth/cloth13_c8_bot.png",
      "h99/hair/f1_c1_top.png",
      "h99/cloth/cloth13_c8_top.png",
      "h99/weapon/weapon1_top.png",
    ]);
  });
  it("rejects looks that do not match the hero's gender", () => {
    expect(parseLook(defaultLook("male", "knight"), "female")).toBeNull();
    expect(parseLook(defaultLook("female", "knight"), "female")).not.toBeNull();
  });
});
