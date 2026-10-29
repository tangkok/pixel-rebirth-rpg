import { expect, test, type Page } from "@playwright/test";
import { lootOf } from "../../src/astra/route";
import type { SaveData } from "../../src/astra/save";

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
      .filter((el) => el.offsetParent !== null && !el.closest(".rows")) // a town list scrolls on purpose, like the reference
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

const route = (page: Page) => page.locator("main.journey");
const node = (page: Page, id: string) => page.locator(`.event[data-node="${id}"]`);
const saved = (page: Page): Promise<SaveData> => page.evaluate(() => JSON.parse(localStorage.getItem("echoes-of-astra-save")!));

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
  await page.getByRole("button", { name: "ประตูเมือง" }).click();
  await page.getByRole("button", { name: "ออกเดินทาง!" }).click();
  await expect(route(page)).toHaveAttribute("data-node", "start");
}
/** Edits the stored save, then continues from the title so the journey reloads it. */
async function patch(page: Page, fn: string) {
  await page.evaluate((src) => {
    const s = JSON.parse(localStorage.getItem("echoes-of-astra-save")!);
    new Function("s", src)(s);
    localStorage.setItem("echoes-of-astra-save", JSON.stringify(s));
  }, fn);
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
}
/** Wins the duel on screen: potion when low, skill when affordable, else attack. */
async function winDuel(page: Page) {
  await expect(page.locator(".encounter")).toBeVisible();
  const back = page.getByRole("button", { name: "กลับสู่เส้นทาง" });
  for (let turn = 0; turn < 80 && !(await back.isVisible()); turn++) {
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
      if ((await potion.count()) && (await potion.isEnabled())) {
        await potion.click();
        continue;
      }
      await page.getByRole("button", { name: "กลับ", exact: true }).click();
    }
    const skill = page.locator(".cmds button").nth(1);
    await ((await skill.isEnabled()) ? skill : page.getByRole("button", { name: "Attack โจมตี" })).dblclick(); // double tap = one action
  }
  await back.click();
  await expect(route(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/astra/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("a fight, a chest and a rest each apply once and survive a reload", async ({ page }) => {
  await newHero(page);
  await expect(page.locator(".event")).toHaveCount(2); // only the start row is offered
  await node(page, "r1a").click();
  await winDuel(page);
  await expect(page.getByRole("dialog")).toContainText("ชัยชนะ!");
  await page.getByRole("button", { name: "ดำเนินต่อ" }).click();
  await expect(route(page)).toHaveAttribute("data-node", "r1a");
  const gold = lootOf("forest_wolf", "r1a")!.gold;
  await expect(page.locator(".hud-stats")).toContainText(`${gold} G`);
  await expect(node(page, "r1b")).toHaveCount(0); // the other branch is closed now

  await node(page, "r2a").dblclick(); // chest: double tap = one chest
  await expect(page.locator(".toast")).toContainText("Potion ×1");
  let s = await saved(page);
  expect(s.progress.path).toEqual(["r1a", "r2a"]);
  expect(s.items.wolf_pelt).toBe(1);

  await patch(page, "s.hero.hp = 1;");
  await node(page, "r3a").click();
  await page.getByRole("button", { name: "Defend ป้องกัน" }).click();
  await page.getByRole("button", { name: "เริ่มเส้นทางใหม่" }).click(); // lost at 1 HP
  await expect(page.getByRole("dialog")).toContainText("การต่อสู้: 1"); // run summary
  await page.getByRole("button", { name: "กลับเมือง" }).click();
  await expect(page.getByRole("button", { name: "ประตูเมือง" })).toBeVisible();
  await expect(route(page)).toHaveAttribute("data-node", "start");
  s = await saved(page);
  expect(s.progress.path).toEqual([]);
  expect(s.gold).toBe(gold); // loot and items stay
  const [hp, max] = (await page.locator(".hud-stats").textContent())!.match(/HP (\d+)\/(\d+)/)!.slice(1).map(Number);
  expect(hp).toBe(max);
});

test("Kael trades on his node and the trade survives a reload", async ({ page }) => {
  await newHero(page);
  await patch(page, "s.gold = 100; s.items.wolf_pelt = 2; s.progress.path = ['r1b', 'r2c'];");
  await node(page, "r3b").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Kael");
  await expectNoScroll(page);
  await page.getByRole("button", { name: "Buy ซื้อ" }).click();
  await expect(dialog).toContainText("Kael มี 3");
  await page.getByRole("button", { name: "ซื้อ Wolf Pelt ×1" }).dblclick(); // double tap = one trade
  await expect(dialog).toContainText("Kael มี 2");
  await page.getByRole("button", { name: "กลับ", exact: true }).click();
  await page.getByRole("button", { name: "Leave ไปก่อน" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".hud-stats")).toContainText("76 G");
  const s = await saved(page);
  expect([s.items.wolf_pelt, s.trade.kael.wolf_pelt, s.progress.path.at(-1)]).toEqual([3, 2, "r3b"]);
});

test("difficulty is picked before setting out and scales the enemy", async ({ page }) => {
  await page.getByRole("button", { name: "New Game" }).click();
  await page.locator("#hero-name").fill("Tang");
  const next = page.getByRole("button", { name: "ถัดไป", exact: true });
  await next.click();
  await page.getByRole("button", { name: "Knight" }).click();
  await next.click();
  await next.click();
  await page.locator(".draw .btn").click();
  await expect(page.locator(".slot.landed")).toHaveCount(1);
  await next.click();
  await page.getByRole("button", { name: "เริ่มการผจญภัย" }).click();
  await page.getByRole("button", { name: "ประตูเมือง" }).click();
  await expect(page.locator(".diff.torment")).toBeDisabled(); // locked until 3 cleared journeys
  await page.locator(".diff.nightmare").click();
  await page.getByRole("button", { name: "ออกเดินทาง!" }).click();
  expect((await saved(page)).progress.diff).toBe("nightmare");
  await node(page, "r1a").click();
  await expect(page.locator(".fe-side.foe .fe-hp-num")).toHaveText("98"); // 70 HP ×1.4
});

test("beating the boss ends the journey and a new one keeps the hero", async ({ page }) => {
  test.setTimeout(180_000); // the boss takes many turns
  await newHero(page);
  await patch(page, "s.hero.level = 3; s.hero.exp = 80; s.items.potion = 9; s.progress.path = ['r1b', 'r2c', 'r3b', 'r4c', 'r5b'];");
  await node(page, "boss").click();
  await winDuel(page);
  await page.getByRole("button", { name: "ดำเนินต่อ" }).click();
  await expect(page.getByRole("dialog")).toContainText("ผ่านการเดินทาง");
  await page.getByRole("button", { name: "กลับเมือง" }).click();
  await expect(route(page)).toHaveAttribute("data-node", "start");
  const s = await saved(page);
  expect(s.progress).toEqual({ path: [], wins: 1, diff: "normal" });
  expect(s.hero.level).toBe(3);
});

test("the town's hall spends level points and the smith hones and crafts", async ({ page }) => {
  await newHero(page);
  await patch(page, "s.hero.level = 3; s.hero.exp = 80; s.gold = 100; s.items.wolf_pelt = 6;");
  await expect(page.getByRole("button", { name: "ลานฝึก" })).toContainText("แต้มเหลือ 2");
  await page.getByRole("button", { name: "ลานฝึก" }).click();
  await expectNoScroll(page);
  await page.getByRole("button", { name: "เพิ่ม ความแข็งแกร่ง" }).dblclick(); // double tap = one point
  await expect(page.locator(".points")).toContainText("เหลือ 1 แต้ม");
  await page.getByRole("button", { name: "กลับเมือง" }).click();
  await page.getByRole("button", { name: "ช่างตีเหล็ก" }).click();
  await expectNoScroll(page);
  await page.getByRole("button", { name: "ตีบวก +1" }).click();
  await expect(page.locator(".building")).toContainText("Axe ขวาน +1");
  await page.getByRole("button", { name: "หัตถกรรม" }).click();
  await page.getByRole("button", { name: "สร้าง Potion" }).click();
  await page.getByRole("button", { name: "ชุดเกราะ" }).click();
  await expect(page.getByRole("button", { name: "ชุดผ้าธรรมดา สวมอยู่" })).toBeDisabled(); // a new hero wears the plain tunic
  await page.getByRole("button", { name: "หลอม ชุดหนังนักล่า" }).dblclick(); // double tap = one forge
  await page.waitForTimeout(450); // a tap inside the double-tap window on the same row is ignored on purpose
  await page.getByRole("button", { name: "สวม ชุดหนังนักล่า" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  const s = await saved(page);
  expect([s.hero.train.strength, s.hero.hone, s.gold, s.items.wolf_pelt, s.items.potion]).toEqual([1, 1, 35, 1, 4]);
  expect([s.hero.armor, s.hero.armors, s.hero.look.outfit]).toEqual(["hunter", ["tunic", "hunter"], 11]);
});

test("the farm hatches the egg and the pet bites in battle", async ({ page }) => {
  await newHero(page);
  await patch(page, "");
  await page.getByRole("button", { name: "ฟาร์ม" }).click();
  await expectNoScroll(page);
  await page.getByRole("button", { name: "ไข่ 1" }).click();
  await page.getByRole("button", { name: "ฟักไข่" }).dblclick(); // double tap = one egg
  await page.getByRole("button", { name: /^สัตว์เลี้ยง 1\/6/ }).click();
  await expect(page.locator(".trow.pet.with")).toHaveCount(1);
  const s = await saved(page);
  expect([s.items.pet_egg, s.pets.list.length, s.pets.with]).toEqual([0, 1, 1]);
  await page.getByRole("button", { name: "กลับเมือง" }).click();
  await page.getByRole("button", { name: "ประตูเมือง" }).click();
  await page.getByRole("button", { name: "ออกเดินทาง!" }).click();
  await node(page, "r1a").click();
  await page.getByRole("button", { name: "Defend ป้องกัน" }).click();
  await expect(page.locator(".log")).toContainText("ใช้ กัด", { timeout: 10_000 });
});

for (const size of SIZES) {
  test(`route, dialog and duel fit without scrolling: ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await newHero(page);
    await expectNoScroll(page);
    await patch(page, "");
    await expect(page.getByRole("button", { name: "ประตูเมือง" })).toBeVisible();
    await expectNoScroll(page); // the town
    await page.getByRole("button", { name: "ลานฝึก" }).click();
    await expectNoScroll(page);
    await page.getByRole("button", { name: "กลับเมือง" }).click();
    await page.getByRole("button", { name: "ประตูเมือง" }).click();
    await page.getByRole("button", { name: "ออกเดินทาง!" }).click();
    await page.getByRole("button", { name: "เมนู" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoScroll(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await node(page, "r1a").click();
    await expect(page.locator(".encounter")).toBeVisible();
    await expect(page.locator(".intent")).toContainText("Bite");
    await expectNoScroll(page);
    await page.getByRole("button", { name: "Attack โจมตี" }).click();
    await expectNoScroll(page); // mid-playback, skip button showing
    await page.setViewportSize({ width: size.height, height: size.width }); // rotate mid-fight
    await expectNoScroll(page);
  });
}

test("a well-timed tap scores Perfect/Good and fills Astra; a missed cue counts as Normal", async ({ page }) => {
  await newHero(page);
  await node(page, "r1a").click();
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
