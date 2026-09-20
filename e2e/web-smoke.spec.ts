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
    const source = await worker.text()
    expect(source).toContain("does not cache API responses")
    expect(source).toContain("firebase-messaging-sw.js")
    expect(source).toContain("ALWAYS_NETWORK")
  })

  test("publishes a conservative crawler policy and public sitemap", async ({ request }) => {
    const robots = await request.get("/robots.txt")
    expect(robots.ok()).toBe(true)
    expect(robots.headers()["permissions-policy"]).toContain("microphone=()")
    expect(robots.headers()["content-type"]).toMatch(/text\/plain/i)
    expect(await robots.text()).toContain("Disallow: /v1/")

    const sitemap = await request.get("/sitemap.xml")
    expect(sitemap.ok()).toBe(true)
    expect(sitemap.headers()["content-type"]).toMatch(/application\/xml/i)
    const xml = await sitemap.text()
    expect(xml).toContain("https://kahade.id/")
    expect(xml).not.toContain("/order-link/")
  })

  test("exports route-aware public metadata without private entity data", async ({ request }) => {
    const about = await request.get("/about")
    expect(about.ok()).toBe(true)
    const aboutHtml = await about.text()
    expect(aboutHtml).toContain("<title>Tentang Kahade</title>")
    expect(aboutHtml).toContain('rel="canonical" href="https://kahade.id/about"')

    const order = await request.get("/order/metadata-smoke")
    expect(order.ok()).toBe(true)
    const orderHtml = await order.text()
    expect(orderHtml).toContain("<title>Detail order — Kahade</title>")
    expect(orderHtml).not.toContain("metadata-smoke")
  })
})
