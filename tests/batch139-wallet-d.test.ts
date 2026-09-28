/**
 * Batch 139 — TIM FE139-WALLET, area D (Dompet & Transaksi), Wave 1.
 *
 * D01: preferensi visibility saldo terhidrasi sinkron dari localStorage web
 *      (tanpa flash "terbuka" setelah restart).
 * D18: filter tab Transaksi disimpan per akun — logout mengembalikan
 *      transactionsTab ke default, bukan mewarisi akun sebelumnya.
 */
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest"

import {
  clearAccountPrefs,
  getUiPrefsSnapshot,
  hydrateUiPrefsSync,
  resetUiPrefsForTest,
  setUiPrefs,
} from "@/lib/ui-prefs"
import { SecureKeys } from "@/lib/secure-storage"

function installFakeWindow(stored: string | null) {
  const store = new Map<string, string>()
  if (stored != null) store.set(SecureKeys.uiPrefs, stored)
  const fakeWindow = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  }
  vi.stubGlobal("window", fakeWindow)
  return store
}

describe("D01 — hydrateUiPrefsSync", () => {
  beforeEach(() => {
    resetUiPrefsForTest()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    resetUiPrefsForTest()
  })

  it("membaca balanceHidden=true dari localStorage tanpa menunggu async", () => {
    installFakeWindow(JSON.stringify({ balanceHidden: true }))
    hydrateUiPrefsSync()
    expect(getUiPrefsSnapshot().balanceHidden).toBe(true)
  })

  it("default false bila tidak ada nilai tersimpan", () => {
    installFakeWindow(null)
    hydrateUiPrefsSync()
    expect(getUiPrefsSnapshot().balanceHidden).toBe(false)
  })

  it("nilai rusak diabaikan (fail-closed ke default)", () => {
    installFakeWindow("{bukan json")
    hydrateUiPrefsSync()
    expect(getUiPrefsSnapshot().balanceHidden).toBe(false)
  })

  it("no-op tanpa window (native / node)", () => {
    // window tidak di-stub di sini
    hydrateUiPrefsSync()
    expect(getUiPrefsSnapshot().balanceHidden).toBe(false)
  })
})

describe("D18 — filter transaksi per akun", () => {
  beforeEach(() => {
    resetUiPrefsForTest()
  })
  afterEach(() => {
    resetUiPrefsForTest()
  })

  it("logout mengembalikan transactionsTab ke default buyer", () => {
    setUiPrefs({ transactionsTab: "seller" })
    expect(getUiPrefsSnapshot().transactionsTab).toBe("seller")
    clearAccountPrefs()
    expect(getUiPrefsSnapshot().transactionsTab).toBe("buyer")
  })

  it("logout juga membersihkan snooze milik akun", () => {
    setUiPrefs({
      transactionsTab: "seller",
      ratingSnoozeUntil: { order123: Date.now() + 999999 },
    })
    clearAccountPrefs()
    expect(getUiPrefsSnapshot().ratingSnoozeUntil).toEqual({})
    expect(getUiPrefsSnapshot().transactionsTab).toBe("buyer")
  })

  it("tidak menulis storage bila tidak ada yang perlu dibersihkan", () => {
    // transactionsTab sudah buyer + tanpa snooze → no-op
    clearAccountPrefs()
    expect(getUiPrefsSnapshot().transactionsTab).toBe("buyer")
  })

  it("preferensi perangkat (balanceHidden) TIDAK ikut dibuang saat logout", () => {
    setUiPrefs({ balanceHidden: true, transactionsTab: "seller" })
    clearAccountPrefs()
    expect(getUiPrefsSnapshot().balanceHidden).toBe(true)
    expect(getUiPrefsSnapshot().transactionsTab).toBe("buyer")
  })
})
