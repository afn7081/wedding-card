import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const panelSelectors = [".hero", ".celebration", ".blessing", ".venue-section", ".closing"];
const address = "Centurion Banquet Hall, 3rd Floor, Haware's Centurion Mall, Sector 19A, Nerul, Navi Mumbai";

async function openInvitation(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open your invitation" }).click();
  await expect(page.locator("#cover")).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small-mobile", width: 320, height: 667 },
]) {
  test(`${viewport.name}: full-screen envelope and viewport-sized panels`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = [];
    const failedRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`);
    });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("#invitation")).toBeHidden();
    await expect(page.locator("#cover")).toHaveText("A&Z");
    const cover = await page.locator("#cover").boundingBox();
    expect(cover).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-envelope.png`) });
    await page.getByRole("button", { name: "Open your invitation" }).click();
    await expect(page.locator("#cover")).toBeHidden();
    await expect(page.locator("#couple-heading")).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-invitation.png`) });
    const header = await page.locator(".site-header").boundingBox();
    const availableHeight = viewport.height - header.height;
    for (const selector of panelSelectors) {
      const panel = page.locator(selector);
      await panel.scrollIntoViewIfNeeded();
      const box = await panel.boundingBox();
      expect.soft(box.height, `${selector} should fit the ${viewport.name} screen`).toBeLessThanOrEqual(availableHeight + 2);
      expect.soft(box.height, `${selector} should fill the ${viewport.name} screen`).toBeGreaterThanOrEqual(availableHeight - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    }
    const allFontsLoaded = await page.evaluate(() => [...document.fonts].every((font) => font.status === "loaded"));
    expect(allFontsLoaded).toBe(true);
    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-full.png`), fullPage: true });
  });
}

test("keyboard opening, closing and reopening preserve accessibility", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Open your invitation" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#couple-heading")).toBeFocused();
  await expect(page).toHaveTitle(/Afnan & Zainab/);
  await page.getByRole("button", { name: "Close invitation" }).click();
  await expect(page.locator("#invitation")).toBeHidden();
  await expect(page.getByRole("button", { name: "Open your invitation" })).toBeFocused();
  await expect(page).toHaveTitle("A special invitation");
  await page.keyboard.press("Space");
  await expect(page.locator("#cover")).toBeHidden();
});

test("the full opening animation reveals the card without interactive controls behind it", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator(".paper-panel")).toHaveCount(2);
  await expect(page.locator(".flap-top, .flap-bottom")).toHaveCount(0);
  const [leftPanel, rightPanel] = await Promise.all([
    page.locator(".flap-left").boundingBox(),
    page.locator(".flap-right").boundingBox(),
  ]);
  expect(leftPanel.x).toBe(0);
  expect(rightPanel.x).toBe(leftPanel.width);
  expect(leftPanel.width).toBe(rightPanel.width);
  expect(leftPanel.width + rightPanel.width).toBe(page.viewportSize().width);
  expect(leftPanel.height).toBe(page.viewportSize().height);
  expect(rightPanel.height).toBe(leftPanel.height);
  await page.getByRole("button", { name: "Open your invitation" }).click();
  await expect(page.locator("#invitation")).toHaveAttribute("inert", "");
  await expect(page.locator("#open-card")).toBeDisabled();
  await page.waitForTimeout(850);
  await page.screenshot({ path: testInfo.outputPath("envelope-opening.png") });
  const rotations = await page.locator(".paper-panel").evaluateAll((panels) =>
    panels.map((panel) => new DOMMatrixReadOnly(getComputedStyle(panel).transform).m13));
  expect(rotations[0] * rotations[1]).toBeLessThan(0);
  expect(await page.locator(".cord-top").evaluate((element) => Number(getComputedStyle(element).opacity))).toBeLessThan(0.2);
  await expect(page.locator("#cover")).toBeHidden({ timeout: 5000 });
  await expect(page.locator("#invitation")).not.toHaveAttribute("inert", "");
  await expect(page.locator(".hero")).toHaveClass(/is-in-view/);
  expect(await page.locator(".lantern-left").evaluate((element) => getComputedStyle(element).animationPlayState)).toBe("running");
  expect(await page.locator(".lantern-left").evaluate((element) => getComputedStyle(element).animationName)).toBe("lantern-sway");
});

test("reduced motion disables lantern, light and star animations", async ({ page }) => {
  await openInvitation(page);
  for (const selector of [".lantern-left", ".lantern-glow", ".ambient-stars span", ".light-drift", ".gold-motes"]) {
    expect(await page.locator(selector).first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  }
});

test("ambient backgrounds animate only when their panel is visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openInvitation(page);
  await expect(page.locator(".hero")).toHaveClass(/is-in-view/);
  expect(await page.locator(".hero .light-drift").evaluate((element) => getComputedStyle(element).animationPlayState)).toBe("running");
  expect(await page.locator(".venue-section .light-drift").evaluate((element) => getComputedStyle(element).animationPlayState)).toBe("paused");
  await page.locator("#venue").scrollIntoViewIfNeeded();
  await expect(page.locator("#venue")).toHaveClass(/is-in-view/);
  await expect(page.locator(".hero")).not.toHaveClass(/is-in-view/);
  expect(await page.locator(".hero .light-drift").evaluate((element) => getComputedStyle(element).animationPlayState)).toBe("paused");
});

