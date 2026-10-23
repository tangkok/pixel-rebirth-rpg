import { describe, it, expect } from "vitest";
import {
  activeFighter,
  allocate,
  awardVictory,
  beginBattle,
  buyPotions,
  canAct,
  damageAmount,
  enemyAction,
  freshTactics,
  living,
  performAction,
  pointsLeft,
  readTactics,
  requiredXp,
  respec,
  stats,
  switchClass,
  upgradeWeapon,
  type Battle,
  type Fighter,
} from "../src/game/tactics";
function turn(b: Battle, id: string) {
  b.cursor = b.queue.indexOf(id);
}
const hero = (b: Battle, id = "ash") => b.actors.find((a) => a.id === id)!;

describe("character builds", () => {
  it("creates three different playable jobs with distinct turn speeds", () => {
    const s = freshTactics(),
      b = beginBattle(s);
    expect(living(b, "party")).toHaveLength(3);
    expect(activeFighter(b)?.id).toBe("kael");
    expect(new Set(s.builds.map((b) => b.classId)).size).toBe(3);
  });
  it("spends only available points and changes actual combat stats", () => {
    const s = freshTactics(),
      before = stats(s.builds[0], 1);
    for (let i = 0; i < 3; i++) expect(allocate(s, "ash", "might")).toBe(true);
    expect(allocate(s, "ash", "might")).toBe(false);
    expect(pointsLeft(s, s.builds[0])).toBe(0);
    expect(stats(s.builds[0], 1).attack).toBe(before.attack + 12);
    expect(beginBattle(s).actors[0].attack).toBe(before.attack + 12);
  });
  it("refunds talent points without changing gold", () => {
    const s = freshTactics();
    allocate(s, "ash", "spirit");
    expect(respec(s, "ash")).toBe(true);
    expect(pointsLeft(s, s.builds[0])).toBe(3);
    expect(s.gold).toBe(150);
  });
  it("keeps a purchased weapon upgrade when changing job", () => {
    const s = freshTactics();
    expect(upgradeWeapon(s, "ash")).toBe(true);
    expect(s.gold).toBe(50);
    expect(switchClass(s, "ash", "arcanist")).toBe(true);
    expect(s.builds[0].upgraded).toBe(true);
    expect(stats(s.builds[0], 1).magic).toBe(47);
    expect(upgradeWeapon(s, "ash")).toBe(false);
  });
  it("does not purchase items without sufficient gold", () => {
    const s = freshTactics();
    s.gold = 24;
    expect(buyPotions(s)).toBe(false);
    expect(upgradeWeapon(s, "ash")).toBe(false);
    expect(s.gold).toBe(24);
    expect(s.potions).toBe(5);
  });
  it("buys one potion and enforces the inventory limit", () => {
    const s = freshTactics();
    expect(buyPotions(s)).toBe(true);
    expect(s.potions).toBe(6);
    expect(s.gold).toBe(125);
    s.potions = 99;
    expect(buyPotions(s)).toBe(false);
  });
  it("rejects nonexistent characters and invalid class identifiers", () => {
    const s = freshTactics();
    expect(allocate(s, "nobody", "might")).toBe(false);
    expect(switchClass(s, "ash", "__proto__" as any)).toBe(false);
  });
});

