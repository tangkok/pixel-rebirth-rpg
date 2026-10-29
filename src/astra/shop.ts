// The player's shop, business slice 1 (PLAYER_BUSINESS_SYSTEM, SHOP_TOPDOWN_SCENE). Pure,
// all-or-nothing reducers over SaveData; explore.ts only walks the customer sprite and calls them.
// A visit is never saved: only checkout commits, so a reload mid-visit sells zero times, never twice.
import { ITEMS, type ItemId } from "./data";
import type { SaveData } from "./save";
import { GOLD_CAP, ITEM_CAP, MAPS, QUEST_REWARD_ID, SHELF_IDS, walkable, type ShelfId, type WorldMap } from "./world";

export const PRICE_TIERS = [80, 100, 120, 150] as const;
export type Tier = (typeof PRICE_TIERS)[number];
/** PLACEHOLDER (§6): purchase chance per tier for an interested customer. */
export const BUY_CHANCE: Record<Tier, number> = { 80: 85, 100: 65, 120: 40, 150: 10 };
/** PLACEHOLDER (§6): city referenceSellPrice; only items listed here can go on a shelf. */
export const REFERENCE_PRICE: Partial<Record<ItemId, number>> = { wolf_pelt: 24 };
export const SHELF_CAP = 9;

export type Shelf = { item: ItemId; qty: number; tier: Tier } | null;
export interface ShopState {
  open: boolean;
  shelves: Record<ShelfId, Shelf>;
  /** Confirmed sales so far: the receipt that makes each checkout id usable once. */
  sales: number;
}
export const freshShop = (): ShopState => ({ open: false, shelves: { shelf_a: null, shelf_b: null, shelf_c: null, shelf_d: null }, sales: 0 });

/** The starter stall is granted once Elaine's quest is done (§2). */
export const shopUnlocked = (s: SaveData) => s.progress.claimed.includes(QUEST_REWARD_ID);

/** Round half up, on whole Gold (SHOP_ECONOMY_SYSTEM §2). */
export const priceOf = (item: ItemId, tier: Tier) => Math.floor(((REFERENCE_PRICE[item] ?? 0) * tier + 50) / 100);

export type Result = { ok: true; save: SaveData } | { ok: false; why: string };
const clone = (s: SaveData): SaveData => JSON.parse(JSON.stringify(s));
const bad = (why: string): Result => ({ ok: false, why });

/** Bag → shelf transfer; only while closed (PREPARING). Adds to a shelf holding the same item. */
export function stockShelf(s: SaveData, id: ShelfId, item: ItemId, qty: number, tier: Tier): Result {
  if (s.shop.open) return bad("ปิดร้านก่อนจัดชั้นวาง");
  if (!SHELF_IDS.includes(id) || !(item in ITEMS) || !REFERENCE_PRICE[item]) return bad("วางของชิ้นนี้ไม่ได้");
  if (!PRICE_TIERS.includes(tier)) return bad("ระดับราคาไม่ถูกต้อง");
  const shelf = s.shop.shelves[id];
  if (shelf && shelf.item !== item) return bad("ชั้นนี้มีของอื่นอยู่");
  if (!Number.isInteger(qty) || qty < 1 || qty > s.items[item]) return bad("มีของไม่พอ");
  if ((shelf?.qty ?? 0) + qty > SHELF_CAP) return bad("ชั้นวางเต็ม");
  const n = clone(s);
  n.items[item] -= qty;
  n.shop.shelves[id] = { item, qty: (shelf?.qty ?? 0) + qty, tier };
  return { ok: true, save: n };
}

/** Shelf → bag, everything on it. */
export function unstockShelf(s: SaveData, id: ShelfId): Result {
  if (s.shop.open) return bad("ปิดร้านก่อนจัดชั้นวาง");
  const shelf = s.shop.shelves[id];
  if (!shelf) return bad("ชั้นว่างอยู่แล้ว");
  if (s.items[shelf.item] + shelf.qty > ITEM_CAP) return bad("กระเป๋าเต็ม");
  const n = clone(s);
  n.items[shelf.item] += shelf.qty;
  n.shop.shelves[id] = null;
  return { ok: true, save: n };
}

