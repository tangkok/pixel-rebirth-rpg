import { expect, test, type Page } from "@playwright/test";
import type { SaveData } from "../../src/astra/save";
import { lootOf, MAPS, START, walkable, type MapId } from "../../src/astra/world";

const SIZES = [
  { name: "phone portrait", width: 375, height: 667 },
  { name: "phone landscape", width: 667, height: 375 },
  { name: "tiny landscape", width: 568, height: 320 },
  { name: "desktop", width: 1440, height: 900 },
];

async function expectNoScroll(page: Page) {
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    const offscreen = [...document.querySelectorAll<HTMLElement>("button")]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5;
      })
      .map((el) => el.textContent);
    return { sw: d.scrollWidth, cw: d.clientWidth, sh: d.scrollHeight, ch: d.clientHeight, offscreen };
  });
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(m.sh).toBeLessThanOrEqual(m.ch);
  expect(m.offscreen).toEqual([]);
}

async function newHero(page: Page) {
  await page.getByRole("button", { name: "New Game" }).click();
  await page.locator("#hero-name").fill("Tang");
  const next = page.getByRole("button", { name: "ถัดไป", exact: true });
  await next.click();
  await page.getByRole("button", { name: "Berserk" }).click();
  await next.click();
  await next.click();
  await page.locator(".draw .btn").click();
  await expect(page.locator(".slot.landed")).toHaveCount(1);
  await next.click();
  await page.getByRole("button", { name: "เริ่มการผจญภัย" }).click();
  await expect(world(page)).toHaveAttribute("data-pos", AT_START);
}
const AT_START = `${START.x},${START.y}`;

const world = (page: Page) => page.locator("main.world");
const KEY = { L: "ArrowLeft", R: "ArrowRight", U: "ArrowUp", D: "ArrowDown" } as const;

/** Walks one tile per letter, waiting for each step to land. */
async function walk(page: Page, path: string) {
  for (const c of path) {
    const before = await world(page).getAttribute("data-pos");
    await page.keyboard.press(KEY[c as keyof typeof KEY]);
    await expect(world(page)).not.toHaveAttribute("data-pos", before!);
  }
}
/** Steps into an enemy and wins the duel: potion when low, skill when affordable, else attack. */
async function fight(page: Page, key: keyof typeof KEY) {
  await page.keyboard.press(KEY[key]);
  await expect(page.locator(".encounter")).toBeVisible();
  const back = page.getByRole("button", { name: "กลับสู่แผนที่" });
  for (let turn = 0; turn < 40 && !(await back.isVisible()); turn++) {
    const skip = page.getByRole("button", { name: "ข้าม ⏭" });
    if (await skip.isVisible()) await skip.click();
    const cmds = page.locator(".cmds button:not(:disabled)");
    await expect(cmds.first()).toBeVisible();
    if (await back.isVisible()) break;
    const cur = Number(await page.locator(".fe-side.hero .fe-hp-num").textContent());
    const item = page.getByRole("button", { name: "Item ไอเทม" });
    if (cur < 60 && (await item.isEnabled())) {
      await item.click();
      const potion = page.getByRole("button", { name: /^Potion/ });
      if (await potion.isEnabled()) {
        await potion.click();
        continue;
      }
      await page.getByRole("button", { name: "กลับ", exact: true }).click();
    }
    const skill = page.locator(".cmds button").nth(1);
    await ((await skill.isEnabled()) ? skill : page.getByRole("button", { name: "Attack โจมตี" })).dblclick(); // double tap = one action
  }
  await back.click();
  await expect(world(page)).toBeVisible();
}
type Goal = (x: number, y: number, kael: [number, number] | null) => boolean;
/**
 * Walks to a tile where `goal` holds, one step at a time: each step re-plans a shortest path
 * (BFS over the real map) around wherever Kael is walking right now. Stops if the map changes.
 */
