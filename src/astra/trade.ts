// Walking adventurer merchant Kael (ADVENTURER_MERCHANT_SYSTEM, SHOP_ECONOMY_SYSTEM §3). Pure,
// all-or-nothing trades over SaveData: a failed check changes nothing, and each trade must carry
// the next trade id so a double tap or a replayed confirm can never apply twice.
import { ITEMS, type ItemId } from "./data";
import type { SaveData } from "./save";
import { GOLD_CAP, ITEM_CAP } from "./world";

export const KAEL = "npc_adventurer_kael";
/**
 * PLACEHOLDER prices from SHOP_ECONOMY_SYSTEM §2 ("Kael may sell a Wolf Pelt for ~24 Gold, and buy
 * loot for ~12"). Separate keys per direction; items without an authored price are not tradeable.
 */
export const KAEL_PRICES: Partial<Record<ItemId, { heroBuys: number; heroSells: number }>> = {
  wolf_pelt: { heroBuys: 24, heroSells: 12 },
};
/** Kael's finite stock from the GDD sample. shortcut: no in-game day yet, so it never restocks. */
export const KAEL_STOCK: Partial<Record<ItemId, number>> = { wolf_pelt: 3 };
export const TRADE_ITEMS = Object.keys(KAEL_PRICES) as ItemId[];

export const nextTradeId = (s: SaveData) => `trade_${s.trade.seq + 1}`;
export type Trade = { ok: true; save: SaveData } | { ok: false; why: string };

function check(s: SaveData, item: ItemId, qty: number, tradeId: string): string | null {
  if (tradeId !== nextTradeId(s)) return "รายการนี้ทำไปแล้ว";
  if (!Number.isInteger(qty) || qty < 1 || qty > ITEM_CAP) return "จำนวนไม่ถูกต้อง";
  if (!(item in ITEMS) || !KAEL_PRICES[item]) return "Kael ไม่ซื้อขายของชิ้นนี้";
  return null;
}
const clone = (s: SaveData): SaveData => JSON.parse(JSON.stringify(s));

/** confirmMerchantBuy: Gold out, Kael's stock down, items in, receipt, all at once. */
export function merchantBuy(s: SaveData, item: ItemId, qty: number, tradeId: string): Trade {
  const why = check(s, item, qty, tradeId);
  if (why) return { ok: false, why };
  const cost = KAEL_PRICES[item]!.heroBuys * qty;
  const left = s.trade.kael[item] ?? 0;
  if (left < qty) return { ok: false, why: "Kael ไม่มีของพอขาย" };
  if (s.gold < cost) return { ok: false, why: "Gold ไม่พอ" };
  if (s.items[item] + qty > ITEM_CAP) return { ok: false, why: "กระเป๋าเต็ม" };
  const n = clone(s);
  n.gold -= cost;
  n.trade.kael[item] = left - qty;
  n.items[item] += qty;
  n.trade.seq += 1;
  return { ok: true, save: n };
}

/** confirmMerchantSell: items out, Gold in, receipt, all at once. */
export function merchantSell(s: SaveData, item: ItemId, qty: number, tradeId: string): Trade {
  const why = check(s, item, qty, tradeId);
  if (why) return { ok: false, why };
  const pay = KAEL_PRICES[item]!.heroSells * qty;
  if (s.items[item] < qty) return { ok: false, why: "มีของไม่พอขาย" };
  if (s.gold + pay > GOLD_CAP) return { ok: false, why: "Gold เต็มแล้ว" };
  const n = clone(s);
  n.items[item] -= qty;
  n.gold += pay;
  n.trade.seq += 1;
  return { ok: true, save: n };
}

/** Kael's Talk pages: flavour plus clues about drops and safe spots (paginated, short). */
export const KAEL_TALK = [
  "ข้าชื่อ Kael นักล่าแห่งป่า Whispering ถ้าได้หนังหมาป่ามา เอามาขายข้าได้เลย",
  "Forest Wolf ทุกตัวทิ้ง Wolf Pelt ไว้เสมอ ฆ่าสามตัวก็ได้สามผืน",
  "เหนื่อยเมื่อไหร่ก็กลับไปแตะคริสตัลข้างน้ำพุ หรือคริสตัลกลางป่าทางตะวันตก",
];
