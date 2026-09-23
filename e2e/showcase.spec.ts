import { expect, test } from "@playwright/test"

/**
 * K-02 (audit Etalase): e2e jalur PUBLIK fitur Etalase.
 *
 * Ruang lingkup smoke web-statis (tanpa kredensial staging):
 *   - tamu bisa MEMBUKA tab /showcase (I-01; sebelum audit tertutup gate),
 *   - route dinamis /showcase/[id] ter-rewrite (200, bukan 404),
 *   - metadata awal tidak membocorkan id item mentah (pola web-smoke),
 *   - galeri publik /user/[u]/showcase ter-rewrite & tidak digate.
 *
 * Alur BER-AUTH penuh (terbit → feed → detail → suka/komentar) membutuhkan
 * akun + API staging: jalankan dengan E2E_BASE_URL mengarah ke staging —
 * dicatat sebagai pekerjaan lanjutan di issues-etalase.md (K-02 bagian auth).
 */
test.describe("etalase — jalur publik tamu", () => {
  test("tab /showcase terbuka untuk tamu (tidak dialihkan ke login)", async ({ page }) => {
    const response = await page.goto("/showcase", { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    // Kebijakan I-01: shell tampil di tempat — BUKAN redirect /login-required.
    await page.waitForLoadState("networkidle").catch(() => {})
    expect(page.url()).not.toMatch(/login-required|\/login\b/)
    await expect(page).toHaveTitle(/Kahade/i)
  })

  test("route detail /showcase/[id] ter-rewrite (200) — corong share", async ({ page }) => {
    const response = await page.goto("/showcase/e2e-showcase-id", { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/Kahade/i)
  })

  test("metadata HTML awal detail tidak menyemat id item mentah", async ({ request }) => {
    const response = await request.get("/showcase/metadata-showcase-id")
    expect(response.ok()).toBe(true)
    const html = await response.text()
    // Judul item hanya di-render klien setelah fetch (useDocumentTitle) —
    // HTML statis tidak boleh membawa id mentah seperti pada /order/*.
    expect(html).not.toContain("<title>metadata-showcase-id")
  })

  test("galeri etalase publik user ter-rewrite & tidak digate (I-05)", async ({ page }) => {
    const response = await page.goto("/user/e2e-user/showcase", { waitUntil: "domcontentloaded" })
    expect(response?.status()).toBe(200)
    await page.waitForLoadState("networkidle").catch(() => {})
    await expect(page).toHaveTitle(/Kahade/i)
  })
})

/** Deterministic API fixtures: no staging credentials or production mutations. */
test.describe("etalase — fixture-driven interactions", () => {
  const author = { userId: "fixture-owner", username: "fixture_seller", fullName: "Fixture Seller" }
  const work = {
    id: "fixture-work", title: "Karya fixture untuk pengujian", description: "Deskripsi karya fixture",
    author, images: [], coverImageUrl: null, priceMin: 0, priceMax: 0,
    likeCount: 4, commentCount: 1, viewCount: 10, isLiked: false, isOwner: false,
    createdAt: "2026-09-23T00:00:00Z", updatedAt: "2026-09-23T00:00:00Z",
  }
  test.beforeEach(async ({ page }) => {
    await page.route("**/v1/**", async route => {
      const path = new URL(route.request().url()).pathname
      const ok = (data: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) })
      if (path.endsWith("/showcase/feed")) return ok({ items: [work], hasMore: false, nextCursor: null, limit: 20, sort: "latest" })
      if (path.endsWith("/showcase/fixture-work/comments")) return ok({ data: [{
        id: "fixture-comment", showcaseId: work.id, content: "Komentar fixture yang terlihat", author, createdAt: work.createdAt, replies: [],
      }], total: 1, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false })
      if (path.endsWith("/showcase/fixture-work")) return ok(work)
      if (path.endsWith("/showcase")) return ok([work])
      return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Fixture guest" }) })
    })
  })
  test("feed renders actual content and navigates to a populated detail", async ({ page }) => {
    await page.goto("/showcase?kind=latest")
    await expect(page.getByText(work.title, { exact: true })).toBeVisible()
    await page.getByText(work.title, { exact: true }).click()
    await expect(page).toHaveURL(/\/showcase\/fixture-work/)
    await expect(page.getByText("Komentar fixture yang terlihat", { exact: true })).toBeVisible()
    await expect(page.getByText("Rp 0", { exact: true })).toBeVisible()
  })
  test("guest comment login carries the original item return path", async ({ page }) => {
    await page.goto("/showcase/fixture-work")
    await page.getByRole("button", { name: "Masuk untuk berkomentar", exact: true }).click()
    await expect(page).toHaveURL(/login-required.*next=/)
    expect(new URL(page.url()).searchParams.get("next")).toBe("/showcase/fixture-work")
  })
  test("guest following settles with login CTA, not a request loop", async ({ page }) => {
    let requests = 0
    page.on("request", request => { if (request.url().includes("/showcase/feed")) requests++ })
    await page.goto("/showcase?kind=following")
    await expect(page.getByText("Masuk untuk melihat feed mengikuti", { exact: true })).toBeVisible()
    expect(requests).toBe(0)
  })
})
