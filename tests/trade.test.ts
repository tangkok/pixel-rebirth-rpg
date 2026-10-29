import { describe, expect, it } from "vitest";
import { defaultLook } from "../src/astra/looks";
import { newSave, parseSave, type SaveData } from "../src/astra/save";
import { KAEL_STOCK, merchantBuy, merchantSell, nextTradeId } from "../src/astra/trade";

const fresh = () => newSave("Hero", "male", "knight", "tough_skin", defaultLook("male", "knight"));
const rich = (gold = 100, pelts = 0): SaveData => ({ ...fresh(), gold, items: { ...fresh().items, wolf_pelt: pelts } });
const buy = (s: SaveData, qty = 1) => merchantBuy(s, "wolf_pelt", qty, nextTradeId(s));
const sell = (s: SaveData, qty = 1) => merchantSell(s, "wolf_pelt", qty, nextTradeId(s));
const ok = (r: ReturnType<typeof buy>) => {
  if (!r.ok) throw new Error(r.why);
  return r.save;
};

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
    expect(back.version).toBe(5);
    expect(back.items.wolf_pelt).toBe(4);
    expect(back).not.toHaveProperty("shop");
  });
});

