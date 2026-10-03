/**
 * P1-1 (audit perf/UX 2026-10-03): kontrak back `goBackOrNavigate`.
 *
 * Deeplink cold-start (tautan share /p/<id>, /<username>, /v/<code>, …) hanya
 * menyisakan SATU entri di stack. `router.back()` di kondisi itu no-op di
 * native dan justru meninggalkan situs di web — helper inilah yang membuat
 * back selalu berujung masuk akal: riwayat bila ada, Etalase bila tidak.
 *
 * Dijalankan di config komponen karena `lib/navigation` mengimpor expo-router
 * (di-stub di sini). Kontrak pemakaian helper di layar-layar tujuan dikunci di
 * tests/deeplink-back-contract.test.ts.
 */
import { describe, expect, it } from "vitest"

import { goBackOrNavigate, type BackNavigator } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"

/**
 * Navigator palsu — sengaja TANPA `vi.fn()` agar tipe `BackNavigator` tetap
 * jujur: yang diperiksa test ini adalah urutan keputusan, bukan spy.
 */
function fakeNavigator(canGoBack: boolean) {
  const calls = { back: 0, replace: [] as unknown[] }
  const nav: BackNavigator = {
    canGoBack: () => canGoBack,
    back: () => {
      calls.back += 1
    },
    replace: (href) => {
      calls.replace.push(href)
    },
  }
  return { nav, calls }
}

describe("P1-1: goBackOrNavigate(ROUTES.showcase)", () => {
  it("warm-start: riwayat ada → back() dan TIDAK replace", () => {
    const { nav, calls } = fakeNavigator(true)
    goBackOrNavigate(ROUTES.showcase, nav)
    expect(calls.back).toBe(1)
    expect(calls.replace).toEqual([])
  })

  it("cold-start deeplink: tanpa riwayat → replace ke Etalase", () => {
    const { nav, calls } = fakeNavigator(false)
    goBackOrNavigate(ROUTES.showcase, nav)
    expect(calls.back).toBe(0)
    expect(calls.replace).toEqual([ROUTES.showcase])
  })
})
