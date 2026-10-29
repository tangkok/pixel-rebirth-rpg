import { describe, expect, it } from "vitest";
import { GROWTH } from "../src/astra/data";
import { heroStats } from "../src/astra/battle";
import { effectiveStats } from "../src/astra/hero";
import { defaultLook } from "../src/astra/looks";
import { newSave, parseSave, type SaveData } from "../src/astra/save";
import { KAEL_STOCK, merchantBuy, merchantSell, nextTradeId } from "../src/astra/trade";
import { lootOf, MAPS, recordVictory, routeTiles, walkable } from "../src/astra/world";

const fresh = () => newSave("Hero", "male", "knight", "tough_skin", defaultLook("male", "knight"));
const rich = (gold = 100, pelts = 0): SaveData => ({ ...fresh(), gold, items: { ...fresh().items, wolf_pelt: pelts } });
const buy = (s: SaveData, qty = 1) => merchantBuy(s, "wolf_pelt", qty, nextTradeId(s));
const sell = (s: SaveData, qty = 1) => merchantSell(s, "wolf_pelt", qty, nextTradeId(s));
const ok = (r: ReturnType<typeof buy>) => {
  if (!r.ok) throw new Error(r.why);
  return r.save;
};

describe("Kael's walk", () => {
  it("is a closed loop of adjacent, walkable tiles that start where he stands", () => {
    const v = MAPS.oakheart_village;
    const kael = v.entities.find((e) => e.kind === "merchant")!;
    if (kael.kind !== "merchant") throw new Error();
    const tiles = routeTiles(kael.route);
    expect(tiles[0]).toEqual([kael.x, kael.y]);
    const empty = { ...v, entities: v.entities.filter((e) => e !== kael) };
    tiles.forEach(([x, y], i) => {
      const [nx, ny] = tiles[(i + 1) % tiles.length];
      expect(Math.abs(nx - x) + Math.abs(ny - y), `${x},${y}`).toBe(1);
      expect(walkable(empty, fresh(), x, y), `${x},${y}`).toBe(true);
    });
  });
  it("blocks and is found where explore says he is, not where he started", () => {
    const v = MAPS.oakheart_village;
    const at = { npc_adventurer_kael: { x: 20, y: 10 } };
    expect(walkable(v, fresh(), 15, 10, at)).toBe(true);
    expect(walkable(v, fresh(), 20, 10, at)).toBe(false);
  });
});

describe("wolf loot", () => {
  it("gives gold in 8–18 and one Wolf Pelt, fixed per encounter and only once", () => {
    for (const id of ["forest_wolf_1", "forest_wolf_2", "forest_wolf_3"]) {
      const g = lootOf("forest_wolf", id)!.gold;
      expect(g).toBeGreaterThanOrEqual(8);
      expect(g).toBeLessThanOrEqual(18);
      expect(lootOf("forest_wolf", id)!.gold).toBe(g);
    }
    const s: SaveData = { ...fresh(), progress: { ...fresh().progress, map: "whispering_forest", x: 1, y: 8 } };
    const won = recordVictory(s, "forest_wolf_1");
    expect(won.items.wolf_pelt).toBe(1);
    expect(won.gold).toBe(lootOf("forest_wolf", "forest_wolf_1")!.gold);
    expect(recordVictory(won, "forest_wolf_1")).toBe(won);
  });
});

