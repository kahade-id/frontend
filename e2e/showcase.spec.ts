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
