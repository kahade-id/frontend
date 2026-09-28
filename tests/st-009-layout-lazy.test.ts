/**
 * ST-009 (PERF-FIX 2026-09-29): kunci import lazy di root layout.
 *
 * Root layout dievaluasi seluruhnya saat boot native (semua modul rute
 * dievaluasi sinkron — batasan Expo), jadi setiap import statis berat di
 * sini mencuri waktu first paint. Test ini mengunci dua konversi ST-009:
 *
 * 1. `@/lib/web-push` TIDAK boleh diimpor statis — varian web-nya menarik
 *    `firebase/app` + `firebase/messaging` ke chunk entry web. Ia harus
 *    dimuat via dynamic `import()` di dalam efek web.
 * 2. `<GuestLoginPrompt>` (hanya untuk tamu web di rute terproteksi, bukan
 *    first paint) harus dimuat via `React.lazy`, bukan import statis.
 *
 * Pengecualian yang disengaja (terdokumentasi di kode, jangan "diperbaiki"):
 * - `@/lib/push-notifications` tetap statis — subscribeNotificationOpened
 *   harus terpasang di efek boot segera (cold-start tap notifikasi).
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = dirname(fileURLToPath(import.meta.url))
const layoutSrc = readFileSync(
  resolve(root, "..", "app", "_layout.tsx"),
  "utf8",
)

describe("st-009 root layout lazy imports", () => {
  it("tidak ada import statis @/lib/web-push", () => {
    expect(layoutSrc).not.toMatch(
      /^import\s+.*from\s*["']@\/lib\/web-push["']/m,
    )
  })

  it("web-push dimuat via dynamic import di efek web", () => {
    expect(layoutSrc).toContain('import("@/lib/web-push")')
  })

  it("GuestLoginPrompt dimuat via React.lazy, bukan import statis", () => {
    expect(layoutSrc).not.toMatch(
      /^import\s+\{\s*GuestLoginPrompt\s*\}\s*from/m,
    )
    expect(layoutSrc).toMatch(
      /lazy\(\(\)\s*=>\s*import\(["']@\/components\/web-guest-gate["']\)/,
    )
  })

  it("push-notifications tetap statis (cold-start, disengaja)", () => {
    expect(layoutSrc).toMatch(
      /^import\s+.*from\s*["']@\/lib\/push-notifications["']/m,
    )
  })
})
