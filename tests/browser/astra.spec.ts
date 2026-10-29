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
    const offscreen = [...document.querySelectorAll<HTMLElement>("button, input")]
      .filter((el) => el.offsetParent !== null)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5;
      })
      .map((el) => el.textContent || el.id);
    return { sw: d.scrollWidth, cw: d.clientWidth, sh: d.scrollHeight, ch: d.clientHeight, offscreen };
  });
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(m.sh).toBeLessThanOrEqual(m.ch);
  expect(m.offscreen).toEqual([]);
}

async function expectSpriteDrawn(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>("canvas.sprite")!;
        const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        return px.some((v, i) => i % 4 === 3 && v > 0);
      }),
    )
    .toBe(true);
}

async function create(page: Page, name: string, check = false) {
  await page.getByRole("button", { name: "New Game" }).click();
  if (check) await expectNoScroll(page);
  await page.locator("#hero-name").pressSequentially(name); // real key events, like typing
  await expect(page.locator("#hero-name")).toHaveValue(name);
  await page.getByRole("button", { name: "หญิง" }).click();
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("button", { name: "Ranger" }).click();
  if (check) await expectNoScroll(page);
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("button", { name: "ทรงผม ถัดไป" }).click();
  await page.getByRole("button", { name: "ทรงผม ถัดไป" }).click();
  await expect(page.getByRole("button", { name: /อาวุธ/ })).toHaveCount(0); // weapon follows class
  await expect(page.locator(".hint")).toContainText("ธนู");
  await expectSpriteDrawn(page);
  if (check) await expectNoScroll(page);
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.locator(".draw .btn").click();
    await expect(page.locator(".slot.rolling")).toHaveCount(0); // spin finished
  }
  await expect(page.locator(".draw .btn")).toBeDisabled();
  await expect(page.locator(".slot .talent")).toHaveCount(1); // one slot, last roll kept
  if (check) await expectNoScroll(page);
  const chosen = await page.locator(".slot .talent b").textContent();
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  if (check) await expectNoScroll(page);
  await page.getByRole("button", { name: "เริ่มการผจญภัย" }).click();
  return chosen!;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/astra/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const size of SIZES) {
  test(`every creation screen fits without scrolling: ${size.name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
    await expectNoScroll(page);
    await create(page, "สวย", true);
    await expect(page.locator(".hero-name")).toHaveText("สวย");
    await expectNoScroll(page);
  });
}

test("Continue restores the hero and chosen talent after refresh", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  const talent = await create(page, "สวย");
  await page.reload();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".hero-name")).toHaveText("สวย");
  await expect(page.locator(".meta")).toContainText(`Ranger · ${talent}`);
  const look = await page.evaluate(() => JSON.parse(localStorage.getItem("echoes-of-astra-save")!).hero.look);
  expect(look).toEqual(expect.objectContaining({ hair: "f3", outfit: 11 }));
  expect(look).not.toHaveProperty("weapon");
  await expectSpriteDrawn(page);
});

test("talent roll animates in one slot", async ({ page }) => {
  await page.getByRole("button", { name: "New Game" }).click();
  await page.locator("#hero-name").fill("Hero");
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("button", { name: "Cleric" }).click();
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await expect(page.locator(".hint")).toContainText("กระบอง");
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.locator(".draw .btn").click();
  await expect(page.locator(".slot.rolling")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "ถัดไป", exact: true })).toBeDisabled();
  await expect(page.locator(".slot.landed .talent")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "ถัดไป", exact: true })).toBeEnabled();
});

test("text stays light even if the host page styles body dark", async ({ page }) => {
  await page.addStyleTag({ content: "body { color: #000 } input { color: #000 }" });
  await page.getByRole("button", { name: "New Game" }).click();
  await page.locator("#hero-name").pressSequentially("ทดสอบ");
  const fill = await page.locator("#hero-name").evaluate((el) => getComputedStyle(el).webkitTextFillColor);
  expect(fill).toBe("rgb(238, 241, 248)");
  await page.getByRole("button", { name: "ถัดไป", exact: true }).click();
  await page.getByRole("button", { name: "Knight" }).click();
  const dd = await page.locator(".stats dd").first().evaluate((el) => getComputedStyle(el).color);
  expect(dd).toBe("rgb(238, 241, 248)");
});

test("New Game asks before overwriting a save and Cancel keeps it", async ({ page }) => {
  await create(page, "First");
  await page.getByRole("button", { name: "กลับหน้าแรก" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("First");
  await page.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(page.locator("#continue-note")).toContainText("First");
});

test("names are validated and rendered as text", async ({ page }) => {
  await page.getByRole("button", { name: "New Game" }).click();
  const next = page.getByRole("button", { name: "ถัดไป", exact: true });
  await expect(next).toBeDisabled();
  await page.locator("#hero-name").fill("ก".repeat(17));
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "ยกเลิก" }).click();
  await create(page, "<b>x</b>");
  await expect(page.locator(".hero-name")).toHaveText("<b>x</b>");
  await expect(page.locator(".hero-name b")).toHaveCount(0);
});
