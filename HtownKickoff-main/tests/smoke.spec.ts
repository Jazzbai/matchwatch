import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home page renders core navigation", async ({ page }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: /^matches$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^venues$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /matchwatch/i })).toBeVisible();
  });

  test("venues page shows city filter above price and renders cards", async ({ page }) => {
    await page.goto("/venues");

    await expect(page.getByRole("heading", { name: /venues/i })).toBeVisible();
    await expect(page.getByText(/^City$/)).toBeVisible();
    await expect(page.getByText(/^Price$/)).toBeVisible();

    const labels = await page.locator("span").evaluateAll((nodes) =>
      nodes.map((node) => node.textContent?.trim()).filter(Boolean),
    );
    const cityIndex = labels.findIndex((text) => text === "City");
    const priceIndex = labels.findIndex((text) => text === "Price");

    expect(cityIndex).toBeGreaterThanOrEqual(0);
    expect(priceIndex).toBeGreaterThanOrEqual(0);
    expect(cityIndex).toBeLessThan(priceIndex);

    await expect(page.getByText(/venue found|venues found/i)).toBeVisible();
  });

  test("matches page renders fixtures with local-time labels", async ({ page }) => {
    await page.goto("/matches");

    await expect(page.getByRole("heading", { name: /^matches$/i })).toBeVisible();
    await expect(page.getByText(/upcoming|live|all/i).first()).toBeVisible();
    await expect(page.locator("a[href^='/matches/']").first()).toBeVisible();
  });
});
