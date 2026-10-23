import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (
      !localStorage.getItem("pixel-rebirth-lineage-v4") &&
      !localStorage.getItem("pixel-rebirth-solo-v3")
    ) {
      localStorage.setItem(
        "pixel-rebirth-solo-v3",
        JSON.stringify({
          version: 3,
          level: 1,
          xp: 0,
          gold: 150,
          potions: 5,
          unlocked: 0,
          cleared: [],
          sound: false,
          builds: [
            {
              id: "ash",
              name: "ผู้เดินทาง",
              classId: "warden",
              talents: { might: 0, vitality: 0, spirit: 0, haste: 0 },
              upgraded: false,
            },
          ],
        }),
      );
    }
  });
  await page.goto("/");
  await expect(page.locator("#game canvas")).toBeVisible();
  await expect(page.locator("#loading")).toHaveCount(0);
});

test("one hero, detailed artwork and true high-DPI backing buffer load cleanly", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator(".party-card")).toHaveCount(1);
  const s = await page.evaluate(() => {
    const r = (window as any).__pixelRebirth,
      c = document.querySelector("canvas")!,
      box = c.getBoundingClientRect();
    return {
      heroes: r.battle.actors.filter((a: any) => a.side === "party").length,
      enemies: r.battle.actors.filter((a: any) => a.side === "enemy").length,
      ratio: c.width / box.width,
      dpr: devicePixelRatio,
      texture: r.scene.textures.get("battle-warden").getSourceImage().height,
      enemyArt: r.scene.textures.exists("enemy-sheet"),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(s.heroes).toBe(1);
  expect(s.enemies).toBe(1);
  expect(s.ratio).toBeGreaterThanOrEqual(Math.min(s.dpr, 3) - 0.02);
  expect(s.texture).toBe(576);
  expect(s.enemyArt).toBe(true);
  expect(s.overflow).toBe(false);
  expect(errors).toEqual([]);
});

test("boosted attack, opponent response and return to your turn work", async ({
  page,
}) => {
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
            (a: any) => a.side === "enemy",
          ).hp,
      ),
    )
    .toBeLessThan(155);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__pixelRebirth.battle.actors.find(
            (a: any) => a.side === "party",
          ).hp,
      ),
    )
    .toBeLessThan(252);
  await expect(
    page.getByRole("button", { name: "Attack / โจมตี", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.find(
          (a: any) => a.side === "party",
        ).bp,
    ),
  ).toBe(1);
});

test("you can name, build and upgrade just your own character and reload it", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "ตัวละครของฉัน", exact: true })
    .click();
  await page.locator("#hero-name-input").fill("นักดาบดาว");
  await page.getByRole("button", { name: "บันทึกชื่อ", exact: true }).click();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Allocate might", exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "Allocate might", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Class Starweaver", exact: true })
    .click();
  await page.locator("#upgrade-weapon").click();
  await expect(page.locator("#gold-value")).toHaveText("50");
  await page.locator("#apply-build").click();
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.filter(
          (a: any) => a.side === "party",
        ).length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.find(
          (a: any) => a.side === "party",
        ).attack,
    ),
  ).toBe(51);
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator(".hero-card-name")).toContainText("นักดาบดาว");
  await expect(page.locator(".party-card")).toHaveCount(1);
  await expect(page.locator("#gold-value")).toHaveText("50");
});

test("self-healing and immediate consumable persistence work", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Potion / ใช้ยา", exact: true })
    .click();
  await expect(page.locator("#toasts")).toContainText("HP ของคุณเต็มแล้ว");
  await expect(page.locator("#potion-count")).toHaveText("×5");
  await page.evaluate(
    () =>
      ((window as any).__pixelRebirth.battle.actors.find(
        (a: any) => a.side === "party",
      ).hp = 10),
  );
  await page
    .getByRole("button", { name: "Potion / ใช้ยา", exact: true })
    .click();
  await expect(page.locator("#potion-count")).toHaveText("×4");
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.find(
          (a: any) => a.side === "party",
        ).hp,
    ),
  ).toBe(100);
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator("#potion-count")).toHaveText("×4");
});

