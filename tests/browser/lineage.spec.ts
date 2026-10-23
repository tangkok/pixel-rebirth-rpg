import { test, expect, type Page } from "@playwright/test";
import { freshTactics } from "../../src/game/tactics";
import {
  CLASSES,
  CLASS_IDS,
  RACES,
  type ClassId,
} from "../../src/game/lineage";
async function load(page: Page, job?: ClassId, level = 1) {
  if (job) {
    const s = freshTactics();
    s.created = true;
    s.builds[0].raceId = "human";
    s.builds[0].classId = job;
    s.level = level;
    await page.addInitScript((s) => {
      if (!localStorage.getItem("pixel-rebirth-lineage-v4"))
        localStorage.setItem("pixel-rebirth-lineage-v4", JSON.stringify(s));
    }, s);
  }
  await page.goto("/");
  await expect(page.locator("#loading")).toHaveCount(0);
}
const snapshot = (page: Page) =>
  page.evaluate(() => {
    const r = (window as any).__pixelRebirth;
    return {
      save: r.save,
      actor: r.battle.actors.find((a: any) => a.side === "party"),
      enemy: r.battle.actors.find((a: any) => a.side === "enemy"),
      presentation: r.scene.presentation,
    };
  });
test("new character creator offers six jobs, weighted races, and a persistent personal identity", async ({
  page,
}) => {
  await load(page);
  await expect(page.locator("#panel")).toBeVisible();
  await expect(page.locator("[data-create-class]")).toHaveCount(6);
  await expect(page.locator("#begin-journey")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.locator("#panel")).toBeVisible();
  await page.locator("#create-name").fill("นักรบแสงดาว");
  await page.locator('[data-create-class="berserker"]').click();
  await expect(page.locator("#create-name")).toHaveValue("นักรบแสงดาว");
  await page.locator("#roll-race").click();
  await expect(page.locator("#roll-race")).toContainText("ฟรี 2 ครั้ง");
  await page.locator(".race-odds summary").click();
  await expect(page.locator(".race-entry")).toHaveCount(15);
  await expect(
    page.locator(".race-entry").filter({ hasText: "ปฐมเทพ" }),
  ).toContainText("0.5%");
  await page.locator("#begin-journey").click();
  await expect(page.locator("#panel")).not.toBeVisible();
  const state = await snapshot(page);
  expect(state.save.created).toBe(true);
  expect(state.actor.name).toBe("นักรบแสงดาว");
  expect(state.actor.classId).toBe("berserker");
  expect(RACES.some((r) => r.id === state.save.builds[0].raceId)).toBe(true);
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  await expect(page.locator("#panel")).not.toBeVisible();
  await expect(page.locator(".party-card")).toHaveCount(1);
  await expect(page.locator(".party-card")).toContainText("นักรบแสงดาว");
});
test("a lineage roll persists before creation and cannot be refreshed for free", async ({
  page,
}) => {
  await load(page);
  await page.locator("#roll-race").click();
  const before = (await snapshot(page)).save;
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  const after = (await snapshot(page)).save;
  expect(after.builds[0].raceId).toBe(before.builds[0].raceId);
  expect(after.raceRolls).toBe(2);
  await expect(page.locator("#roll-race")).toContainText("ฟรี 2 ครั้ง");
});
test("stat points, ability upgrades, and a secondary job work together and survive reload", async ({
  page,
}) => {
  await load(page, "warden", 2);
  await page
    .getByRole("button", { name: "ตัวละครของฉัน", exact: true })
    .click();
  await page.locator('[data-subclass="arcanist"]').click();
  await page.locator("#upgrade-skill").click();
  await page.locator('[data-talent="spirit"]').click();
  await expect(page.locator("#ability-points")).toHaveText("0 AP");
  await page.locator("#apply-build").click();
  const before = await snapshot(page);
  expect(before.actor.subClassId).toBe("arcanist");
  expect(before.actor.skillRank).toBe(1);
  await page.locator("#skill-toggle").click();
  await expect(page.locator("[data-skill]")).toHaveCount(3);
  await page.locator('[data-skill="secondary"]').click();
  await expect
    .poll(async () => (await snapshot(page)).enemy.hp)
    .toBeLessThan(before.enemy.hp);
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  const after = await snapshot(page);
  expect(after.save.builds[0].subClassId).toBe("arcanist");
  expect(after.save.builds[0].skillRank).toBe(1);
  expect(after.save.builds[0].talents.spirit).toBe(1);
});
for (const cls of CLASS_IDS) {
  test(`${cls} changes body pose, shows its combat effect, and returns to idle`, async ({
    page,
  }) => {
    await load(page, cls, 2);
    const before = await snapshot(page);
    await page.locator("#skill-toggle").click();
    await page.locator('[data-skill="skill"]').click();
    await expect
      .poll(async () => (await snapshot(page)).presentation.pose, {
        intervals: [20, 40, 60],
      })
      .toBe("action");
    const pose = await page.evaluate(() => {
      const r = (window as any).__pixelRebirth;
      return r.scene.children.list.some(
        (o: any) =>
          o.texture?.key === `battle-${r.save.builds[0].classId}-action`,
      );
    });
    expect(pose).toBe(true);
    await expect
      .poll(async () => (await snapshot(page)).presentation.effectsSpawned)
      .toBeGreaterThan(0);
    await expect(page.locator('[data-action="attack"]')).toBeEnabled();
    const after = await snapshot(page);
    expect(after.enemy.hp).toBeLessThan(before.enemy.hp);
    expect(after.actor.mp).toBeLessThan(before.actor.mp);
    await expect
      .poll(async () => (await snapshot(page)).presentation.phase)
      .toBe("idle");
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).__pixelRebirth.scene.activeEffectCount,
        ),
      )
      .toBe(0);
    expect(
      await page.evaluate(() => {
        const r = (window as any).__pixelRebirth;
        return r.scene.children.list.some(
          (o: any) => o.texture?.key === `battle-${r.save.builds[0].classId}`,
        );
      }),
    ).toBe(true);
  });
}
test("landscape dock stays outside the arena and all touch commands fit the viewport", async ({
  page,
}) => {
  await load(page, "warden");
  for (const [width, height] of [
    [1280, 591],
    [844, 390],
    [667, 320],
    [1024, 600],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.evaluate(() =>
          Math.abs(
            document.querySelector("#game canvas")!.getBoundingClientRect()
              .height -
              document.querySelector("#game")!.getBoundingClientRect().height,
          ),
        ),
      )
      .toBeLessThan(1);
    const bounds = await page.evaluate(() => {
      const field = document
          .querySelector(".battlefield")!
          .getBoundingClientRect(),
        dock = document.querySelector(".battle-hud")!.getBoundingClientRect();
      const commands = [
        ...document.querySelectorAll(".command-grid button"),
      ].map((el) => {
        const b = el.getBoundingClientRect();
        return {
          x: b.x,
          y: b.y,
          w: b.width,
          h: b.height,
          right: b.right,
          bottom: b.bottom,
        };
      });
      return {
        fieldBottom: field.bottom,
        dockTop: dock.top,
        commands,
        overflow:
          document.documentElement.scrollWidth > innerWidth ||
          document.documentElement.scrollHeight > innerHeight,
      };
    });
    expect(bounds.dockTop).toBeGreaterThanOrEqual(bounds.fieldBottom - 1);
    expect(bounds.overflow).toBe(false);
    for (const c of bounds.commands) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.bottom).toBeLessThanOrEqual(height);
      expect(c.right).toBeLessThanOrEqual(width);
      expect(c.h).toBeGreaterThanOrEqual(44);
    }
  }
  await page.locator('[data-action="guard"]').click();
  await expect
    .poll(async () => (await snapshot(page)).presentation.style)
    .toBe("guard");
  await expect(page.locator('[data-action="attack"]')).toBeEnabled();
});
test("reduced motion can be selected and is saved", async ({ page }) => {
  await load(page, "warden");
  await page.getByRole("button", { name: "Settings / ตั้งค่า" }).click();
  await page.locator("#settings-motion").click();
  await expect(page.locator("#settings-motion")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await expect(page.locator("#loading")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as any).__pixelRebirth.scene.reducedMotion,
    ),
  ).toBe(true);
});