describe("turn-based combat", () => {
  it("waits indefinitely for a player command", () => {
    const b = beginBattle(freshTactics());
    expect(b.cursor).toBe(0);
    expect(b.round).toBe(1);
    expect(b.actors.every((a) => a.hp === a.maxHp)).toBe(true);
  });
  it("applies an attack once and advances exactly one living turn", () => {
    const b = beginBattle(freshTactics()),
      target = hero(b, "sentinel");
    const hp = target.hp;
    const events = performAction(b, "attack", "sentinel");
    expect(events).toHaveLength(1);
    expect(target.hp).toBeLessThan(hp);
    expect(b.cursor).toBe(1);
    expect(activeFighter(b)?.id).toBe("lyra");
  });
  it("defending reduces damage by 55% and builds BP", () => {
    const b = beginBattle(freshTactics());
    turn(b, "ash");
    const a = hero(b),
      e = hero(b, "sentinel"),
      plain = damageAmount(e, a);
    a.bp = 1;
    performAction(b, "guard");
    expect(a.guarding).toBe(true);
    expect(a.bp).toBe(3);
    expect(damageAmount(e, a)).toBeLessThan(plain * 0.55);
  });
  it("wardens break armor with Sunbreak", () => {
    const b = beginBattle(freshTactics());
    turn(b, "ash");
    const e = hero(b, "sentinel"),
      a = hero(b);
    const before = damageAmount(a, e);
    performAction(b, "skill", "sentinel");
    expect(e.broken).toBe(3);
    expect(damageAmount(a, e)).toBeGreaterThan(before);
    expect(a.mp).toBe(30);
  });
  it("arcanists damage every living enemy and spend MP once", () => {
    const b = beginBattle(freshTactics());
    turn(b, "lyra");
    const a = hero(b, "lyra"),
      mp = a.mp;
    const events = performAction(b, "skill", "sentinel");
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.element === "arcanist")).toBe(true);
    expect(living(b, "enemy").every((e) => e.hp < e.maxHp)).toBe(true);
    expect(a.mp).toBe(mp - 18);
  });
  it("rangers bypass armor on their skill", () => {
    const b = beginBattle(freshTactics()),
      a = hero(b, "kael"),
      e = hero(b, "sentinel");
    const expected = damageAmount(a, e, 1.8, false, true);
    expect(performAction(b, "skill", "sentinel")[0].amount).toBe(expected);
  });
  it("refuses unaffordable skills without advancing or spending resources", () => {
    const b = beginBattle(freshTactics());
    hero(b, "kael").mp = 0;
    const before = JSON.stringify(b);
    expect(canAct(b, "skill")).not.toBeNull();
    expect(performAction(b, "skill")).toEqual([]);
    expect(JSON.stringify(b)).toBe(before);
  });
  it("boost increases damage and spends two BP before the normal gain", () => {
    const a = beginBattle(freshTactics()),
      b = beginBattle(freshTactics());
    const plain = performAction(a, "attack", "sentinel")[0].amount;
    const boosted = performAction(b, "attack", "sentinel", true)[0].amount;
    expect(boosted).toBeGreaterThan(plain * 1.5);
    expect(hero(b, "kael").bp).toBe(1);
  });
  it("rejects boost when BP is insufficient", () => {
    const b = beginBattle(freshTactics());
    hero(b, "kael").bp = 1;
    expect(performAction(b, "attack", "sentinel", true)).toEqual([]);
    expect(b.cursor).toBe(0);
  });
  it("does not consume a potion on a full-health party", () => {
    const b = beginBattle(freshTactics());
    expect(performAction(b, "item")).toEqual([]);
    expect(b.potions).toBe(5);
    expect(b.cursor).toBe(0);
  });
  it("heals and revives the most injured party member without exceeding max HP", () => {
    const b = beginBattle(freshTactics());
    const a = hero(b, "lyra");
    a.hp = 0;
    const events = performAction(b, "item");
    expect(events[0].target).toBe("lyra");
    expect(a.hp).toBe(90);
    expect(b.potions).toBe(4);
  });
  it("fails to use an empty potion inventory", () => {
    const b = beginBattle(freshTactics());
    b.potions = 0;
    hero(b).hp = 1;
    expect(performAction(b, "item")).toEqual([]);
    expect(b.cursor).toBe(0);
  });
  it("restoration costs MP and restores an ally", () => {
    const b = beginBattle(freshTactics());
    hero(b).hp = 1;
    const a = hero(b, "kael"),
      mp = a.mp;
    const events = performAction(b, "restore");
    expect(events[0].type).toBe("heal");
    expect(hero(b).hp).toBeGreaterThan(1);
    expect(a.mp).toBe(mp - 16);
  });
  it("enemy AI chooses a living party member and advances", () => {
    const b = beginBattle(freshTactics());
    turn(b, "wisp");
    hero(b, "lyra").hp = 0;
    const e = enemyAction(b);
    expect(e).toHaveLength(1);
    expect(e[0].target).not.toBe("lyra");
    expect(hero(b, e[0].target).hp).toBeLessThan(hero(b, e[0].target).maxHp);
  });
  it("skips defeated fighters and increments rounds after the queue wraps", () => {
    const b = beginBattle(freshTactics());
    hero(b, "lyra").hp = 0;
    performAction(b, "attack", "sentinel");
    expect(activeFighter(b)?.id).toBe("wisp");
    turn(b, b.queue.at(-1)!);
    performAction(b, "attack", "ash");
    expect(b.round).toBe(2);
    expect(activeFighter(b)?.id).toBe("kael");
  });
  it("finishes in victory when the final enemy falls", () => {
    const b = beginBattle(freshTactics());
    b.actors
      .filter((a) => a.side === "enemy")
      .forEach((a) => (a.hp = a.id === "sentinel" ? 1 : 0));
    performAction(b, "attack", "sentinel");
    expect(b.phase).toBe("victory");
    expect(performAction(b, "attack")).toEqual([]);
  });
  it("finishes in defeat when the last hero falls", () => {
    const b = beginBattle(freshTactics());
    b.actors
      .filter((a) => a.side === "party")
      .forEach((a) => (a.hp = a.id === "ash" ? 1 : 0));
    turn(b, "sentinel");
    enemyAction(b);
    expect(b.phase).toBe("defeat");
    expect(living(b, "party")).toHaveLength(0);
  });
  it("cannot start a locked chapter", () => {
    const s = freshTactics();
    expect(beginBattle(s, 2).stage).toBe(0);
    expect(beginBattle(s, -1).stage).toBe(0);
  });
});