test("exact source names, family details and venue are preserved", async ({ page }) => {
  await openInvitation(page);
  await expect(page.locator("#couple-heading")).toContainText("Afnan Khan");
  await expect(page.locator("#couple-heading")).toContainText("Zainab Al Afifa");
  await expect(page.locator(".family-intro")).toContainText("Mr. & Mrs. Aslam Khan");
  await expect(page.locator(".bride-family")).toHaveText("Daughter of Mr. Moidur Rahman & Mrs. Benazir Ara");
  await expect(page.locator(".date-pill")).toContainText("FRIDAY, 4 DECEMBER 2026");
  await expect(page.locator("#venue-address")).toContainText("3rd Floor, Haware’s Centurion Mall,");
  await expect(page.locator(".time-note")).toContainText("check with the family");
  expect(new Date("2026-12-04T12:00:00Z").getUTCDay()).toBe(5);
});

test("calendar reminder is a valid all-day date and has folded UTF-8 lines", async ({ page }) => {
  await openInvitation(page);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save the date" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("Afnan-and-Zainab-4-December-2026.ics");
  const raw = await readFile(await file.path(), "utf8");
  expect(raw).toContain("\r\nDTSTART;VALUE=DATE:20261204\r\n");
  expect(raw).toContain("\r\nDTEND;VALUE=DATE:20261205\r\n");
  expect(raw).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  expect(raw.endsWith("END:VCALENDAR\r\n")).toBe(true);
  for (const line of raw.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
  const unfolded = raw.replace(/\r\n /g, "");
  expect(unfolded).toContain("LOCATION:Centurion Banquet Hall\\, 3rd Floor");
  expect(unfolded).toContain("not an all-day event.");
  expect(unfolded).toContain("TRANSP:TRANSPARENT");
});

test("original PDF download matches the included document", async ({ page }) => {
  await openInvitation(page);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Keep a copy of our invitation" }).click();
  const file = await downloaded;
  const received = await readFile(await file.path());
  const original = await readFile(fileURLToPath(new URL("../assets/wedding-invitation.pdf", import.meta.url)));
  expect(received.equals(original)).toBe(true);
});

test("directions contain the actual venue without invented coordinates", async ({ page }) => {
  await openInvitation(page);
  const link = page.getByRole("link", { name: "Get directions" });
  const url = new URL(await link.getAttribute("href"));
  expect(url.origin).toBe("https://www.google.com");
  expect(url.searchParams.get("api")).toBe("1");
  expect(url.searchParams.get("destination")).toBe("Centurion Banquet Hall, Haware's Centurion Mall, Sector 19A, Nerul, Navi Mumbai");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("copy address succeeds with permission", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openInvitation(page);
  await page.getByRole("button", { name: "Copy address" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
  await expect(page.getByRole("status")).toContainText("Venue address copied");
});

test("copy address reports permission failures rather than false success", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
    });
  });
  await openInvitation(page);
  await page.getByRole("button", { name: "Copy address" }).click();
  await expect(page.getByRole("status")).toContainText("browser blocked copying");
});

for (const scenario of [
  { date: "2026-12-03T18:29:59Z", message: "Some days are worth waiting for.", seconds: "01" },
  { date: "2026-12-03T18:30:00Z", message: "Today, we celebrate together." },
  { date: "2026-12-04T18:30:00Z", message: "Forever grateful for your love and duas." },
]) {
  test(`countdown handles India date boundary ${scenario.date}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(scenario.date));
    await openInvitation(page);
    await expect(page.locator("#countdown-message")).toHaveText(scenario.message);
    if (scenario.seconds) await expect(page.locator("#seconds")).toHaveText(scenario.seconds);
    else await expect(page.locator("#countdown")).toBeHidden();
  });
}

test("direct venue links open the card and synchronize navigation", async ({ page }) => {
  await page.goto("/#venue");
  await expect(page.locator("#cover")).toBeHidden();
  await expect(page.locator('.nav-link[href="#venue"]')).toHaveAttribute("aria-current", "location");
  await page.getByRole("button", { name: "Close invitation" }).click();
  expect(new URL(page.url()).hash).toBe("");
});

test("JavaScript-free access still displays the invitation details", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174");
  await expect(page.locator("#cover")).toBeHidden();
  await expect(page.locator("#couple-heading")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get directions" })).toBeVisible();
  await context.close();
});

test("local file opening works without a web server", async ({ page }) => {
  await page.goto(new URL("../index.html", import.meta.url).href);
  await page.getByRole("button", { name: "Open your invitation" }).click();
  await expect(page.locator("#couple-heading")).toBeVisible();
  await expect(page.locator("#cover")).toBeHidden();
});

test("short landscape screens and large text remain scrollable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await openInvitation(page);
  await page.addStyleTag({ content: "body { zoom: 1.25; }" });
  await page.locator("#venue").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(667);
  await expect(page.getByRole("link", { name: "Get directions" })).toBeVisible();
});
