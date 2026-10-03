/**
 * P1-1 (audit perf/UX 2026-10-03): deeplink cold-start — back tidak boleh
 * langsung keluar dari app.
 *
 * Kelima berkas yang disebut audit (`app/[username].tsx`, `app/p/[id].tsx`,
 * `app/v/[code].tsx`, `app/r/[code].tsx`, `app/o/[token].tsx`) ternyata
 * SHIM REDIRECT (satu `<Redirect>`), jadi masalah "back langsung keluar app"
 * ada di LAYAR TUJUAN-nya: pada cold start dari tautan, stack hanya berisi
 * layar itu sehingga `router.back()` no-op (native) / meninggalkan situs
 * (web). Kontraknya:
 *
 *   1. `goBackOrNavigate(ROUTES.showcase)`: pakai riwayat bila ada
 *      (warm-start TIDAK berubah), kalau tidak ADA riwayat → Etalase —
 *      bukan keluar app.
 *   2. Setiap layar tujuan deeplink di atas memasang back EKSPLISIT dengan
 *      fallback tersebut (bukan mengandalkan default yang berbeda-beda).
 *
 * Perilaku `goBackOrNavigate` sendiri diuji di tests/go-back-or-navigate.test.tsx
 * (config komponen, expo-router di-stub); berkas ini mengunci KONTRAK pemakaian
 * di layar tujuan — layar-layarnya terlalu berat untuk dirender di jsdom dan
 * yang bisa regresi di sana adalah pemakaian helper-nya, bukan tampilan.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("P1-1: layar tujuan deeplink punya fallback Etalase eksplisit", () => {
  const root = join(__dirname, "..")
  const destinations: Array<{ entry: string; screen: string }> = [
    { entry: "app/[username].tsx", screen: "components/screens/user-profile-screen.tsx" },
    { entry: "app/p/[id].tsx", screen: "components/screens/showcase-detail-screen.tsx" },
    { entry: "app/v/[code].tsx", screen: "app/vouchers.tsx" },
    { entry: "app/r/[code].tsx", screen: "app/referral.tsx" },
    { entry: "app/o/[token].tsx", screen: "app/order-link/[token].tsx" },
  ]

  it("kelima pintu deeplink masih ada & mengarahkan (bukan layar detail langsung)", () => {
    for (const { entry } of destinations) {
      const source = readFileSync(join(root, entry), "utf8")
      expect(source, entry).toContain("Redirect")
    }
  })

  it("tiap layar tujuan memakai goBackOrNavigate(ROUTES.showcase)", () => {
    for (const { screen } of destinations) {
      const source = readFileSync(join(root, screen), "utf8")
      expect(source, screen).toContain("goBackOrNavigate(ROUTES.showcase")
      // Tidak boleh ada sisa `ROUTES.home` yang berarti tujuan lain
      // (ROUTES.home === /showcase, tetapi kontrak audit menulis Etalase
      // secara eksplisit agar tidak terbaca sebagai "beranda" lain).
      expect(source.includes("goBackOrNavigate(ROUTES.home)"), screen).toBe(false)
    }
  })
})