describe("Kael trades", () => {
  it("buys: Gold down, stock down, pelt up, one receipt", () => {
    const s = ok(buy(rich()));
    expect(s.gold).toBe(76);
    expect(s.trade.kael.wolf_pelt).toBe(2);
    expect(s.items.wolf_pelt).toBe(1);
    expect(s.trade.seq).toBe(1);
  });
  it("sells: pelt down, Gold up, stock untouched", () => {
    const s = ok(sell(rich(0, 2)));
    expect(s.gold).toBe(12);
    expect(s.items.wolf_pelt).toBe(1);
    expect(s.trade.kael.wolf_pelt).toBe(KAEL_STOCK.wolf_pelt);
  });
  it("refuses a replayed or stale trade id (double tap, reload replay)", () => {
    const s = rich();
    const id = nextTradeId(s);
    const once = ok(merchantBuy(s, "wolf_pelt", 1, id));
    expect(merchantBuy(once, "wolf_pelt", 1, id)).toEqual({ ok: false, why: "รายการนี้ทำไปแล้ว" });
  });
  it.each([
    ["not enough Gold", () => buy(rich(23))],
    ["last unit gone", () => buy(ok(buy(ok(buy(ok(buy(rich(1000))))))))],
    ["more than the stock", () => buy(rich(1000), 4)],
    ["full bag", () => buy(rich(100, 99))],
    ["nothing to sell", () => sell(rich(0, 0))],
    ["zero quantity", () => buy(rich(), 0)],
    ["fractional quantity", () => sell(rich(0, 5), 1.5)],
    ["an unpriced item", () => merchantBuy(rich(), "potion", 1, "trade_1")],
    ["Gold at the cap", () => sell(rich(9_999_999, 1))],
  ])("changes nothing on %s", (_, run) => {
    expect(run().ok).toBe(false);
  });
  it("survives save and reload, and an old v2 save gets Kael's full stock", () => {
    const s = ok(buy(rich()));
    expect(parseSave(JSON.stringify(s))?.trade).toEqual({ seq: 1, kael: { wolf_pelt: 2 } });
    const { trade: _, ...v2 } = { ...fresh(), version: 2 };
    expect(parseSave(JSON.stringify(v2))?.trade).toEqual({ seq: 0, kael: { wolf_pelt: 3 } });
    expect(parseSave(JSON.stringify({ ...s, trade: { seq: 1, kael: { wolf_pelt: 9 } } }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...s, trade: { seq: -1, kael: {} } }))).toBeNull();
  });
});

describe("removed player shop", () => {
  it("loads a v4 save from the shop build and returns shelf stock to the bag", () => {
    const s = fresh();
    const v4 = { ...s, version: 4, items: { ...s.items, wolf_pelt: 1 }, shop: { open: true, sales: 2, shelves: { shelf_a: { item: "wolf_pelt", qty: 3, tier: 80 }, shelf_b: null } } };
    const back = parseSave(JSON.stringify(v4))!;
    expect(back.version).toBe(3);
    expect(back.items.wolf_pelt).toBe(4);
    expect(back).not.toHaveProperty("shop");
  });
});

describe("level-up growth", () => {
  const atWolves = (s: SaveData, exp: number): SaveData => ({ ...s, hero: { ...s.hero, exp, hp: 1, mp: 0 }, progress: { ...s.progress, map: "whispering_forest", x: 1, y: 8 } });
  it("grows stats per level from the class table, after talent percents", () => {
    const l1 = effectiveStats("knight", "tough_skin");
    const l3 = effectiveStats("knight", "tough_skin", 3);
    expect(l3.atk - l1.atk).toBe(GROWTH.knight.atk * 2);
    expect(l3.maxHp).toBeGreaterThan(l1.maxHp);
  });
  it("a victory that crosses a threshold raises the level and fully restores HP/MP", () => {
    const won = recordVictory(atWolves(fresh(), 25), "forest_wolf_1");
    expect(won.hero.level).toBe(2);
    const max = effectiveStats("knight", "tough_skin", 2);
    expect([won.hero.hp, won.hero.mp]).toEqual([max.maxHp, max.maxMp]);
    expect(parseSave(JSON.stringify(won))?.hero.hp).toBe(max.maxHp); // level-2 HP passes the save check
  });
  it("a victory without a level-up keeps the battle's HP", () => {
    const won = recordVictory(atWolves(fresh(), 0), "forest_wolf_1");
    expect([won.hero.level, won.hero.hp]).toEqual([1, 1]);
  });
  it("battles use the hero's level", () => {
    expect(heroStats({ classId: "berserk", talentId: "tough_skin", level: 2 }).atk).toBe(effectiveStats("berserk", "tough_skin", 2).atk);
  });
});
