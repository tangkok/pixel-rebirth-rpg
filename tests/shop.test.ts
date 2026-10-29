import { describe, expect, it } from "vitest";
import { defaultLook } from "../src/astra/looks";
import { newSave, parseSave, type SaveData } from "../src/astra/save";
import { beside, browse, checkout, nextSaleId, priceOf, SHOP, setOpen, setTier, shopUnlocked, stepToward, stockShelf, unstockShelf } from "../src/astra/shop";
import { MAPS, QUEST_REWARD_ID, walkable } from "../src/astra/world";

const fresh = () => newSave("Hero", "male", "knight", "tough_skin", defaultLook("male", "knight"));
const withPelts = (n = 3): SaveData => ({ ...fresh(), items: { ...fresh().items, wolf_pelt: n } });
const ok = (r: ReturnType<typeof stockShelf>) => {
  if (!r.ok) throw new Error(r.why);
  return r.save;
};
const stocked = (qty = 3, tier: 80 | 100 | 120 | 150 = 100) => ok(stockShelf(withPelts(qty), "shelf_a", "wolf_pelt", qty, tier));

describe("shop room", () => {
  it("lets the door reach a tile beside every shelf, the counter's front and the hero spawn", () => {
    const door: [number, number] = [SHOP.exits[0].x, SHOP.exits[0].y];
    for (const e of SHOP.entities) {
      const goal = e.kind === "counter" ? (x: number, y: number) => x === e.x && y === e.y + 1 : beside(e.x, e.y);
      expect(stepToward(SHOP, fresh(), door, goal), e.id).not.toBeNull();
      expect(walkable(SHOP, fresh(), e.x, e.y), e.id).toBe(false);
    }
    expect(walkable(SHOP, fresh(), 2, 6)).toBe(true);
    const villageDoor = MAPS.oakheart_village.entities.find((e) => e.kind === "door")!;
    expect(walkable(MAPS.oakheart_village, fresh(), villageDoor.x, villageDoor.y + 1)).toBe(true); // where the hero knocks
  });
  it("opens only after Elaine's quest", () => {
    expect(shopUnlocked(fresh())).toBe(false);
    expect(shopUnlocked({ ...fresh(), progress: { ...fresh().progress, claimed: [QUEST_REWARD_ID] } })).toBe(true);
  });
});

describe("shelves", () => {
  it("move pelts from the bag and back without copying them", () => {
    const s = stocked(3);
    expect(s.items.wolf_pelt).toBe(0);
    expect(s.shop.shelves.shelf_a).toEqual({ item: "wolf_pelt", qty: 3, tier: 100 });
    const back = ok(unstockShelf(s, "shelf_a"));
    expect(back.items.wolf_pelt).toBe(3);
    expect(back.shop.shelves.shelf_a).toBeNull();
  });
  it("price tiers round half up: 19 / 24 / 29 / 36", () => {
    expect([80, 100, 120, 150].map((t) => priceOf("wolf_pelt", t as 80))).toEqual([19, 24, 29, 36]);
    expect(ok(setTier(stocked(), "shelf_a", 150)).shop.shelves.shelf_a?.tier).toBe(150);
  });
  it.each([
    ["more than the bag", () => stockShelf(withPelts(1), "shelf_a", "wolf_pelt", 2, 100)],
    ["an unpriced item", () => stockShelf(fresh(), "shelf_a", "potion", 1, 100)],
    ["an odd tier", () => stockShelf(withPelts(), "shelf_a", "wolf_pelt", 1, 90 as 100)],
    ["while open", () => stockShelf(setOpen(withPelts(), true), "shelf_a", "wolf_pelt", 1, 100)],
    ["past the shelf cap", () => stockShelf(withPelts(10), "shelf_a", "wolf_pelt", 10, 100)],
  ])("refuse %s and change nothing", (_, run) => expect(run().ok).toBe(false));
});

describe("customers", () => {
  it("only buy from an open shop, by the tier's chance, and never past what is free", () => {
    const s = stocked(1);
    expect(browse(s, "shelf_a", 0, 0)).toBe(false); // closed
    const open = setOpen(s, true);
    expect(browse(open, "shelf_a", 0, 64)).toBe(true); // 65% at 100
    expect(browse(open, "shelf_a", 0, 65)).toBe(false);
    expect(browse(open, "shelf_a", 1, 0)).toBe(false); // the last unit is already reserved
  });
  it("checkout sells exactly one unit once, and not after closing", () => {
    const open = setOpen(stocked(2), true);
    const id = nextSaleId(open);
    const sold = ok(checkout(open, "shelf_a", id));
    expect([sold.gold, sold.shop.shelves.shelf_a?.qty, sold.shop.sales]).toEqual([24, 1, 1]);
    expect(checkout(sold, "shelf_a", id).ok).toBe(false); // replayed receipt
    expect(checkout(setOpen(sold, false), "shelf_a", nextSaleId(sold)).ok).toBe(false);
    const last = ok(checkout(sold, "shelf_a", nextSaleId(sold)));
    expect(last.shop.shelves.shelf_a).toBeNull();
    expect(checkout(last, "shelf_a", nextSaleId(last)).ok).toBe(false);
  });
  it("shop state survives save/load, old saves get an empty shop, and bad shelves are rejected", () => {
    const s = setOpen(stocked(3, 120), true);
    expect(parseSave(JSON.stringify(s))?.shop).toEqual(s.shop);
    const { shop: _, ...v3 } = { ...fresh(), version: 3 };
    expect(parseSave(JSON.stringify(v3))?.shop.shelves.shelf_a).toBeNull();
    const bad = { ...s, shop: { ...s.shop, shelves: { ...s.shop.shelves, shelf_b: { item: "potion", qty: 1, tier: 100 } } } };
    expect(parseSave(JSON.stringify(bad))).toBeNull();
  });
});
