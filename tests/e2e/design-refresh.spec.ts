import { expect, test } from "@playwright/test"
import { mockApi } from "./api-fixtures"

test("wallet privacy hides both available and held funds", async ({ page }) => {
  await mockApi(page)
  await page.goto("/wallet")
  await expect(page.getByText("Rp75.000", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Sembunyikan saldo", exact: true }).click()
  await expect(page.getByLabel("Nominal disembunyikan, ketuk ikon mata untuk menampilkan", { exact: true })).toHaveCount(2)
  await page.getByRole("button", { name: "Tampilkan saldo", exact: true }).click()
  await expect(page.getByText("Rp75.000", { exact: true })).toBeVisible()
})
test("tab destinations retain selection and financial navigation", async ({ page }) => {
  await mockApi(page)
  await page.goto("/home")
  await expect(page.getByRole("button", { name: "Buat Transaksi", exact: true })).toBeVisible()
  await page.getByRole("tab", { name: "Tab Dompet", exact: true }).click()
  await expect(page.getByRole("tab", { name: "Tab Dompet", exact: true })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByText("Rp75.000", { exact: true })).toBeVisible()
})
for (const width of [320, 390, 1280]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`overview ${width}px ${colorScheme} has no page overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" })
      await mockApi(page)
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.goto("/home")
      await expect(page.getByRole("button", { name: "Buat Transaksi", exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      expect(errors).toEqual([])
    })
  }
}
