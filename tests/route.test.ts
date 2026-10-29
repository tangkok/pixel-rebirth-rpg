import { describe, expect, it } from "vitest";
import { heroStats } from "../src/astra/battle";
import { GROWTH } from "../src/astra/data";
import { effectiveStats } from "../src/astra/hero";
import { defaultLook } from "../src/astra/looks";
import { foeStats, judge } from "../src/astra/battle";
import { choices, lootOf, recordVictory, restartRun, ROUTE, ROUTE_START, runSummary, startRun, validPath, visit } from "../src/astra/route";
import { newSave, parseSave, type SaveData } from "../src/astra/save";

const fresh = () => newSave("Hero", "male", "knight", "tough_skin", defaultLook("male", "knight"));
const on = (s: SaveData, path: string[]): SaveData => ({ ...s, progress: { ...s.progress, path } });

describe("route map", () => {
  it("every node is reachable from a start node and every path ends at the boss", () => {
    const seen = new Set<string>();
    const walk = (id: string, depth: number): void => {
      seen.add(id);
      expect(depth).toBeLessThanOrEqual(6);
      if (!ROUTE[id].next.length) expect(ROUTE[id].kind).toBe("boss");
      ROUTE[id].next.forEach((n) => {
        expect(ROUTE[n].row).toBe(ROUTE[id].row + 1);
        walk(n, depth + 1);
      });
    };
    ROUTE_START.forEach((id) => walk(id, 1));
    expect([...seen].sort()).toEqual(Object.keys(ROUTE).sort());
  });
  it("only offers the next nodes of where the hero stands", () => {
    expect(choices(fresh())).toEqual(ROUTE_START);
    expect(choices(on(fresh(), ["r1a"]))).toEqual(["r2a", "r2b"]);
    expect(validPath(["r1a", "r2c"])).toBe(false);
    expect(validPath(["r2a"])).toBe(false);
  });
});

describe("nodes", () => {
  it("a chest pays once and a rest heals; neither can be skipped to", () => {
    const s = on(fresh(), ["r1a"]);
    const c = visit(s, "r2a")!;
    expect(c.items.potion).toBe(s.items.potion + 1);
    expect(visit(c, "r2a")).toBeNull(); // replay
    expect(visit(fresh(), "r2a")).toBeNull(); // not reachable yet
    const hurt = on({ ...fresh(), hero: { ...fresh().hero, hp: 1, mp: 0 } }, ["r1b"]);
    const r = visit(hurt, "r2c")!;
    expect(r.hero.hp).toBe(effectiveStats("knight", "tough_skin").maxHp);
  });
  it("a won fight gives EXP, fixed loot and moves the hero; a replay pays nothing", () => {
    const won = recordVictory(fresh(), "r1a");
    expect(won.progress.path).toEqual(["r1a"]);
    expect(won.gold).toBe(lootOf("forest_wolf", "r1a")!.gold);
    expect(won.items.wolf_pelt).toBe(1);
    expect(recordVictory(won, "r1a")).toBe(won);
    expect(parseSave(JSON.stringify(won))?.progress.path).toEqual(["r1a"]);
  });
  it("beating the boss counts a win; a new run keeps level, items and Gold", () => {
    const s = on({ ...fresh(), gold: 50 }, ["r1a", "r2b", "r3b", "r4c", "r5b"]);
    const won = recordVictory(s, "boss");
    expect(won.progress.wins).toBe(1);
    expect(choices(won)).toEqual([]);
    const again = restartRun(won);
    expect(again.progress).toEqual({ path: [], wins: 1, diff: "normal" });
    expect(again.gold).toBe(won.gold);
  });
});

describe("level-up growth", () => {
  const withExp = (exp: number): SaveData => ({ ...fresh(), hero: { ...fresh().hero, exp, hp: 1, mp: 0 } });
  it("grows stats per level from the class table, after talent percents", () => {
    const l1 = effectiveStats("knight", "tough_skin");
    const l3 = effectiveStats("knight", "tough_skin", 3);
    expect(l3.atk - l1.atk).toBe(GROWTH.knight.atk * 2);
    expect(l3.maxHp).toBeGreaterThan(l1.maxHp);
  });
  it("a victory that crosses a threshold raises the level and fully restores HP/MP", () => {
    const won = recordVictory(withExp(25), "r1a");
    expect(won.hero.level).toBe(2);
    const max = effectiveStats("knight", "tough_skin", 2);
    expect([won.hero.hp, won.hero.mp]).toEqual([max.maxHp, max.maxMp]);
    expect(parseSave(JSON.stringify(won))?.hero.hp).toBe(max.maxHp);
  });
  it("a victory without a level-up keeps the battle's HP", () => {
    const won = recordVictory(withExp(0), "r1a");
    expect([won.hero.level, won.hero.hp]).toEqual([1, 1]);
  });
  it("battles use the hero's level", () => {
    expect(heroStats({ classId: "berserk", talentId: "tough_skin", level: 2 }).atk).toBe(effectiveStats("berserk", "tough_skin", 2).atk);
  });
});

describe("old saves", () => {
  it("a v3 save from the walking map keeps the hero, bag and Gold and starts the route", () => {
    const s = fresh();
    const v3 = { ...s, version: 3, gold: 40, progress: { map: "whispering_forest", x: 1, y: 8, facing: "up", checkpoint: "forest_clearing", defeated: ["forest_wolf_1"], claimed: [], quest: { state: "ACTIVE", kills: ["forest_wolf_1"] } } };
    const back = parseSave(JSON.stringify(v3))!;
    expect(back.version).toBe(5);
    expect(back.gold).toBe(40);
    expect(back.progress).toEqual({ path: [], wins: 0, diff: "normal" });
  });
  it("rejects a hand-edited path that skips nodes", () => {
    expect(parseSave(JSON.stringify(on(fresh(), ["r1a", "r3a"])))).toBeNull();
  });
});

describe("difficulty", () => {
  it("is chosen before the first step only, and Torment waits for 3 cleared journeys", () => {
    expect(startRun(fresh(), "nightmare")?.progress.diff).toBe("nightmare");
    expect(startRun(on(fresh(), ["r1a"]), "hard")).toBeNull();
    expect(startRun(fresh(), "torment")).toBeNull();
    expect(startRun({ ...fresh(), progress: { ...fresh().progress, wins: 3 } }, "torment")).not.toBeNull();
  });
  it("scales enemy HP and power, narrows the guard window and multiplies rewards", () => {
    expect(foeStats({ enemy: "forest_wolf", diff: "hard" })).toMatchObject({ maxHp: 87, atk: 15, def: 8 });
    expect(judge(70)).toBe("perfect");
    expect(judge(70, 78)).toBe("good"); // 70ms counts as ~90ms on Nightmare
    const hard = recordVictory(startRun(fresh(), "hard")!, "r1a");
    expect(hard.gold).toBe(Math.floor((lootOf("forest_wolf", "r1a")!.gold * 180) / 100));
    expect(hard.hero.exp).toBe(36);
  });
  it("sums a journey's fights, Gold, EXP and finds from its path", () => {
    const s = visit(recordVictory(fresh(), "r1a"), "r2a")!;
    expect(runSummary(s)).toEqual({ fights: 1, gold: lootOf("forest_wolf", "r1a")!.gold, exp: 20, found: { wolf_pelt: 1, potion: 1, frost_shard: 1 }, cleared: false });
  });
});
