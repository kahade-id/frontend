/**
 * Coach mark "sekali saja" (2026-09-28): flag tampil/ditutup per elemen.
 *
 * Yang dikunci:
 *  - `hasSeenCoachMark` false saat belum ada flag / baca gagal (fail-open:
 *    konsekuensinya hanya tooltip tampil sekali lagi).
 *  - `markCoachMarkSeen` menulis "1" ke key yang benar per id.
 *  - Gagal tulis tidak melempar (pola onboarding.ts).
 *  - Key coach mark TIDAK ikut `clearSession()` — logout tidak menampilkan
 *    ulang pengenal elemen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  store: new Map<string, string>(),
  failWrite: { value: false },
}))

vi.mock("@/lib/secure-storage", () => {
  const SecureKeys = {
    coachMarkCreateSeen: "kahade.coachMark.createSeen",
    coachMarkQrSeen: "kahade.coachMark.qrSeen",
    accessToken: "kahade.auth.accessToken",
    refreshToken: "kahade.auth.refreshToken",
    biometricEnabled: "kahade.security.biometricEnabled",
    pushToken: "kahade.push.token",
    feedbackQueue: "kahade.feedback.queue",
    pendingActions: "kahade.pending.actions",
    recentRecipients: "kahade.transfer.recent",
    showcaseBookmarks: "kahade.showcase.bookmarks",
  }
  return {
    SecureKeys,
    getSecureItem: vi.fn(async (key: string) => h.store.get(key) ?? null),
    setSecureItem: vi.fn(async (key: string, value: string) => {
      if (h.failWrite.value) throw new Error("storage penuh")
      h.store.set(key, value)
    }),
    deleteSecureItem: vi.fn(async (key: string) => {
      h.store.delete(key)
    }),
    // clearSession asli hanya menghapus daftar key sesi — salin perilaku itu
    // supaya invarian "coach mark tidak terhapus saat logout" teruji.
    clearSession: vi.fn(async () => {
      for (const k of [
        SecureKeys.accessToken,
        SecureKeys.refreshToken,
        SecureKeys.biometricEnabled,
        SecureKeys.pushToken,
        SecureKeys.feedbackQueue,
        SecureKeys.pendingActions,
        SecureKeys.recentRecipients,
        SecureKeys.showcaseBookmarks,
      ]) {
        h.store.delete(k)
      }
    }),
  }
})

import { hasSeenCoachMark, markCoachMarkSeen } from "@/lib/coach-mark"
import { clearSession, SecureKeys } from "@/lib/secure-storage"

beforeEach(() => {
  h.store.clear()
  h.failWrite.value = false
})

describe("hasSeenCoachMark", () => {
  it("false bila flag belum pernah ditulis", async () => {
    expect(await hasSeenCoachMark("create")).toBe(false)
    expect(await hasSeenCoachMark("qr")).toBe(false)
  })

  it("true setelah markCoachMarkSeen", async () => {
    await markCoachMarkSeen("create")
    expect(await hasSeenCoachMark("create")).toBe(true)
    // id lain tidak ikut tertandai
    expect(await hasSeenCoachMark("qr")).toBe(false)
  })

  it("menulis ke key yang benar per id", async () => {
    await markCoachMarkSeen("create")
    await markCoachMarkSeen("qr")
    expect(h.store.get(SecureKeys.coachMarkCreateSeen)).toBe("1")
    expect(h.store.get(SecureKeys.coachMarkQrSeen)).toBe("1")
  })
})

describe("ketahanan storage", () => {
  it("gagal tulis tidak melempar (pola onboarding.ts)", async () => {
    h.failWrite.value = true
    await expect(markCoachMarkSeen("create")).resolves.toBeUndefined()
    // baca gagal = anggap belum (tooltip tampil sekali lagi, bukan crash)
    expect(await hasSeenCoachMark("create")).toBe(false)
  })

  it("flag coach mark TIDAK ikut terhapus saat logout", async () => {
    await markCoachMarkSeen("create")
    await markCoachMarkSeen("qr")
    await clearSession()
    expect(await hasSeenCoachMark("create")).toBe(true)
    expect(await hasSeenCoachMark("qr")).toBe(true)
  })
})
