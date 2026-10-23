import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator("#game canvas")).toBeVisible();
});

test("boots an original world without runtime errors and fits the screen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your adventure starts here." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const world = await page.evaluate(() => {
    const s = (window as any).__pixelRebirth.scene;
    return {
      trees: s.textures.exists("tree"),
      hero: s.textures.exists("hero"),
      enemies: s.enemies.length,
    };
  });
  expect(world).toEqual({ trees: true, hero: true, enemies: 9 });
  expect(errors).toEqual([]);
});

test("keyboard movement, combat, healing and reload persistence", async ({
  page,
}) => {
  const start = await page.evaluate(
    () => (window as any).__pixelRebirth.scene.player.x,
  );
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.scene.player.x),
  ).toBeGreaterThan(start + 20);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const s = (window as any).__pixelRebirth.scene,
        e = s.enemies.find((e: any) => !e.boss);
      s.player.setPosition(e.sprite.x - 35, e.sprite.y);
    });
    await page.keyboard.press("Space");
    await page.waitForTimeout(460);
  }
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__pixelRebirth.progress.kills),
    )
    .toBeGreaterThanOrEqual(1);
  await expect(page.locator("[data-gold]").first()).toHaveText("8");
  await page.evaluate(() => {
    const r = (window as any).__pixelRebirth;
    r.scene.player.setPosition(710, 600);
    r.progress.hp = 30;
  });
  await page.keyboard.press("q");
  await expect(page.locator("#potion-count")).toHaveText("2");
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.progress.hp),
  ).toBe(95);
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator("#potion-count")).toHaveText("2");
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.progress.kills),
  ).toBe(1);
});

test("quest rewards, chest and damage recovery work through game actions", async ({
  page,
}) => {
  await page.evaluate(() => {
    const r = (window as any).__pixelRebirth;
    r.progress.kills = 5;
    r.scene.player.setPosition(535, 550);
  });
  await page.keyboard.press("e");
  await expect(page.locator("#toasts")).toContainText("75 gold");
  expect(
    await page.evaluate(
      () => (window as any).__pixelRebirth.progress.questClaimed,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    (window as any).__pixelRebirth.scene.player.setPosition(887, 480),
  );
  await page.keyboard.press("e");
  await expect(page.locator("#toasts")).toContainText("A lucky find");
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.progress.gold),
  ).toBe(105);
  await page.keyboard.press("e");
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.progress.gold),
  ).toBe(105);
  await page.evaluate(() => {
    const r = (window as any).__pixelRebirth,
      e = r.scene.enemies[0];
    r.progress.hp = 1;
    r.scene.player.setPosition(e.sprite.x, e.sprite.y);
  });
  await expect(page.locator("#toasts")).toContainText("A second chance");
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.progress.hp),
  ).toBe(120);
});

test("dialogs pause the world and inventory, map, settings are functional", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "How to play" }).click();
  await expect(page.locator("#panel")).toBeVisible();
  const x = await page.evaluate(
    () => (window as any).__pixelRebirth.scene.player.x,
  );
  await page.keyboard.down("d");
  await page.waitForTimeout(250);
  await page.keyboard.up("d");
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.scene.player.x),
  ).toBe(x);
  await page.getByRole("button", { name: "Let’s explore" }).click();
  await page.keyboard.press("i");
  await expect(page.locator("#panel")).toContainText("Iron sword");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Open world map", exact: true })
    .click();
  await expect(page.locator("#panel")).toContainText(
    "Somewhere worth getting lost.",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  if (testInfo.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Toggle game sounds" }).click();
  await expect(
    page.getByRole("button", { name: "Toggle game sounds" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reset progress" }).click();
  await page.getByRole("button", { name: "Keep adventuring" }).click();
  await expect(page.locator("#panel")).toContainText("Make yourself at home.");
});

test("pause and resume preserve control", async ({ page }) => {
  await page.getByRole("button", { name: "Pause game", exact: true }).click();
  await expect(page.locator("#resume-game")).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.scene.paused),
  ).toBe(true);
  await page.locator("#resume-game").click();
  await expect(page.locator("#resume-game")).toBeHidden();
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.scene.paused),
  ).toBe(false);
});

test("touch direction pad moves and releases correctly", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Touch controls are shown on touch devices.",
  );
  const start = await page.evaluate(
    () => (window as any).__pixelRebirth.scene.player.x,
  );
  const right = page.getByRole("button", { name: "Move right" });
  await expect(right).toBeVisible();
  const box = (await right.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.scene.player.x),
  ).toBeGreaterThan(start + 25);
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.scene.held.size),
  ).toBe(0);
  await page.getByRole("button", { name: "Attack", exact: true }).last().tap();
  await page.getByRole("button", { name: "Dash", exact: true }).tap();
});

test("collectibles remain collected and the boss can be defeated", async ({
  page,
}) => {
  await page.evaluate(() =>
    (window as any).__pixelRebirth.scene.player.setPosition(840, 740),
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__pixelRebirth.progress.crystals),
    )
    .toBe(1);
  await page.evaluate(() =>
    (window as any).__pixelRebirth.scene.player.setPosition(887, 474),
  );
  await page.keyboard.press("e");
  await expect(page.locator("#toasts")).toContainText("A lucky find");
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as any).__pixelRebirth.progress.openedChest,
    ),
  ).toBe(true);
  await page.evaluate(() =>
    (window as any).__pixelRebirth.scene.player.setPosition(840, 740),
  );
  await page.waitForTimeout(120);
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.progress.crystals),
  ).toBe(1);
  for (let hit = 0; hit < 10; hit++) {
    await page.evaluate(() => {
      const s = (window as any).__pixelRebirth.scene,
        e = s.enemies.find((e: any) => e.boss);
      if (e) s.player.setPosition(e.sprite.x - 70, e.sprite.y);
    });
    await page.keyboard.press("Space");
    await page.waitForTimeout(450);
  }
  expect(
    await page.evaluate(
      () => (window as any).__pixelRebirth.progress.bossDefeated,
    ),
  ).toBe(true);
  await expect(page.locator("#toasts")).toContainText(
    "The Grove Guardian is defeated",
  );
});
