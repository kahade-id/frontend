import { expect, test } from "@playwright/test"
import { mockApi } from "./api-fixtures"
import { tokens } from "../../lib/tokens"
import inventory from "../../docs/audit/inventory.json"
import { AUTHENTICATED_SCREENS } from "../../lib/protected-routes"

const noCrash = async (page: import("@playwright/test").Page) => {
  await expect(page.getByText("Halaman tidak dapat ditampilkan", { exact: true })).toHaveCount(0)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true)
}

test("protected deep links never request financial data without a session", async ({ page }) => {
  const api = await mockApi(page, { authenticated: false })
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto("/wallet")
  await expect(page.getByText("Selamat datang kembali")).toBeVisible()
  expect(api.requests.some((r) => r.path === "/v1/wallet")).toBe(false)
  expect(errors).toEqual([])
})
test("wrong credentials do not trigger a second refresh and tokens stay out of browser storage", async ({
  page,
}) => {
  const api = await mockApi(page, { authenticated: false })
  await page.goto("/login")
  await page.getByLabel("Email", { exact: false }).first().fill("fixture@example.test")
  await page.getByLabel("Kata sandi", { exact: true }).fill("wrong-password")
  const before = api.requests.filter((r) => r.path === "/v1/auth/refresh").length
  await page.getByRole("button", { name: "Masuk", exact: true }).click()
  await expect(page.getByText("Email atau kata sandi salah.", { exact: false })).toBeVisible()
  expect(api.requests.filter((r) => r.path === "/v1/auth/refresh")).toHaveLength(before)
  await page.getByLabel("Kata sandi", { exact: true }).fill("fixture-password")
  await page.getByRole("button", { name: "Masuk", exact: true }).click()
  await expect(page.getByText("Selamat kembali", { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => [
      localStorage.getItem("kahade.auth.accessToken"),
      localStorage.getItem("kahade.auth.refreshToken"),
    ]),
  ).toEqual([null, null])
})
test("wallet integer normalization and unconfirmed status stay honest", async ({ page }) => {
  await mockApi(page)
  await page.goto("/wallet")
  await expect(page.getByText("Rp75.000", { exact: true })).toBeVisible()
  await expect(page.getByText("REVIEWING", { exact: true })).toBeVisible()
  const rowTitle = await page.getByText("Topup", { exact: true }).first().boundingBox()
  expect(rowTitle?.x).toBeCloseTo(tokens.space[6] + tokens.space[10] + tokens.space[3], 0)
  await noCrash(page)
})
test("large wallet histories are virtualized", async ({ page }) => {
  await mockApi(page, { manyTransactions: true })
  await page.goto("/wallet")
  await expect(page.getByText(/TEST-0$/)).toBeVisible()
  await expect(page.getByText(/TEST-119$/)).toHaveCount(0)
  expect(await page.getByText(/TEST-\d+$/).count()).toBeLessThan(120)
})
test("top-up method limits, combined fees and duplicate submit protection", async ({ page }) => {
  const api = await mockApi(page)
  await page.goto("/topup")
  await expect(page.getByText(/0,7%/)).toBeVisible()
  const heading = await page.getByText("Pilih nominal", { exact: true }).boundingBox()
  expect(heading?.x).toBeCloseTo(tokens.layout.screenPaddingX, 0)
  await expect(page.getByRole("radio").first()).toBeEnabled()
  const amount = page.getByRole("textbox").first()
  await amount.fill("50001")
  const pay = page.getByRole("button", { name: "Lanjutkan Pembayaran" })
  await expect(pay).toBeDisabled()
  await amount.fill("50000")
  await expect(pay).toBeEnabled()
  await pay.click()
  await pay.dispatchEvent("click").catch(() => undefined)
  await expect(page.getByText("Menunggu pembayaran", { exact: true }).first()).toBeVisible()
  expect(
    api.requests.filter((r) => r.path === "/v1/wallet/topup" && r.method === "POST"),
  ).toHaveLength(1)
  await noCrash(page)
})
test("late search results cannot overwrite new input", async ({ page }) => {
  const api = await mockApi(page)
  await page.goto("/search")
  const search = page.getByPlaceholder("Cari pengguna, pesanan, atau mutasi")
  await search.fill("lama")
  await expect.poll(() => api.requests.some((r) => r.path === "/v1/search")).toBe(true)
  await search.fill("baru")
  await expect(page.getByText("Hasil baru", { exact: true })).toBeVisible()
  await expect(page.getByText("Hasil lama", { exact: true })).toHaveCount(0)
  await noCrash(page)
})
test("FAQ category exposes all articles and opens the selected article, not always the first", async ({
  page,
}) => {
  await mockApi(page, { authenticated: false })
  await page.goto("/faq")
  await expect(page.getByPlaceholder("Cari bantuan")).not.toBeFocused()
  await page.getByText("Transaksi", { exact: true }).click()
  await expect(page.getByText("Artikel pertama", { exact: true })).toBeVisible()
  await page.getByText("Artikel kedua", { exact: true }).click()
  await expect(page.getByText("Isi lengkap artikel kedua.", { exact: true })).toBeVisible()
  await noCrash(page)
})
test("unknown order roles expose no payment action", async ({ page }) => {
  await mockApi(page, { unknownRole: true })
  await page.goto("/order/test-order")
  await expect(page.getByText("Peran Anda belum terkonfirmasi.", { exact: false })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Bayar/ })).toHaveCount(0)
  await noCrash(page)
})
test("legal and version pages contain no fabricated policy or production channel", async ({
  page,
}) => {
  await mockApi(page, { authenticated: false })
  await page.goto("/privacy-policy")
  await expect(page.getByText("Dokumen resmi belum tersedia", { exact: true })).toBeVisible()
  await expect(page.getByText("Kami tidak menjual data Anda.", { exact: false })).toHaveCount(0)
  await page.goto("/app-version")
  await expect(page.getByText("Tidak terhubung", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Periksa Pembaruan OTA" })).toHaveCount(0)
})
test("mobile, narrow mobile, desktop and dark layouts do not overflow", async ({ page }) => {
  await mockApi(page)
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  for (const [width, height, scheme] of [
    [320, 568, "light"],
    [390, 844, "dark"],
    [1280, 900, "light"],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto("/wallet")
    await expect(page.getByText("Rp75.000", { exact: true })).toBeVisible()
    await noCrash(page)
  }
  expect(errors).toEqual([])
})
test("every authenticated screen handles unavailable APIs without an uncaught rendering error", async ({
  page,
}) => {
  test.setTimeout(300000)
  await mockApi(page, { protectedErrors: true })
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  for (const screen of [
    ...AUTHENTICATED_SCREENS.filter((name) => name !== "(tabs)"),
    "home",
    "transactions",
    "wallet",
    "notifications",
    "settings",
  ]) {
    const path = "/" + screen.replace(/\([^/]+\)\//g, "").replace(/\[[^\]]+\]/g, "test-id")
    await page.goto(path, { waitUntil: "networkidle" })
    await expect
      .poll(async () => (await page.locator("body").innerText()).trim().length)
      .toBeGreaterThan(0)
    await noCrash(page)
  }
  expect(errors).toEqual([])
})

test("first search failure renders a retryable error", async ({ page }) => {
  await mockApi(page, { protectedErrors: true })
  await page.goto("/search")
  await page.getByPlaceholder("Cari pengguna, pesanan, atau mutasi").fill("uji")
  await expect(page.getByText("Gagal mencari", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Coba lagi", exact: false })).toBeVisible()
})
test("all public entry, recovery and legal routes render safely without authentication", async ({
  page,
}) => {
  test.setTimeout(120000)
  await mockApi(page, { authenticated: false })
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const protectedNames = new Set<string>(AUTHENTICATED_SCREENS)
  for (const entry of inventory.routes) {
    const name = entry.file.replace(/^app\//, "").replace(/\.tsx$/, "")
    if (protectedNames.has(name) || name.startsWith("(tabs)/")) continue
    const path =
      name === "+not-found"
        ? "/missing-route-for-audit"
        : entry.route.replace(/\[[^\]]+\]/g, "test-id")
    await page.goto(path, { waitUntil: "networkidle" })
    await expect
      .poll(async () => (await page.locator("body").innerText()).trim().length)
      .toBeGreaterThan(0)
    await noCrash(page)
  }
  expect(errors).toEqual([])
})
