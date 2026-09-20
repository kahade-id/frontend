import { defineConfig, devices } from "@playwright/test"

/**
 * E2E hanya memindai direktori e2e/; suite Vitest di tests/ tidak boleh ikut
 * terbaca oleh Playwright. Untuk CI tanpa staging, suite smoke memakai export
 * web statis lokal. Set E2E_BASE_URL untuk menguji deployment/staging nyata.
 */
const externalBaseUrl = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:8081",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run build:web && npm run preview:web",
        url: "http://127.0.0.1:8081",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