async function goTo(page: Page, goal: Goal) {
  const id = (await world(page).getAttribute("data-map")) as MapId;
  const m = MAPS[id];
  const none = { progress: { defeated: [], claimed: [] } } as unknown as SaveData;
  for (let step = 0; step < 400; step++) {
    const [map, at, k] = await world(page).evaluate((el) => [el.dataset.map, el.dataset.pos!, el.dataset.kael ?? ""]);
    if (map !== id) return;
    const [sx, sy] = at.split(",").map(Number);
    const kael = k ? (k.split(",").map(Number) as [number, number]) : null;
    const walkers = kael ? { npc_adventurer_kael: { x: kael[0], y: kael[1] } } : {};
    const prev = new Map<string, [string, string]>([[`${sx},${sy}`, ["", ""]]]);
    const queue: [number, number][] = [[sx, sy]];
    let first = "";
    for (const [x, y] of queue) {
      if (goal(x, y, kael)) {
        for (let key = `${x},${y}`; prev.get(key)![0]; key = prev.get(key)![0]) first = prev.get(key)![1];
        if (!first) return; // already there
        break;
      }
      if (m.exits.some((e) => e.x === x && e.y === y) && !(x === sx && y === sy)) continue; // leaving ends the route
      for (const [c, dx, dy] of [["L", -1, 0], ["R", 1, 0], ["U", 0, -1], ["D", 0, 1]] as const) {
        const key = `${x + dx},${y + dy}`;
        if (prev.has(key) || !walkable(m, none, x + dx, y + dy, walkers)) continue;
        prev.set(key, [`${x},${y}`, c]);
        queue.push([x + dx, y + dy]);
      }
    }
    if (!first) {
      await page.waitForTimeout(200); // boxed in by Kael for a moment
      continue;
    }
    await page.keyboard.press(KEY[first as keyof typeof KEY]);
    // Kael may have stepped in the way; then the hero only turns and the next loop re-plans.
    await page.waitForFunction((b) => document.querySelector<HTMLElement>("main.world")?.dataset.pos !== b, at, { timeout: 1000 }).catch(() => {});
  }
  throw new Error("no route");
}
const village = MAPS.oakheart_village;
const near = (kind: string) => {
  const e = village.entities.find((x) => x.kind === kind)!;
  return (x: number, y: number) => Math.abs(x - e.x) + Math.abs(y - e.y) === 1;
};
/** Next to Elaine and turned to face her, so a passing Kael is never the one spoken to. */
async function toElaine(page: Page) {
  await goTo(page, near("npc"));
  const e = village.entities.find((x) => x.kind === "npc")!;
  const [x, y] = (await world(page).getAttribute("data-pos"))!.split(",").map(Number);
  await page.keyboard.press(e.x < x ? "ArrowLeft" : e.x > x ? "ArrowRight" : e.y < y ? "ArrowUp" : "ArrowDown");
}
/** Through the village's east exit into the forest at (1,8). */
async function toForest(page: Page) {
  const exit = village.exits[0];
  await goTo(page, (x, y) => x === exit.x && y === exit.y);
  await expect(world(page)).toHaveAttribute("data-map", "whispering_forest");
  await expect(world(page)).toHaveAttribute("data-pos", "1,8");
}
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("echoes-of-astra-save")!));

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000); // the town is large and headless canvas rendering is slow
  await page.goto("/astra/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("full forest_troubles loop survives reloads without duplicate credit", async ({ page }) => {
  test.setTimeout(240_000);
  await newHero(page);
  await toElaine(page);
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog")).toContainText("Forest Wolf สามตัว");
  await page.getByRole("button", { name: "รับภารกิจ" }).dblclick();
  await expect(world(page)).toHaveAttribute("data-quest", "ACTIVE");

  await toForest(page);
  await walk(page, "R".repeat(7));
  await fight(page, "U");
  await expect(world(page)).toHaveAttribute("data-pos", "8,8");
  await expect(page.locator(".hud-quest")).toContainText("1/3");

  // Reload mid-quest: the wolf stays gone and still counts once.
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(world(page)).toHaveAttribute("data-pos", "8,8");
  await walk(page, "U"); // the beaten wolf's tile is now open
  await walk(page, "D" + "R".repeat(9) + "D" + "R".repeat(6));
  await fight(page, "R");
  await walk(page, "DD" + "L".repeat(7));
  await fight(page, "L");
  await expect(world(page)).toHaveAttribute("data-quest", "READY_TO_TURN_IN");
  expect((await saved(page)).progress.quest.kills).toHaveLength(3);

  await walk(page, "L".repeat(15) + "UUU" + "L");
  await expect(world(page)).toHaveAttribute("data-map", "oakheart_village");
  await toElaine(page);
  const before = (await saved(page)).items.potion;
  await page.keyboard.press("e");
  await page.getByRole("button", { name: /รับรางวัล/ }).dblclick();
  await expect(world(page)).toHaveAttribute("data-quest", "COMPLETED");
  const loot = ["forest_wolf_1", "forest_wolf_2", "forest_wolf_3"].reduce((g, id) => g + lootOf("forest_wolf", id)!.gold, 0);
  await expect(page.locator(".hud-stats")).toContainText(`${100 + loot} G`);
  const done = await saved(page);
  expect(done.gold).toBe(100 + loot);
  expect(done.items.wolf_pelt).toBe(3);
  expect(done.items.potion).toBe(before + 2); // reward added once on top of what the fights left
  expect(done.hero.level).toBe(2); // 60 EXP (PLACEHOLDER curve 0/30/80)

  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog")).toContainText("ขอบคุณอีกครั้ง");
  await page.getByRole("button", { name: "ปิด" }).click();
  expect((await saved(page)).gold).toBe(100 + loot);
});