describe("rewards and campaign persistence", () => {
  it("claims victory rewards only once and unlocks the next chapter", () => {
    const s = freshTactics(),
      b = beginBattle(s);
    b.phase = "victory";
    expect(awardVictory(s, b)?.gold).toBe(60);
    expect(s.gold).toBe(210);
    expect(s.unlocked).toBe(1);
    expect(s.cleared).toEqual([0]);
    expect(awardVictory(s, b)).toBeNull();
    expect(s.gold).toBe(210);
  });
  it("does not reward an unfinished fight", () => {
    const s = freshTactics();
    expect(awardVictory(s, beginBattle(s))).toBeNull();
    expect(s.gold).toBe(150);
  });
  it("levels up with XP carry and grants new build points", () => {
    const s = freshTactics();
    s.xp = 100;
    const b = beginBattle(s);
    b.phase = "victory";
    expect(awardVictory(s, b)?.leveled).toBe(true);
    expect(s.level).toBe(2);
    expect(s.xp).toBe(55);
    expect(pointsLeft(s, s.builds[0])).toBe(5);
    expect(s.xp).toBeLessThan(requiredXp(s));
  });
  it("round-trips character builds, inventory and unlocked chapters", () => {
    const s = freshTactics();
    allocate(s, "ash", "vitality");
    upgradeWeapon(s, "lyra");
    s.unlocked = 2;
    s.cleared = [0, 1];
    expect(readTactics(JSON.stringify(s))).toEqual(s);
  });
  it("credits legacy gold without changing the old save format", () => {
    const legacy = JSON.stringify({ version: 1, gold: 75 });
    const s = readTactics(null, legacy);
    expect(s.gold).toBe(225);
    expect(readTactics(JSON.stringify(s), legacy).gold).toBe(225);
  });
  it.each([
    null,
    "oops",
    "null",
    "{}",
    JSON.stringify({ ...freshTactics(), level: -1 }),
    JSON.stringify({ ...freshTactics(), potions: 100 }),
    JSON.stringify({ ...freshTactics(), unlocked: 3 }),
    JSON.stringify({ ...freshTactics(), xp: 999 }),
    JSON.stringify({ ...freshTactics(), builds: [] }),
  ])("recovers from an invalid save: %s", (raw) => {
    expect(readTactics(raw)).toEqual(freshTactics());
  });
  it("rejects forged talent budgets and prototype job identifiers", () => {
    const s = freshTactics();
    s.builds[0].talents.might = 999;
    expect(readTactics(JSON.stringify(s))).toEqual(freshTactics());
    s.builds[0].talents.might = 0;
    s.builds[0].classId = "__proto__" as any;
    expect(readTactics(JSON.stringify(s))).toEqual(freshTactics());
  });
  it("a normally equipped first-chapter party can win through real turns", () => {
    const s = freshTactics();
    for (const build of s.builds) {
      for (let i = 0; i < 3; i++)
        allocate(
          s,
          build.id,
          build.classId === "arcanist" ? "spirit" : "might",
        );
    }
    const b = beginBattle(s);
    let actions = 0;
    while (b.phase === "ready" && actions++ < 150) {
      const a = activeFighter(b)!;
      if (a.side === "enemy") enemyAction(b);
      else if (canAct(b, "skill") === null)
        performAction(b, "skill", living(b, "enemy")[0].id, a.bp >= 2);
      else performAction(b, "attack", living(b, "enemy")[0].id, a.bp >= 2);
    }
    expect(b.phase).toBe("victory");
    expect(actions).toBeLessThan(100);
  });
});

describe("complete three-chapter campaign", () => {
  it("allows a built party to defeat the Eclipse Sovereign through the normal economy and rules", () => {
    const s = freshTactics();
    for (let stage = 0; stage < 3; stage++) {
      for (const build of s.builds)
        while (pointsLeft(s, build) > 0)
          allocate(
            s,
            build.id,
            build.classId === "arcanist" ? "spirit" : "might",
          );
      for (const id of ["lyra", "ash", "kael"]) upgradeWeapon(s, id);
      const b = beginBattle(s, stage);
      let turns = 0;
      while (b.phase === "ready" && turns++ < 180) {
        const a = activeFighter(b)!;
        if (a.side === "enemy") {
          enemyAction(b);
          continue;
        }
        const wounded = b.actors
          .filter((x) => x.side === "party")
          .sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
        if (wounded.hp / wounded.maxHp < 0.35 && canAct(b, "item") === null) {
          performAction(b, "item");
          continue;
        }
        if (
          wounded.hp / wounded.maxHp < 0.45 &&
          canAct(b, "restore") === null
        ) {
          performAction(b, "restore");
          continue;
        }
        const target = living(b, "enemy").sort((x, y) => x.hp - y.hp)[0];
        performAction(
          b,
          canAct(b, "skill") === null ? "skill" : "attack",
          target.id,
          a.bp >= 2,
        );
      }
      expect(b.phase, `chapter ${stage + 1}, round ${b.round}`).toBe("victory");
      expect(awardVictory(s, b)).not.toBeNull();
    }
    expect(s.cleared).toEqual([0, 1, 2]);
    expect(s.level).toBeGreaterThan(1);
  });
});
