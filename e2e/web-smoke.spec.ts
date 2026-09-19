import { expect, test } from "@playwright/test"

test.describe("web release smoke", () => {
  test("serves the app shell with installable metadata", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(page).toHaveTitle(/Kahade/i)
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.json")
    await expect(page.locator("body")).not.toBeEmpty()
  })

  test("rewrites a dynamic public route instead of returning 404", async ({ page }) => {
    const response = await page.goto("/order/e2e-smoke", { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Kahade/i)
  })

  test("serves deep-link verification files as JSON", async ({ request }) => {
    const assetLinks = await request.get("/.well-known/assetlinks.json")
    const aasa = await request.get("/.well-known/apple-app-site-association")
    expect(assetLinks.headers()["content-type"]).toMatch(/application\/json/i)
    expect(aasa.headers()["content-type"]).toMatch(/application\/json/i)
  })

  test("serves the privacy-safe PWA service worker", async ({ request }) => {
    const worker = await request.get("/sw.js")
    expect(worker.ok()).toBe(true)
    expect(await worker.text()).toContain("does not cache API responses")
  })
})
