/**
 * B-08 (audit 2026-09-20): URUTAN pembersihan saat logout.
 *
 * Dipisahkan dari tests/session-lifecycle.test.ts karena di sana `lib/secure-storage`
 * asli dipakai, dan di sana jalur "penghapusan gagal" tidak bisa dipicu:
 * stub `react-native` menetapkan Platform.OS = "web", sedangkan kegagalan
 * SecureStore (Keystore terkunci, penyimpanan penuh) hanya ada di native —
 * di web setiap operasi storage sudah dibungkus try/catch agar browser dengan
 * storage nonaktif tidak meruntuhkan app.
 *
 * Karena invariannya adalah "jangan tulis flag sebelum pembersihan berhasil",
 * modul penyimpanan diganti mock yang bisa gagal + mencatat urutan operasi.
 * Yang diuji tetap `lib/api/session.ts` asli.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  calls: [] as string[],
  failCleanup: { value: false },
}))

vi.mock("@/lib/secure-storage", () => {
  const SecureKeys = {
    accessToken: "kahade.auth.accessToken",
    refreshToken: "kahade.auth.refreshToken",
    sessionSignedOut: "kahade.session.signedOut",
    biometricEnabled: "kahade.security.biometricEnabled",
    uiPrefs: "kahade.ui.prefs",
    recentRecipients: "kahade.transfer.recent",
    feedbackQueue: "kahade.feedback.queue",
    pendingActions: "kahade.pending.actions",
    pushToken: "kahade.push.token",
    deviceId: "kahade.device.id",
  }
  return {
    SecureKeys,
    getSecureItem: vi.fn(async (key: string) => (key === SecureKeys.sessionSignedOut ? null : "stored")),
    setSecureItem: vi.fn(async (key: string) => {
      h.calls.push(`set:${key}`)
    }),
    deleteSecureItem: vi.fn(async (key: string) => {
      h.calls.push(`delete:${key}`)
    }),
    clearSession: vi.fn(async () => {
      h.calls.push("clear")
      if (h.failCleanup.value) throw new Error("keystore locked")
    }),
    getOrCreateDeviceId: vi.fn(async () => "device-test"),
  }
})

import { clearSession } from "@/lib/api/session"

const flagWrites = () =>
  h.calls.filter((entry) => entry === "set:kahade.session.signedOut")

beforeEach(() => {
  h.calls.length = 0
  h.failCleanup.value = false
})

describe("B-08: urutan pembersihan vs flag signed-out", () => {
  it("kegagalan hapus TIDAK menulis flag dan tetap melaporkan kegagalan", async () => {
    h.failCleanup.value = true

    await expect(clearSession()).rejects.toThrow("keystore locked")

    // Perangkat tidak boleh "terkunci keluar": tanpa flag, boot berikutnya
    // mencoba memulihkan sesi lalu membersihkan ulang.
    expect(flagWrites()).toHaveLength(0)
  })

  it("flag ditulis SETELAH pembersihan berhasil, bukan sebelumnya", async () => {
    await clearSession()

    const cleanupIndex = h.calls.indexOf("clear")
    const flagIndex = h.calls.indexOf("set:kahade.session.signedOut")
    expect(cleanupIndex).toBeGreaterThan(-1)
    expect(flagIndex).toBeGreaterThan(cleanupIndex)
  })
})
