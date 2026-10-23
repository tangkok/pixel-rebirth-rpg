import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#game canvas")).toBeVisible();
  await expect(page.locator("#loading")).toHaveCount(0);
});

test("HD-2D arena loads without errors, overflow, or unsolicited turns", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "The Hollow Sanctuary", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Attack / โจมตี", exact: true }),
  ).toBeEnabled();
  await page.waitForTimeout(700);
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.battle.cursor),
  ).toBe(0);
  expect(
    await page.evaluate(() =>
      (window as any).__pixelRebirth.scene.textures.exists("sanctuary"),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      (window as any).__pixelRebirth.scene.textures.exists("hero-sheet"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("target selection, boost, attack and turn advancement work through UI", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Next target", exact: true }).click();
  await expect(page.locator("#target-name")).toHaveText("Astral Wisp");
  await page
    .getByRole("button", { name: "Previous target", exact: true })
    .click();
  await expect(page.locator("#target-name")).toHaveText("Hollow Sentinel");
  await page.locator("#boost").click();
  await expect(page.locator("#boost")).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Attack / โจมตี", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__pixelRebirth.battle.actors.find(
            (a: any) => a.id === "sentinel",
          ).hp,
      ),
    )
    .toBeLessThan(155);
  await expect(page.locator("#actor-name")).toContainText("Lyra");
  await expect(
    page.getByRole("button", { name: "Attack / โจมตี", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.find(
          (a: any) => a.id === "kael",
        ).bp,
    ),
  ).toBe(1);
});

test("arcanist skill damages every enemy and enemy AI answers", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Attack / โจมตี", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Skills / ทักษะ", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Skills / ทักษะ", exact: true })
    .click();
  await page.getByRole("button", { name: /Astral Rain/ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__pixelRebirth.battle.actors.filter(
            (a: any) => a.side === "enemy" && a.hp < a.maxHp,
          ).length,
      ),
    )
    .toBe(3);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__pixelRebirth.battle.actors.some(
          (a: any) => a.side === "party" && a.hp < a.maxHp,
        ),
      ),
    )
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "Attack / โจมตี", exact: true }),
  ).toBeEnabled();
});

test("build choices, talent limits, equipment, application and persistence", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Party & builds", exact: true })
    .click();
  await expect(page.locator("#panel")).toBeVisible();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Allocate might", exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "Allocate might", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#talent-points")).toHaveText("0 AVAILABLE");
  await page
    .getByRole("button", { name: "Class Starweaver", exact: true })
    .click();
  await page.locator("#upgrade-weapon").click();
  await expect(page.locator("#upgrade-weapon")).toBeDisabled();
  await expect(page.locator("#gold-value")).toHaveText("50");
  await page.locator("#apply-build").click();
  await expect(page.locator("#panel")).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.find(
          (a: any) => a.id === "ash",
        ).classId,
    ),
  ).toBe("arcanist");
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.find(
          (a: any) => a.id === "ash",
        ).attack,
    ),
  ).toBe(43);
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator("#gold-value")).toHaveText("50");
  expect(
    await page.evaluate(
      () => (window as any).__pixelRebirth.save.builds[0].talents.might,
    ),
  ).toBe(3);
});

test("full-health potion does not spend a turn and an injured ally can be revived", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Potion / ใช้ยา", exact: true })
    .click();
  await expect(page.locator("#toasts")).toContainText("HP เต็ม");
  await expect(page.locator("#potion-count")).toHaveText("×5");
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.battle.cursor),
  ).toBe(0);
  await page.evaluate(() => {
    (window as any).__pixelRebirth.battle.actors.find(
      (a: any) => a.id === "ash",
    ).hp = 0;
  });
  await page
    .getByRole("button", { name: "Potion / ใช้ยา", exact: true })
    .click();
  await expect(page.locator("#potion-count")).toHaveText("×4");
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.find(
          (a: any) => a.id === "ash",
        ).hp,
    ),
  ).toBe(90);
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator("#potion-count")).toHaveText("×4");
});

test("dialogs stop turn scheduling and settings shop, sounds and reset confirmation work", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Attack / โจมตี", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Attack / โจมตี", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  const cursor = await page.evaluate(
    () => (window as any).__pixelRebirth.battle.cursor,
  );
  await page.waitForTimeout(900);
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.battle.cursor),
  ).toBe(cursor);
  await page
    .getByRole("button", { name: "Close dialog / ปิด", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Settings / ตั้งค่า", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle game sound", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Toggle game sound", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator("#buy-potion").click();
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.save.potions),
  ).toBe(6);
  await expect(page.locator("#gold-value")).toHaveText("125");
  await page.locator("#reset-save").click();
  await page.locator("#cancel-reset").click();
  await expect(page.locator("#panel")).toContainText("A moment of quiet.");
});

test("real turns complete an encounter, reward once and unlock the next chapter", async ({
  page,
}) => {
  await page.evaluate(() => {
    const r = (window as any).__pixelRebirth;
    r.save.level = 10;
    r.startBattle(0);
  });
  await page
    .getByRole("button", { name: "Toggle battle speed", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle auto battle", exact: true })
    .click();
  await expect(page.locator("#result")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#result")).toContainText("Victory");
  await expect(page.locator("#gold-value")).toHaveText("210");
  await page.locator("#next-battle").click();
  await expect(page.locator("#result")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "The Sunken Archive", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.save.unlocked),
  ).toBe(1);
});

test("defeat offers a working retry and mobile commands can be tapped", async ({
  page,
}, info) => {
  await page.evaluate(() => {
    const r = (window as any).__pixelRebirth,
      b = r.battle;
    b.actors
      .filter((a: any) => a.side === "party")
      .forEach((a: any) => (a.hp = a.id === "ash" ? 1 : 0));
    b.cursor = b.queue.indexOf("wisp");
  });
  await page
    .getByRole("button", { name: "Toggle auto battle", exact: true })
    .click();
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#result")).toContainText("Rise again");
  await page.locator("#next-battle").click();
  await expect(page.locator("#result")).toBeHidden();
  const attack = page.getByRole("button", {
    name: "Attack / โจมตี",
    exact: true,
  });
  await expect(attack).toBeEnabled();
  if (info.project.name === "mobile") await attack.tap();
  else await attack.click();
  await expect(page.locator("#actor-name")).toContainText("Lyra");
});
