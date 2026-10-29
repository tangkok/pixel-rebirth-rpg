import { expect, test, type Page } from "@playwright/test";

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
  await expect(world(page)).toHaveAttribute("data-pos", "14,9");
}

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
    const hp = await page.locator(".bar span").first().textContent();
    const [cur] = hp!.match(/\d+/g)!.map(Number);
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
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("echoes-of-astra-save")!));

test.beforeEach(async ({ page }) => {
  await page.goto("/astra/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("full forest_troubles loop survives reloads without duplicate credit", async ({ page }) => {
  test.setTimeout(120_000);
  await newHero(page);
  await walk(page, "LUU");
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog")).toContainText("Forest Wolf สามตัว");
  await page.getByRole("button", { name: "รับภารกิจ" }).dblclick();
  await expect(world(page)).toHaveAttribute("data-quest", "ACTIVE");

  await walk(page, "DDD" + "R".repeat(10));
  await expect(world(page)).toHaveAttribute("data-map", "whispering_forest");
  await expect(world(page)).toHaveAttribute("data-pos", "1,8");
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
  await walk(page, "L".repeat(9) + "UUU");
  const before = (await saved(page)).items.potion;
  await page.keyboard.press("e");
  await page.getByRole("button", { name: /รับรางวัล/ }).dblclick();
  await expect(world(page)).toHaveAttribute("data-quest", "COMPLETED");
  await expect(page.locator(".hud-stats")).toContainText("100 G");
  const done = await saved(page);
  expect(done.gold).toBe(100);
  expect(done.items.potion).toBe(before + 2); // reward added once on top of what the fights left
  expect(done.hero.level).toBe(2); // 60 EXP (PLACEHOLDER curve 0/30/80)

  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog")).toContainText("ขอบคุณอีกครั้ง");
  await page.getByRole("button", { name: "ปิด" }).click();
  expect((await saved(page)).gold).toBe(100);
});

test("crystal saves and the chest opens once", async ({ page }) => {
  await newHero(page);
  await page.keyboard.press("ArrowUp"); // the crystal blocks the step; the hero turns to it
  await expect(world(page)).toHaveAttribute("data-pos", "14,9");
  await expect(page.locator(".act")).toHaveText("บันทึก");
  await page.locator(".act").click();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("บันทึกเกมแล้ว");

  await walk(page, "D" + "L".repeat(11) + "DD");
  await page.keyboard.press("ArrowLeft");
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
    await walk(page, "LUU");
    await page.keyboard.press("e");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoScroll(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await walk(page, "DDD" + "R".repeat(10) + "R".repeat(7));
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
  await expect(world(page)).toHaveAttribute("data-pos", "13,9");
});

test("losing a duel returns to the checkpoint at full HP and keeps the wolf", async ({ page }) => {
  await newHero(page);
  await walk(page, "DRRRRRRRRR"); // to the forest exit
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
  await expect(world(page)).toHaveAttribute("data-pos", "14,9");
  const s = await saved(page);
  const [, max] = (await page.locator(".hud-stats").textContent())!.match(/HP (\d+)\/(\d+)/)!.slice(1).map(Number);
  expect(s.hero.hp).toBe(max); // full, whatever the rolled talent did to MaxHP
  expect(s.progress.defeated).toEqual([]);
});