export function setTier(s: SaveData, id: ShelfId, tier: Tier): Result {
  const shelf = s.shop.shelves[id];
  if (s.shop.open) return bad("ปิดร้านก่อนเปลี่ยนราคา");
  if (!shelf || !PRICE_TIERS.includes(tier)) return bad("ชั้นว่างอยู่");
  const n = clone(s);
  n.shop.shelves[id] = { ...shelf, tier };
  return { ok: true, save: n };
}

export function setOpen(s: SaveData, open: boolean): SaveData {
  if (s.shop.open === open) return s;
  const n = clone(s);
  n.shop.open = open;
  return n;
}

/**
 * The customer's one decision at the shelf (§6). `reserved` counts units other visitors hold, so the
 * last unit can be reserved once; `roll` in [0, 100) comes from the caller and is never re-rolled.
 */
export function browse(s: SaveData, id: ShelfId, reserved: number, roll: number): boolean {
  const shelf = s.shop.shelves[id];
  return s.shop.open && !!shelf && shelf.qty - reserved > 0 && roll < BUY_CHANCE[shelf.tier];
}

export const nextSaleId = (s: SaveData) => `sale_${s.shop.sales + 1}`;

/** Checkout: one unit off the shelf, Gold in, receipt, all at once; a used or stale id is refused. */
export function checkout(s: SaveData, id: ShelfId, saleId: string): Result {
  if (saleId !== nextSaleId(s)) return bad("ขายรายการนี้ไปแล้ว");
  if (!s.shop.open) return bad("ร้านปิดแล้ว");
  const shelf = s.shop.shelves[id];
  if (!shelf || shelf.qty < 1) return bad("ของหมดชั้น");
  const price = priceOf(shelf.item, shelf.tier);
  if (s.gold + price > GOLD_CAP) return bad("Gold เต็มแล้ว");
  const n = clone(s);
  n.shop.shelves[id] = shelf.qty > 1 ? { ...shelf, qty: shelf.qty - 1 } : null;
  n.gold += price;
  n.shop.sales += 1;
  return { ok: true, save: n };
}

/** Validates an untrusted saved shop. Null on anything unexpected. */
export function parseShop(v: unknown): ShopState | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const shelves = o.shelves as Record<string, unknown> | null;
  if (typeof o.open !== "boolean" || !Number.isInteger(o.sales) || (o.sales as number) < 0 || (o.sales as number) > 1e9) return null;
  if (typeof shelves !== "object" || shelves === null || Object.keys(shelves).some((k) => !SHELF_IDS.includes(k as ShelfId))) return null;
  const out = freshShop();
  out.open = o.open;
  out.sales = o.sales as number;
  for (const id of SHELF_IDS) {
    const sh = shelves[id] as Record<string, unknown> | null | undefined;
    if (sh == null) continue;
    if (typeof sh !== "object" || !REFERENCE_PRICE[sh.item as ItemId] || !PRICE_TIERS.includes(sh.tier as Tier)) return null;
    if (!Number.isInteger(sh.qty) || (sh.qty as number) < 1 || (sh.qty as number) > SHELF_CAP) return null;
    out.shelves[id] = { item: sh.item as ItemId, qty: sh.qty as number, tier: sh.tier as Tier };
  }
  return out;
}

/** 4-neighbour BFS (§2): the next step from `from` toward any tile where `goal` holds, or null. */
export function stepToward(
  map: WorldMap,
  s: SaveData,
  from: [number, number],
  goal: (x: number, y: number) => boolean,
  blocked: [number, number][] = [],
): [number, number] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const prev = new Map<string, string>([[key(...from), ""]]);
  const queue: [number, number][] = [from];
  for (const [x, y] of queue) {
    if (goal(x, y)) {
      let k = key(x, y);
      if (k === key(...from)) return from;
      while (prev.get(k) !== key(...from)) k = prev.get(k)!;
      return k.split(",").map(Number) as [number, number];
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (prev.has(key(nx, ny)) || !walkable(map, s, nx, ny) || blocked.some(([bx, by]) => bx === nx && by === ny)) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

/** Tiles next to an entity where a visitor stands to use it. */
export const beside = (ex: number, ey: number) => (x: number, y: number) => Math.abs(x - ex) + Math.abs(y - ey) === 1;
export const SHOP = MAPS.oakheart_player_shop_interior;