test("Kael walks the plaza, stops to trade, and trades survive a reload", async ({ page }) => {
  await newHero(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("echoes-of-astra-save")!);
    s.gold = 100;
    s.items.wolf_pelt = 2;
    localStorage.setItem("echoes-of-astra-save", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  const first = await world(page).getAttribute("data-kael");
  await expect(world(page)).not.toHaveAttribute("data-kael", first!, { timeout: 5000 }); // he walks

  const dialog = page.getByRole("dialog");
  for (let tries = 0; tries < 10 && !(await dialog.isVisible()); tries++) {
    await goTo(page, (x, y, k) => !!k && Math.abs(x - k[0]) + Math.abs(y - k[1]) === 1);
    if ((await page.locator(".act").textContent()) === "คุย") await page.keyboard.press("e");
  }
  await expect(dialog).toContainText("Kael");
  const at = await world(page).getAttribute("data-kael");
  await page.waitForTimeout(1500);
  await expect(world(page)).toHaveAttribute("data-kael", at!); // paused while spoken to
  await expectNoScroll(page);

  await page.getByRole("button", { name: "Buy ซื้อ" }).click();
  await expect(dialog).toContainText("Kael มี 3");
  await page.getByRole("button", { name: "ซื้อ Wolf Pelt ×1" }).dblclick(); // double tap = one trade
  await expect(dialog).toContainText("Kael มี 2");
  let s = await saved(page);
  expect([s.gold, s.items.wolf_pelt, s.trade.kael.wolf_pelt, s.trade.seq]).toEqual([76, 3, 2, 1]);
  await page.getByRole("button", { name: "กลับ", exact: true }).click();
  await page.getByRole("button", { name: "Sell ขาย" }).click();
  await page.getByRole("button", { name: "ขาย Wolf Pelt ×1" }).click();
  await expect(dialog).toContainText("คุณมี 2");
  await page.getByRole("button", { name: "กลับ", exact: true }).click();
  await page.getByRole("button", { name: "Leave ไปก่อน" }).click();
  await expect(dialog).toBeHidden();
  await expect(world(page)).not.toHaveAttribute("data-kael", at!, { timeout: 5000 }); // resumes his loop

  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".hud-stats")).toContainText("88 G");
  s = await saved(page);
  expect([s.gold, s.items.wolf_pelt, s.trade.kael.wolf_pelt, s.trade.seq]).toEqual([88, 2, 2, 2]);
});

