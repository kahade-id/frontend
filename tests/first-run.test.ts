/**
 * Flag first-run journey UX (U5-003/U5-005/U5-013/U5-017, 2026-09-29).
 *
 * Yang dikunci:
 *  - Semua flag default false; mark*() menulis "1" dan has*() menjadi true.
 *  - Baca gagal → fail-open false (konsekuensi: overlay/sheet tampil sekali
 *    lagi — sama seperti pola coach mark).
 *  - Tulis gagal → tidak melempar.
 *  - Flag first-run TIDAK ikut `clearSession()` — logout bukan alasan
 *    menampilkan ulang orientasi/banner (preferensi perangkat, bukan akun).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  failRead: { value: false },
  failWrite: { value: false },
}))

vi.mock("@/lib/secure-storage", () => {
  const SecureKeys = {
    coachMarkFeedBuySeen: "kahade.coachMark.feedBuySeen",
    feedOrientationSeen: "kahade.onboarding.feedOrientationSeen",
    pushRationaleSeen: "kahade.onboarding.pushRationaleSeen",
    sellerEscrowBannerSeen: "kahade.onboarding.sellerEscrowBannerSeen",
    webGuestBannerDismissed: "kahade.onboarding.webGuestBannerDismissed",
    accessToken: "kahade.auth.accessToken",
  }
  return {
    SecureKeys,
    getSecureItem: vi.fn(async (key: string) => {
      if (h.failRead.value) throw new Error("baca gagal")
      return h.store.get(key) ?? null
    }),
    setSecureItem: vi.fn(async (key: string, value: string) => {
      if (h.failWrite.value) throw new Error("tulis gagal")
      h.store.set(key, value)
    }),
    deleteSecureItem: vi.fn(async (key: string) => {
      h.store.delete(key)
    }),
    // clearSession asli hanya menghapus key sesi — salin perilaku itu supaya
    // invarian "flag first-run tidak terhapus saat logout" teruji.
    clearSession: vi.fn(async () => {
      h.store.delete(SecureKeys.accessToken)
    }),
  }
})

import {
  hasSeenFeedOrientation,
  markFeedOrientationSeen,
  hasSeenPushRationale,
  markPushRationaleSeen,
  hasSeenSellerEscrowBanner,
  markSellerEscrowBannerSeen,
  hasDismissedWebGuestBanner,
  markWebGuestBannerDismissed,
} from "@/lib/first-run"
import { clearSession, SecureKeys } from "@/lib/secure-storage"

const PAIRS = [
  {
    name: "orientasi feed (U5-005)",
    has: hasSeenFeedOrientation,
    mark: markFeedOrientationSeen,
    key: SecureKeys.feedOrientationSeen,
  },
  {
    name: "rationale push (U5-003)",
    has: hasSeenPushRationale,
    mark: markPushRationaleSeen,
    key: SecureKeys.pushRationaleSeen,
  },
  {
    name: "banner escrow seller (U5-013)",
    has: hasSeenSellerEscrowBanner,
    mark: markSellerEscrowBannerSeen,
    key: SecureKeys.sellerEscrowBannerSeen,
  },
  {
    name: "banner tamu web (U5-017)",
    has: hasDismissedWebGuestBanner,
    mark: markWebGuestBannerDismissed,
    key: SecureKeys.webGuestBannerDismissed,
  },
] as const

describe("flag first-run journey", () => {
  beforeEach(() => {
    h.store.clear()
    h.failRead.value = false
    h.failWrite.value = false
  })

  for (const pair of PAIRS) {
    it(`${pair.name}: default false → mark → true (menulis "1")`, async () => {
      expect(await pair.has()).toBe(false)
      await pair.mark()
      expect(h.store.get(pair.key)).toBe("1")
      expect(await pair.has()).toBe(true)
    })

    it(`${pair.name}: baca gagal → false (fail-open)`, async () => {
      await pair.mark()
      h.failRead.value = true
      expect(await pair.has()).toBe(false)
    })

    it(`${pair.name}: tulis gagal tidak melempar`, async () => {
      h.failWrite.value = true
      await expect(pair.mark()).resolves.toBeUndefined()
    })
  }

  it("flag first-run bertahan setelah clearSession (logout)", async () => {
    await markFeedOrientationSeen()
    await markPushRationaleSeen()
    await markSellerEscrowBannerSeen()
    await markWebGuestBannerDismissed()
    await clearSession()
    expect(await hasSeenFeedOrientation()).toBe(true)
    expect(await hasSeenPushRationale()).toBe(true)
    expect(await hasSeenSellerEscrowBanner()).toBe(true)
    expect(await hasDismissedWebGuestBanner()).toBe(true)
  })
})