test("job skill can be cast by the single hero", async ({ page }) => {
  await page
    .getByRole("button", { name: "ตัวละครของฉัน", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Class Starweaver", exact: true })
    .click();
  await page.locator("#apply-build").click();
  await page
    .getByRole("button", { name: "Skills / ทักษะ", exact: true })
    .click();
  await page.getByRole("button", { name: /Astral Rain/ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__pixelRebirth.battle.actors.find(
            (a: any) => a.side === "enemy",
          ).hp,
      ),
    )
    .toBeLessThan(155);
  await expect(
    page.getByRole("button", { name: "Attack / โจมตี", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.find(
          (a: any) => a.side === "party",
        ).mp,
    ),
  ).toBeLessThan(90);
});

test("old party save is preserved and migrated without losing progression", async ({
  page,
}) => {
  const old = await page.evaluate(() => {
    const r = (window as any).__pixelRebirth,
      s = structuredClone(r.save);
    const hero = s.builds[0];
    s.version = 2;
    s.level = 3;
    s.xp = 20;
    s.gold = 225;
    s.unlocked = 2;
    s.cleared = [0, 1];
    s.builds = [
      { ...hero, name: "Ash" },
      {
        ...hero,
        id: "lyra",
        name: "Lyra",
        classId: "arcanist",
        upgraded: true,
      },
      { ...hero, id: "kael", name: "Kael", classId: "ranger" },
    ];
    return s;
  });
  await page.addInitScript((old) => {
    localStorage.setItem("pixel-rebirth-tactics-v2", JSON.stringify(old));
    localStorage.removeItem("pixel-rebirth-solo-v3");
    localStorage.removeItem("pixel-rebirth-lineage-v4");
  }, old);
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator("#gold-value")).toHaveText("225");
  await expect(page.locator("#level-value")).toHaveText("3");
  await expect(page.locator(".party-card")).toHaveCount(1);
  const saved = await page.evaluate(() => ({
    old: JSON.parse(localStorage.getItem("pixel-rebirth-tactics-v2")!).builds
      .length,
    new: JSON.parse(localStorage.getItem("pixel-rebirth-lineage-v4")!).builds
      .length,
    upgrade: (window as any).__pixelRebirth.save.builds[0].upgraded,
  }));
  expect(saved).toEqual({ old: 3, new: 1, upgrade: true });
});

test("high-DPI targeting remains accurate and canvas resizes on phone rotation", async ({
  page,
}, info) => {
  const position = await page.evaluate(() => {
    const r = (window as any).__pixelRebirth,
      v = r.scene.children.list.find(
        (v: any) => v.texture?.key === "battle-sentinel",
      ),
      box = v.getBounds(),
      canvas = document.querySelector("canvas")!.getBoundingClientRect();
    r.scene.selected = "";
    return { x: canvas.left + box.centerX, y: canvas.top + box.centerY };
  });
  if (info.project.name === "mobile")
    await page.touchscreen.tap(position.x, position.y);
  else await page.mouse.click(position.x, position.y);
  expect(
    await page.evaluate(() => (window as any).__pixelRebirth.scene.selected),
  ).toBe("sentinel");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector("canvas")!,
          p = document.querySelector("#game")!.getBoundingClientRect(),
          b = c.getBoundingClientRect();
        return (
          Math.abs(b.width - p.width) < 1 && Math.abs(b.height - p.height) < 1
        );
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".party-card")).toHaveCount(1);
});

test("solo character wins a real encounter and unlocks the next", async ({
  page,
}) => {
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
  await expect(
    page.getByRole("heading", { name: "The Sunken Archive", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as any).__pixelRebirth.battle.actors.filter(
          (a: any) => a.side === "party",
        ).length,
    ),
  ).toBe(1);
});