test("the player's shop: stock a shelf, open, a customer buys at the counter, leaving closes it", async ({ page }) => {
  await newHero(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("echoes-of-astra-save")!);
    const wolves = ["forest_wolf_1", "forest_wolf_2", "forest_wolf_3"];
    s.progress = { ...s.progress, defeated: wolves, quest: { state: "COMPLETED", kills: wolves }, claimed: ["forest_troubles:turnin"], x: 10, y: 13, facing: "up" };
    s.items.wolf_pelt = 2;
    localStorage.setItem("echoes-of-astra-save", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".act")).toHaveText("เข้าร้าน");
  await page.keyboard.press("e");
  await expect(world(page)).toHaveAttribute("data-map", "oakheart_player_shop_interior");
  await expectNoScroll(page);

  const shop = MAPS.oakheart_player_shop_interior;
  const shelf = shop.entities.find((e) => e.id === "shelf_a")!;
  await goTo(page, (x, y) => x === shelf.x - 1 && y === shelf.y);
  await page.keyboard.press("ArrowRight"); // face the shelf
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "วางทั้งหมด ×2" }).click();
  await page.getByRole("button", { name: "ราคา 120%" }).click();
  await page.getByRole("button", { name: "ราคา 150%" }).click();
  await page.getByRole("button", { name: "ราคา 80%" }).click(); // 19 G, 85% chance
  await expect(page.getByRole("dialog")).toContainText("Wolf Pelt ×2 · ราคา 19 G (80%)");
  await expectNoScroll(page);
  await page.getByRole("button", { name: "ปิด", exact: true }).click();
  let s = await saved(page);
  expect([s.items.wolf_pelt, s.shop.shelves.shelf_a]).toEqual([0, { item: "wolf_pelt", qty: 2, tier: 80 }]);

  const counter = shop.entities.find((e) => e.kind === "counter")!;
  await goTo(page, (x, y) => x === counter.x - 1 && y === counter.y);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "เปิดร้าน" }).click();
  await expect(world(page)).toHaveAttribute("data-shop", "open");
  // One visit: the customer walks in, browses, maybe pays at the counter, and walks out.
  await expect(world(page)).toHaveAttribute("data-customer", /.+/, { timeout: 10_000 });
  await expect(world(page)).not.toHaveAttribute("data-customer", /.+/, { timeout: 30_000 });
  s = await saved(page);
  expect(s.shop.sales).toBeLessThanOrEqual(1);
  expect(s.gold).toBe(19 * s.shop.sales); // only a checkout pays, once per receipt
  expect(s.shop.shelves.shelf_a.qty).toBe(2 - s.shop.sales);

  await goTo(page, (x, y) => x === shop.exits[0].x && y === shop.exits[0].y);
  await expect(world(page)).toHaveAttribute("data-map", "oakheart_village");
  await expect(world(page)).toHaveAttribute("data-shop", "closed"); // no clerk, so leaving closes it
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  expect((await saved(page)).shop.shelves.shelf_a.qty).toBe(2 - s.shop.sales);
});

test("crystal saves and the chest opens once", async ({ page }) => {
  await newHero(page);
  await page.keyboard.press("ArrowUp"); // the crystal blocks the step; the hero turns to it
  await expect(world(page)).toHaveAttribute("data-pos", AT_START);
  await expect(page.locator(".act")).toHaveText("บันทึก");
  await page.locator(".act").click();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("บันทึกเกมแล้ว");

  await goTo(page, near("chest"));
  await expect(page.locator(".act")).toHaveText("เปิดหีบ");
  await page.keyboard.press("e");
  await expect(page.locator(".toast")).toContainText("Potion ×1");
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog")).toContainText("หีบว่างเปล่า");
  const s = await saved(page);
  expect(s.items.potion).toBe(4);
  expect(s.progress.claimed).toEqual(["oakheart_chest"]);
});

