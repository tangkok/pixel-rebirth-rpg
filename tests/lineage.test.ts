import { describe, it, expect } from "vitest";
import {
  CLASS_IDS,
  CLASSES,
  RACES,
  RARITIES,
  RACE_TOTAL_WEIGHT,
  sampleRace,
  subclassBonus,
} from "../src/game/lineage";
import {
  freshTactics,
  createCharacter,
  rollRace,
  readTactics,
  stats,
  beginBattle,
  performAction,
  activeFighter,
  canAct,
  switchClass,
  switchSubclass,
  upgradeSkill,
  skillPointsLeft,
} from "../src/game/tactics";
const enemy = (b: ReturnType<typeof beginBattle>) =>
  b.actors.find((a) => a.side === "enemy")!;
const player = (b: ReturnType<typeof beginBattle>) =>
  b.actors.find((a) => a.side === "party")!;
describe("character creation and fair lineage sampling", () => {
  it("requires a rolled race, creates exactly once, and preserves the chosen identity", () => {
    const s = freshTactics();
    expect(s.created).toBe(false);
    expect(createCharacter(s, "ดาว", "assassin")).toBe(false);
    rollRace(s, () => 0.999);
    expect(createCharacter(s, "นักเดินทางแห่งดาว", "assassin")).toBe(true);
    expect(s.builds).toHaveLength(1);
    expect(s.builds[0].raceId).toBe("primordial");
    expect(s.builds[0].name).toBe("นักเดินทางแห่งดาว");
    expect(createCharacter(s, "ใหม่", "ranger")).toBe(false);
    expect(readTactics(JSON.stringify(s))).toEqual(s);
  });
  it("declares 15 distinct races, six tiers, and exactly 100% total chance", () => {
    expect(RACES).toHaveLength(15);
    expect(new Set(RACES.map((r) => r.id)).size).toBe(15);
    expect(Object.keys(RARITIES)).toHaveLength(6);
    expect(RACE_TOTAL_WEIGHT).toBe(100);
    expect(
      RACES.filter((r) => r.rarity === "common").reduce(
        (t, r) => t + r.weight,
        0,
      ),
    ).toBe(55);
    expect(
      RACES.filter((r) => r.rarity === "mythic").reduce(
        (t, r) => t + r.weight,
        0,
      ),
    ).toBe(0.5);
  });
  it.each(RACES.map((r, i) => [r.id, i] as const))(
    "can sample %s within its declared probability interval",
    (id, i) => {
      const start = RACES.slice(0, i).reduce((n, r) => n + r.weight, 0);
      expect(sampleRace(() => (start + RACES[i].weight / 2) / 100).id).toBe(id);
    },
  );
  it("handles probability extremes and assigns only 0.5% to the highest tier", () => {
    expect(sampleRace(() => 0).id).toBe("human");
    expect(sampleRace(() => 1).id).toBe("primordial");
    expect(sampleRace(() => 0.99499).id).toBe("voidborn");
    expect(sampleRace(() => 0.99501).id).toBe("primordial");
  });
  it("uses three free rolls, then only affordable disclosed gold, without resetting progress", () => {
    const s = freshTactics();
    s.level = 3;
    s.xp = 12;
    s.builds[0].talents.might = 2;
    for (let i = 0; i < 3; i++) expect(rollRace(s, () => 0.3)).not.toBeNull();
    expect(s.gold).toBe(150);
    expect(s.raceRolls).toBe(0);
    expect(rollRace(s, () => 0.999)?.id).toBe("primordial");
    expect(s.gold).toBe(0);
    expect(rollRace(s)).toBeNull();
    expect(s.builds[0].raceId).toBe("primordial");
    expect(s.level).toBe(3);
    expect(s.xp).toBe(12);
    expect(s.builds[0].talents.might).toBe(2);
    expect(readTactics(JSON.stringify(s))).toEqual(s);
  });
  it.each(RACES)("$id bonuses affect actual combat attributes", (race) => {
    const s = freshTactics(),
      before = stats(s.builds[0], 1);
    s.builds[0].raceId = race.id;
    const after = player(beginBattle(s));
    for (const [key, amount] of Object.entries(race.bonus)) {
      const stat =
        key === "hp"
          ? "maxHp"
          : key === "mp"
            ? "maxMp"
            : (key as keyof typeof before);
      expect(after[stat]).toBe(Number(before[stat]) + amount);
    }
  });
});
describe("six jobs and useful abilities", () => {
  it.each(CLASS_IDS)(
    "%s spends its own MP, changes enemy HP, and remains a single hero",
    (id) => {
      const s = freshTactics();
      switchClass(s, "ash", id);
      const b = beginBattle(s);
      const a = player(b);
      const mp = a.mp;
      const events = performAction(b, "skill");
      expect(events[0].element).toBe(id);
      expect(enemy(b).hp).toBeLessThan(enemy(b).maxHp);
      expect(a.mp).toBe(mp - CLASSES[id].cost);
      expect(b.actors.filter((a) => a.side === "party")).toHaveLength(1);
    },
  );
  it("Shadow Fang heals a wounded assassin from damage dealt", () => {
    const s = freshTactics();
    switchClass(s, "ash", "assassin");
    const b = beginBattle(s);
    player(b).hp = 60;
    const events = performAction(b, "skill");
    expect(events[1].type).toBe("heal");
    expect(player(b).hp).toBe(60 + Math.round(events[0].amount * 0.25));
  });
  it("Radiant Oath restores health in the same turn as its damage", () => {
    const s = freshTactics();
    switchClass(s, "ash", "paladin");
    const b = beginBattle(s);
    player(b).hp = 60;
    performAction(b, "skill");
    expect(player(b).hp).toBe(95);
  });
  it("Crimson Cleave grows stronger when the berserker is hurt", () => {
    const s = freshTactics();
    switchClass(s, "ash", "berserker");
    const full = beginBattle(s),
      hurt = beginBattle(s);
    player(hurt).hp = 30;
    expect(performAction(hurt, "skill")[0].amount).toBeGreaterThan(
      performAction(full, "skill")[0].amount,
    );
  });
  it("invests only earned ability points and raises actual skill damage", () => {
    const s = freshTactics(),
      base = performAction(beginBattle(s), "skill")[0].amount;
    expect(upgradeSkill(s)).toBe(true);
    expect(skillPointsLeft(s)).toBe(0);
    expect(upgradeSkill(s)).toBe(false);
    expect(performAction(beginBattle(s), "skill")[0].amount).toBeGreaterThan(
      base,
    );
    s.level = 3;
    expect(upgradeSkill(s)).toBe(true);
    expect(s.builds[0].skillRank).toBe(2);
    s.level = 9;
    while (upgradeSkill(s)) {}
    expect(s.builds[0].skillRank).toBe(5);
    expect(skillPointsLeft(s)).toBe(0);
  });
});
describe("secondary disciplines and migration", () => {
  it("gates a second discipline by level and rejects the main job", () => {
    const s = freshTactics();
    expect(switchSubclass(s, "ranger")).toBe(false);
    s.level = 2;
    expect(switchSubclass(s, "warden")).toBe(false);
    expect(switchSubclass(s, "arcanist")).toBe(true);
    const a = player(beginBattle(s)),
      base = stats({ ...s.builds[0], subClassId: null }, 2),
      bonus = subclassBonus("arcanist");
    expect(a.maxHp - base.maxHp).toBe(bonus.hp);
    expect(a.magic - base.magic).toBe(bonus.magic);
    expect(switchSubclass(s, "assassin")).toBe(true);
    expect(switchSubclass(s, null)).toBe(true);
  });
  it("casts a secondary skill using its own MP and effect at 80% power", () => {
    const s = freshTactics();
    s.level = 2;
    switchSubclass(s, "arcanist");
    const b = beginBattle(s),
      mp = player(b).mp;
    const e = performAction(b, "secondary");
    expect(e[0].element).toBe("arcanist");
    expect(player(b).mp).toBe(mp - 18);
    const expected = Math.round(
      player(b).magic * 1.8 * 0.8 - enemy(b).defense * 0.6,
    );
    expect(e[0].amount).toBe(expected);
    const other = beginBattle(freshTactics());
    expect(canAct(other, "secondary")).toContain("อาชีพเสริม");
  });
  it("rejects secondary casts without enough MP, preserving the turn and HP", () => {
    const s = freshTactics();
    s.level = 2;
    switchSubclass(s, "arcanist");
    const b = beginBattle(s);
    player(b).mp = 0;
    const turn = activeFighter(b)?.id;
    expect(performAction(b, "secondary")).toEqual([]);
    expect(activeFighter(b)?.id).toBe(turn);
    expect(enemy(b).hp).toBe(155);
  });
  it("clears a matching secondary on main-class change and preserves race/mastery", () => {
    const s = freshTactics();
    rollRace(s, () => 0.999);
    s.level = 3;
    switchSubclass(s, "arcanist");
    upgradeSkill(s);
    switchClass(s, "ash", "arcanist");
    expect(s.builds[0].subClassId).toBeNull();
    expect(s.builds[0].raceId).toBe("primordial");
    expect(s.builds[0].skillRank).toBe(1);
  });
  it("migrates v3 progression without forcing an old player to recreate a hero", () => {
    const old: any = freshTactics();
    old.version = 3;
    old.level = 4;
    old.xp = 60;
    old.gold = 225;
    old.unlocked = 2;
    old.cleared = [0, 1];
    old.builds[0].name = "Ash";
    old.builds[0].classId = "ranger";
    old.builds[0].talents.might = 4;
    delete old.created;
    delete old.raceRolls;
    delete old.builds[0].raceId;
    delete old.builds[0].subClassId;
    delete old.builds[0].skillRank;
    const s = readTactics(JSON.stringify(old));
    expect(s.version).toBe(4);
    expect(s.created).toBe(true);
    expect(s.gold).toBe(225);
    expect(s.xp).toBe(60);
    expect(s.builds[0].name).toBe("Ash");
    expect(s.builds[0].raceId).toBe("human");
    expect(s.builds[0].talents.might).toBe(4);
    expect(s.raceRolls).toBe(3);
  });
  it.each(["race", "subclass", "rank", "rolls"])(
    "rejects invalid %s data instead of applying arbitrary bonuses",
    (field) => {
      const s = freshTactics();
      if (field === "race") s.builds[0].raceId = "__proto__" as any;
      if (field === "subclass") s.builds[0].subClassId = "arcanist";
      if (field === "rank") s.builds[0].skillRank = 5;
      if (field === "rolls") s.raceRolls = -1;
      expect(readTactics(JSON.stringify(s))).toEqual(freshTactics());
    },
  );
});
