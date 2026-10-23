import { describe, it, expect } from "vitest";
import {
  activeFighter,
  allocate,
  awardVictory,
  beginBattle,
  buyPotions,
  canAct,
  cleanName,
  damageAmount,
  enemyAction,
  freshTactics,
  living,
  performAction,
  pointsLeft,
  readTactics,
  renameHero,
  requiredXp,
  respec,
  stats,
  switchClass,
  upgradeWeapon,
  type Battle,
  type ClassId,
} from "../src/game/tactics";
import { renderSize } from "../src/game/display";
const hero = (b: Battle) => b.actors.find((a) => a.side === "party")!;
const enemy = (b: Battle) => b.actors.find((a) => a.side === "enemy")!;
function playerTurn(b: Battle) {
  b.cursor = b.queue.indexOf(hero(b).id);
}

describe("one personal character", () => {
  it("starts with exactly one own character and one opponent", () => {
    const s = freshTactics(),
      b = beginBattle(s);
    expect(s.builds).toHaveLength(1);
    expect(living(b, "party")).toHaveLength(1);
    expect(living(b, "enemy")).toHaveLength(1);
    expect(activeFighter(b)?.id).toBe("ash");
  });
  it("uses only one hero even if given an extra runtime build", () => {
    const s = freshTactics();
    s.builds.push({ ...s.builds[0], id: "extra" });
    expect(living(beginBattle(s), "party")).toHaveLength(1);
  });
  it("allows a personal Thai name and strips markup safely", () => {
    const s = freshTactics();
    renameHero(s, "ผู้พิทักษ์แห่งดาว");
    expect(hero(beginBattle(s)).name).toBe("ผู้พิทักษ์แห่งดาว");
    expect(cleanName('<img onerror="x">')).not.toMatch(/[<>"&]/);
    expect(cleanName("")).toBe("ผู้เดินทาง");
    expect(cleanName("A".repeat(30))).toHaveLength(20);
  });
  it("changes the same character job without adding teammates", () => {
    const s = freshTactics();
    expect(switchClass(s, "ash", "arcanist")).toBe(true);
    const b = beginBattle(s);
    expect(living(b, "party")).toHaveLength(1);
    expect(hero(b).id).toBe("ash");
    expect(hero(b).classId).toBe("arcanist");
  });
  it("spends only earned points and changes actual battle attributes", () => {
    const s = freshTactics(),
      a = stats(s.builds[0], 1).attack;
    for (let i = 0; i < 3; i++) expect(allocate(s, "ash", "might")).toBe(true);
    expect(allocate(s, "ash", "might")).toBe(false);
    expect(hero(beginBattle(s)).attack).toBe(a + 12);
    expect(pointsLeft(s, s.builds[0])).toBe(0);
  });
  it("refunds points freely and keeps upgrades across jobs", () => {
    const s = freshTactics();
    allocate(s, "ash", "might");
    respec(s, "ash");
    expect(pointsLeft(s, s.builds[0])).toBe(3);
    expect(upgradeWeapon(s, "ash")).toBe(true);
    switchClass(s, "ash", "ranger");
    expect(s.builds[0].upgraded).toBe(true);
    expect(s.gold).toBe(50);
    expect(upgradeWeapon(s, "ash")).toBe(false);
  });
  it("does not buy upgrades or potions without enough currency", () => {
    const s = freshTactics();
    s.gold = 24;
    expect(buyPotions(s)).toBe(false);
    expect(upgradeWeapon(s, "ash")).toBe(false);
    expect(s.gold).toBe(24);
  });
  it("buys exactly one potion and caps stock", () => {
    const s = freshTactics();
    expect(buyPotions(s)).toBe(true);
    expect(s.gold).toBe(125);
    expect(s.potions).toBe(6);
    s.potions = 99;
    expect(buyPotions(s)).toBe(false);
  });
  it("rejects unknown hero and prototype class identifiers", () => {
    const s = freshTactics();
    expect(allocate(s, "lyra", "might")).toBe(false);
    expect(switchClass(s, "ash", "__proto__" as ClassId)).toBe(false);
  });
});

describe("solo turn rules", () => {
  it("waits for commands and then lets the opponent answer", () => {
    const b = beginBattle(freshTactics());
    expect(b.cursor).toBe(0);
    const hp = enemy(b).hp;
    expect(performAction(b, "attack", enemy(b).id)).toHaveLength(1);
    expect(enemy(b).hp).toBeLessThan(hp);
    expect(activeFighter(b)?.side).toBe("enemy");
    enemyAction(b);
    expect(activeFighter(b)?.side).toBe("party");
    expect(b.round).toBe(2);
    expect(hero(b).hp).toBeLessThan(hero(b).maxHp);
  });
  it("guard cuts the incoming hit and ends at your next turn", () => {
    const b = beginBattle(freshTactics()),
      plain = damageAmount(enemy(b), hero(b));
    performAction(b, "guard");
    expect(hero(b).guarding).toBe(true);
    const events = enemyAction(b);
    expect(events[0].amount).toBeLessThan(plain * 0.55);
    expect(hero(b).guarding).toBe(false);
    expect(hero(b).bp).toBe(3);
  });
  it("Sunbreak breaks enemy armor", () => {
    const b = beginBattle(freshTactics()),
      plain = damageAmount(hero(b), enemy(b));
    performAction(b, "skill", enemy(b).id);
    expect(enemy(b).broken).toBe(3);
    expect(damageAmount(hero(b), enemy(b))).toBeGreaterThan(plain);
    expect(hero(b).mp).toBe(54);
  });
  it.each(["arcanist", "ranger"] as ClassId[])(
    "%s can complete a skill with its own MP cost",
    (cls) => {
      const s = freshTactics();
      switchClass(s, "ash", cls);
      const b = beginBattle(s),
        mp = hero(b).mp;
      const events = performAction(b, "skill", enemy(b).id);
      expect(events).toHaveLength(1);
      expect(events[0].amount).toBeGreaterThan(40);
      expect(hero(b).mp).toBe(mp - (cls === "arcanist" ? 18 : 12));
    },
  );
  it("prevents low-MP actions without consuming a turn", () => {
    const b = beginBattle(freshTactics());
    hero(b).mp = 0;
    const before = JSON.stringify(b);
    expect(canAct(b, "skill")).not.toBeNull();
    expect(performAction(b, "skill")).toEqual([]);
    expect(JSON.stringify(b)).toBe(before);
  });
  it("boost spends two BP and raises damage", () => {
    const a = beginBattle(freshTactics()),
      b = beginBattle(freshTactics());
    const d = performAction(a, "attack", enemy(a).id)[0].amount;
    expect(
      performAction(b, "attack", enemy(b).id, true)[0].amount,
    ).toBeGreaterThan(d * 1.5);
    expect(hero(b).bp).toBe(1);
  });
  it("rejects boost without enough BP", () => {
    const b = beginBattle(freshTactics());
    hero(b).bp = 1;
    expect(performAction(b, "attack", enemy(b).id, true)).toEqual([]);
    expect(b.cursor).toBe(0);
  });
  it("does not waste a potion at full HP", () => {
    const b = beginBattle(freshTactics());
    expect(performAction(b, "item")).toEqual([]);
    expect(b.potions).toBe(5);
    expect(b.cursor).toBe(0);
  });
  it("uses a potion on yourself and caps HP", () => {
    const b = beginBattle(freshTactics());
    hero(b).hp = hero(b).maxHp - 20;
    const e = performAction(b, "item");
    expect(e[0].target).toBe(hero(b).id);
    expect(e[0].amount).toBe(20);
    expect(hero(b).hp).toBe(hero(b).maxHp);
    expect(b.potions).toBe(4);
  });
  it("self-healing spends MP and restores health", () => {
    const b = beginBattle(freshTactics());
    hero(b).hp = 5;
    const mp = hero(b).mp;
    const e = performAction(b, "restore");
    expect(e[0].target).toBe("ash");
    expect(hero(b).hp).toBeGreaterThan(90);
    expect(hero(b).mp).toBe(mp - 16);
  });
  it("cannot consume an empty inventory", () => {
    const b = beginBattle(freshTactics());
    b.potions = 0;
    hero(b).hp = 1;
    expect(performAction(b, "item")).toEqual([]);
    expect(hero(b).hp).toBe(1);
  });
  it("awards victory when the opponent falls and defeat when you fall", () => {
    const b = beginBattle(freshTactics());
    enemy(b).hp = 1;
    performAction(b, "attack", enemy(b).id);
    expect(b.phase).toBe("victory");
    const c = beginBattle(freshTactics());
    hero(c).hp = 1;
    c.cursor = c.queue.indexOf(enemy(c).id);
    enemyAction(c);
    expect(c.phase).toBe("defeat");
    expect(performAction(c, "item")).toEqual([]);
  });
  it("cannot enter a locked encounter", () => {
    expect(beginBattle(freshTactics(), 2).stage).toBe(0);
  });
});

describe("progress and migration", () => {
  it("rewards once and unlocks the next chapter", () => {
    const s = freshTactics(),
      b = beginBattle(s);
    b.phase = "victory";
    expect(awardVictory(s, b)?.gold).toBe(60);
    expect(awardVictory(s, b)).toBeNull();
    expect(s.gold).toBe(210);
    expect(s.unlocked).toBe(1);
  });
  it("levels the only character and grants talent points", () => {
    const s = freshTactics();
    s.xp = 100;
    const b = beginBattle(s);
    b.phase = "victory";
    awardVictory(s, b);
    expect(s.level).toBe(2);
    expect(s.xp).toBe(55);
    expect(pointsLeft(s, s.builds[0])).toBe(5);
  });
  it("preserves old party progress and its purchased upgrade in a solo migration", () => {
    const current = freshTactics();
    current.gold = 225;
    current.level = 3;
    current.xp = 20;
    current.unlocked = 2;
    current.cleared = [0, 1];
    const old = {
      ...current,
      version: 2,
      builds: [
        { ...current.builds[0], name: "Ash" },
        {
          ...current.builds[0],
          id: "lyra",
          name: "Lyra",
          classId: "arcanist",
          upgraded: true,
        },
        { ...current.builds[0], id: "kael", name: "Kael", classId: "ranger" },
      ],
    };
    const raw = JSON.stringify(old),
      migrated = readTactics(raw);
    expect(migrated.version).toBe(3);
    expect(migrated.builds).toHaveLength(1);
    expect(migrated.builds[0].upgraded).toBe(true);
    expect(migrated.gold).toBe(225);
    expect(migrated.unlocked).toBe(2);
    expect(JSON.parse(raw).builds).toHaveLength(3);
  });
  it("round-trips a renamed built character", () => {
    const s = freshTactics();
    renameHero(s, "นักดาบดาว");
    allocate(s, "ash", "vitality");
    expect(readTactics(JSON.stringify(s))).toEqual(s);
  });
  it("credits the original action-game gold only at first creation", () => {
    const old = JSON.stringify({ version: 1, gold: 75 }),
      s = readTactics(null, old);
    expect(s.gold).toBe(225);
    expect(readTactics(JSON.stringify(s), old).gold).toBe(225);
  });
  it.each([
    "{}",
    "oops",
    "null",
    JSON.stringify({ ...freshTactics(), level: -1 }),
    JSON.stringify({ ...freshTactics(), potions: 100 }),
    JSON.stringify({ ...freshTactics(), builds: [] }),
  ])("recovers from invalid save %s", (raw) => {
    expect(readTactics(raw)).toEqual(freshTactics());
  });
  it.each(["warden", "arcanist", "ranger"] as ClassId[])(
    "%s can clear the full campaign alone with earned resources",
    (cls) => {
      const s = freshTactics();
      switchClass(s, "ash", cls);
      for (let stage = 0; stage < 3; stage++) {
        while (pointsLeft(s, s.builds[0]) > 0)
          allocate(s, "ash", cls === "arcanist" ? "spirit" : "might");
        upgradeWeapon(s, "ash");
        const b = beginBattle(s, stage);
        let count = 0;
        while (b.phase === "ready" && count++ < 100) {
          if (activeFighter(b)?.side === "enemy") {
            enemyAction(b);
            continue;
          }
          if (hero(b).hp / hero(b).maxHp < 0.4 && canAct(b, "item") === null) {
            performAction(b, "item");
            continue;
          }
          performAction(
            b,
            canAct(b, "skill") === null ? "skill" : "attack",
            enemy(b).id,
            hero(b).bp >= 2,
          );
        }
        expect(b.phase, `${cls} chapter ${stage + 1}`).toBe("victory");
        awardVictory(s, b);
      }
      expect(s.cleared).toEqual([0, 1, 2]);
      expect(s.builds).toHaveLength(1);
    },
  );
});

describe("high-DPI buffers", () => {
  it("renders a retina phone at its true density", () => {
    const s = renderSize(390, 420, 3);
    expect(s.bufferWidth).toBe(1170);
    expect(s.bufferHeight).toBe(1260);
    expect(s.density).toBe(3);
  });
  it("preserves normal desktop sizing and bounds oversized GPU buffers", () => {
    expect(renderSize(1440, 900, 1).bufferWidth).toBe(1440);
    const s = renderSize(2560, 1440, 3);
    expect(s.bufferWidth * s.bufferHeight).toBeLessThan(4_200_000);
    expect(s.density).toBeGreaterThanOrEqual(1);
  });
  it("handles zero-sized elements and invalid device density safely", () => {
    const s = renderSize(0, 0, NaN);
    expect(s.bufferWidth).toBe(1);
    expect(s.bufferHeight).toBe(1);
    expect(s.density).toBe(1);
  });
});