for (const size of SIZES) {
  test(`world, dialog and encounter fit without scrolling: ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await newHero(page);
    await expectNoScroll(page);
    await toElaine(page);
    await page.keyboard.press("e");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoScroll(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await toForest(page);
    await walk(page, "R".repeat(7));
    await page.keyboard.press("ArrowUp");
    await expect(page.locator(".encounter")).toBeVisible();
    await expect(page.locator(".intent")).toContainText("Bite");
    await expectNoScroll(page);
    await page.getByRole("button", { name: "Attack โจมตี" }).click();
    await expectNoScroll(page); // mid-playback, skip button showing
    await page.setViewportSize({ width: size.height, height: size.width }); // rotate mid-fight
    await expectNoScroll(page);
  });
}

test("touch buttons walk the hero", async ({ page }) => {
  await newHero(page);
  await page.getByRole("button", { name: "เดินซ้าย" }).dispatchEvent("pointerdown");
  await page.getByRole("button", { name: "เดินซ้าย" }).dispatchEvent("pointerup");
  await expect(world(page)).toHaveAttribute("data-pos", `${START.x - 1},${START.y}`);
});

test("a well-timed tap scores Perfect/Good and fills Astra; a missed cue counts as Normal", async ({ page }) => {
  await newHero(page);
  await toForest(page);
  await walk(page, "R".repeat(7));
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".encounter")).toBeVisible();
  // Press Space in-page exactly when the ring meets its target (700 ms after the cue appears).
  const timed = page.evaluate(
    () =>
      new Promise<void>((done) => {
        const mo = new MutationObserver(() => {
          if (!document.querySelector(".cue.strike")) return;
          mo.disconnect();
          setTimeout(() => (dispatchEvent(new KeyboardEvent("keydown", { key: " " })), done()), 700);
        });
        mo.observe(document.body, { childList: true, subtree: true });
      }),
  );
  await page.getByRole("button", { name: "Attack โจมตี" }).click();
  await timed;
  await expect(page.locator(".cue.guard")).toBeVisible(); // wolf's turn: guard cue, left to time out
  await expect(page.locator(".cmds button:not(:disabled)").first()).toBeVisible({ timeout: 10_000 });
  // Strike Perfect (+15) or Good (+10), then the faster wolf acts twice, each untimed guard Normal (+3).
  await expect(page.locator(".fe-astra")).toHaveAttribute("aria-valuetext", /^(21|16)\/100$/);
});

test("losing a duel returns to the checkpoint at full HP and keeps the wolf", async ({ page }) => {
  await newHero(page);
  await toForest(page);
  await walk(page, "R".repeat(7));
  await expect(world(page)).toHaveAttribute("data-pos", "8,8");
  await page.getByRole("button", { name: "เมนู" }).click();
  await page.getByRole("button", { name: "กลับหน้าแรก" }).click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("echoes-of-astra-save")!);
    s.hero.hp = 1;
    localStorage.setItem("echoes-of-astra-save", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.keyboard.press("ArrowUp");
  await page.getByRole("button", { name: "Defend ป้องกัน" }).click();
  await page.getByRole("button", { name: "กลับไปจุดเซฟ" }).click();
  await expect(world(page)).toHaveAttribute("data-map", "oakheart_village");
  await expect(world(page)).toHaveAttribute("data-pos", AT_START);
  const s = await saved(page);
  const [, max] = (await page.locator(".hud-stats").textContent())!.match(/HP (\d+)\/(\d+)/)!.slice(1).map(Number);
  expect(s.hero.hp).toBe(max); // full, whatever the rolled talent did to MaxHP
  expect(s.progress.defeated).toEqual([]);
});
