/**
 * B-01/B-05/B-06 (audit 2026-09-20): siklus hidup sesi.
 *
 * Kelas bug yang dikunci di sini adalah "logout yang tidak benar-benar
 * logout" — token masih ada, revisi sesi tidak naik, atau flag "signed out"
 * tertulis sebelum pembersihan berhasil sehingga perangkat tidak bisa lagi
 * memakai sesi apa pun. Semuanya hanya terlihat pada hasil operasi
 * penyimpanan, jadi test ini menggerakkan `lib/api/session.ts` langsung dan
 * memeriksa isi penyimpanan. Urutan pembersihan vs penulisan flag (B-08) diuji
 * terpisah di tests/session-logout-order.test.ts — alasan pemisahannya ada di
 * berkas itu.
 */
import { beforeEach, describe, expect, it } from "vitest"

import {
  clearAccessToken,
  clearSession,
  getAccessToken,
  getSessionRevision,
  getSessionSnapshot,
  setAccessToken,
  startSession,
} from "@/lib/api/session"
import { getSecureItem, SecureKeys } from "@/lib/secure-storage"
import { getUiPrefsSnapshot, setUiPrefs } from "@/lib/ui-prefs"

beforeEach(async () => {
  // Sesi bersih antar-test: token yang tersisa tidak boleh mewarnai assert
  // "belum ada sesi" di test berikutnya.
  await clearSession()
})

describe("B-01: clearAccessToken = jalur keluar yang utuh", () => {
  it("menaikkan revisi sesi, mengosongkan token, dan menandai signed out", async () => {
    await startSession({ accessToken: "token-a", refreshToken: "refresh-a" })
    expect(getSessionSnapshot()).toBe("token-a")
    const before = getSessionRevision()

    await clearAccessToken()

    // Revisi naik → request yang masih terbang dibatalkan oleh assertSession().
    expect(getSessionRevision()).toBeGreaterThan(before)
    expect(getSessionSnapshot()).toBeNull()
    expect(await getAccessToken()).toBeNull()
    // Boot berikutnya tidak mencoba memulihkan sesi yang sengaja diakhiri.
    expect(await getSecureItem(SecureKeys.sessionSignedOut)).toBe("1")
    expect(await getSecureItem(SecureKeys.accessToken)).toBeNull()
    expect(await getSecureItem(SecureKeys.refreshToken)).toBeNull()
  })
})

describe("B-05: snapshot sesi ternormalisasi", () => {
  it("tidak pernah mengembalikan undefined sebelum/sesudah token dibaca", async () => {
    // Sebelum ada pembacaan apa pun: tetap null, bukan undefined — hidrasi web
    // membandingkan serverSnapshot dengan snapshot klien, dan undefined vs null
    // membuat keduanya dianggap dua keadaan berbeda.
    expect(getSessionSnapshot()).toBeNull()

    await setAccessToken("token-b")
    expect(getSessionSnapshot()).toBe("token-b")

    await clearSession()
    expect(getSessionSnapshot()).toBeNull()
  })
})

describe("B-06: preferensi akun dibersihkan, preferensi perangkat tidak", () => {
  it("clearSession membuang snooze ulasan tetapi mempertahankan balanceHidden/transactionsTab/appMode", async () => {
    setUiPrefs({
      balanceHidden: true,
      transactionsTab: "seller",
      appMode: "wallet",
      ratingSnoozeUntil: { "order-1": Date.now() + 60_000 },
    })

    await clearSession()

    const prefs = getUiPrefsSnapshot()
    expect(prefs.ratingSnoozeUntil).toEqual({})
    expect(prefs.balanceHidden).toBe(true)
    expect(prefs.transactionsTab).toBe("seller")
    expect(prefs.appMode).toBe("wallet")
  })
})
