/**
 * P0-1 (audit perf/UX 2026-10-03): pemulihan sesi lembut.
 *
 * Kelas bug yang dikunci: sesi kedaluwarsa di background dulu
 * `router.replace("/login")`, dan karena Stack.Protected mencabut semua layar
 * ber-token, navigation stack [A → B → C] musnah — setelah login ulang
 * pengguna tidak bisa kembali ke alur semula. Yang diuji di sini adalah
 * lapisan keputusan murni (latch + guard + fallback), bukan rendering modal:
 *
 *   - hanya alasan "expired" yang membuka pemulihan lembut;
 *   - logout eksplisit (default "signout") tetap alur lama;
 *   - pengguna menutup modal / gagal 3x → alur lama dengan tujuan tersimpan;
 *   - guard stack tetap true selama modal tampil (layar tidak dicabut).
 */
import { beforeEach, describe, expect, it } from "vitest"

import { clearSession, getSessionSnapshot, startSession } from "@/lib/api/session"
import { shouldMountAuthStack } from "@/lib/session-guard"
import { SESSION_VERIFY_GRACE_MS, isVerificationWithinGrace } from "@/lib/session-verify-grace"
import {
  SOFT_REAUTH_MAX_ATTEMPTS,
  closeSoftReauth,
  decideNativeSessionExpiredAction,
  getSoftReauthTarget,
  isSoftReauthActive,
  noteSoftReauthFailure,
  requestSoftReauthFallback,
  resetSoftReauth,
  setSoftReauthTarget,
  softReauthAttempts,
  subscribeSoftReauthFallback,
} from "@/lib/soft-reauth"

async function signIn() {
  await startSession({ accessToken: "access-1", refreshToken: "refresh-1" })
}

beforeEach(async () => {
  await clearSession()
  resetSoftReauth()
})

describe("P0-1: latch pemulihan lembut", () => {
  it("terbuka saat sesi kedaluwarsa (alasan expired)", async () => {
    await signIn()
    expect(isSoftReauthActive()).toBe(false)

    await clearSession({ reason: "expired" })

    expect(isSoftReauthActive()).toBe(true)
    // Guard stack harus tetap true supaya layar di belakang modal tidak
    // dicabut — inilah inti perbaikan stack [A → B → C].
    expect(
      shouldMountAuthStack({
        isWeb: false,
        token: getSessionSnapshot(),
        verifying: false,
        softReauth: true,
      }),
    ).toBe(true)
  })

  it("tidak terbuka pada logout eksplisit (default signout)", async () => {
    await signIn()

    await clearSession()

    expect(isSoftReauthActive()).toBe(false)
    expect(
      decideNativeSessionExpiredAction({
        hadSession: true,
        guardedPath: true,
        softActive: isSoftReauthActive(),
      }),
    ).toBe("legacy")
  })

  it("inert bila proses ini belum pernah punya sesi", async () => {
    await clearSession({ reason: "expired" })

    expect(isSoftReauthActive()).toBe(false)
  })

  it("login berhasil menutup latch tanpa navigasi apa pun", async () => {
    await signIn()
    await clearSession({ reason: "expired" })
    expect(isSoftReauthActive()).toBe(true)

    await signIn()

    expect(isSoftReauthActive()).toBe(false)
    expect(getSessionSnapshot()).toBe("access-1")
  })

  it("closeSoftReauth menutup tanpa menjalankan fallback", async () => {
    await signIn()
    await clearSession({ reason: "expired" })
    const seen: (string | null)[] = []
    subscribeSoftReauthFallback((next) => seen.push(next))

    closeSoftReauth()

    expect(isSoftReauthActive()).toBe(false)
    expect(seen).toEqual([])
  })
})

describe("P0-1: fallback ke alur lama", () => {
  it("jatuh setelah 3 kegagalan, membawa tujuan yang tersimpan", async () => {
    await signIn()
    setSoftReauthTarget("/dispute/123")
    await clearSession({ reason: "expired" })
    const seen: (string | null)[] = []
    subscribeSoftReauthFallback((next) => seen.push(next))

    for (let i = 1; i < SOFT_REAUTH_MAX_ATTEMPTS; i += 1) {
      expect(noteSoftReauthFailure()).toBe(false)
    }
    expect(seen).toEqual([])
    expect(softReauthAttempts()).toBe(SOFT_REAUTH_MAX_ATTEMPTS - 1)

    expect(noteSoftReauthFailure()).toBe(true)

    expect(seen).toEqual(["/dispute/123"])
    expect(isSoftReauthActive()).toBe(false)
    // Tujuan dikonsumsi sekali; fallback berikutnya tidak boleh memakainya lagi.
    expect(getSoftReauthTarget()).toBeNull()
  })

  it("tidak menawarkan pemulihan lagi sampai ada sesi baru", async () => {
    await signIn()
    await clearSession({ reason: "expired" })
    requestSoftReauthFallback()
    expect(isSoftReauthActive()).toBe(false)

    // Refresh gagal menyusul (atau emit kedua) — jangan membuka modal baru di
    // atas layar /login hasil fallback.
    await clearSession({ reason: "expired" })
    expect(isSoftReauthActive()).toBe(false)

    // Sesi baru benar-benar terbit → episode berikutnya boleh dipulihkan lagi.
    await signIn()
    await clearSession({ reason: "expired" })
    expect(isSoftReauthActive()).toBe(true)
  })
})

describe("P0-1: keputusan alur sesi-kedaluwarsa di native", () => {
  it("ignore bila memang tamu dan layar tidak dijaga", () => {
    expect(
      decideNativeSessionExpiredAction({ hadSession: false, guardedPath: false, softActive: false }),
    ).toBe("ignore")
  })

  it("legacy bila layar dijaga tetapi latch tidak aktif (tamu/deep link)", () => {
    expect(
      decideNativeSessionExpiredAction({ hadSession: false, guardedPath: true, softActive: false }),
    ).toBe("legacy")
  })

  it("soft hanya saat latch pemulihan aktif", () => {
    expect(
      decideNativeSessionExpiredAction({ hadSession: true, guardedPath: true, softActive: true }),
    ).toBe("soft")
  })
})

describe("P0-1: guard Stack.Protected", () => {
  it("true selama modal pemulihan tampil meski token sudah kosong", () => {
    expect(
      shouldMountAuthStack({ isWeb: false, token: null, verifying: false, softReauth: true }),
    ).toBe(true)
  })

  it("false tanpa token, tanpa modal, tanpa verifikasi (tamu di layar ber-auth)", () => {
    expect(
      shouldMountAuthStack({ isWeb: false, token: null, verifying: false, softReauth: false }),
    ).toBe(false)
  })

  it("web selalu true (pemblokiran tamu lewat GuestLoginPrompt)", () => {
    expect(
      shouldMountAuthStack({ isWeb: true, token: null, verifying: false, softReauth: false }),
    ).toBe(true)
  })

  it("token ada → true", () => {
    expect(
      shouldMountAuthStack({ isWeb: false, token: "access-1", verifying: false, softReauth: false }),
    ).toBe(true)
  })
})

describe("P0-2: jendela toleransi verifikasi", () => {
  it("token null + verifying true → guard tetap true (layar tidak dicabut)", () => {
    expect(
      shouldMountAuthStack({ isWeb: false, token: null, verifying: true, softReauth: false }),
    ).toBe(true)
  })

  it("verifikasi yang lewat jendela tidak lagi menahan stack", () => {
    expect(
      shouldMountAuthStack({ isWeb: false, token: null, verifying: false, softReauth: false }),
    ).toBe(false)
  })

  it("jendela tutup tepat pada 10.000 ms", () => {
    expect(isVerificationWithinGrace({ verifying: true, elapsedMs: 0 })).toBe(true)
    expect(isVerificationWithinGrace({ verifying: true, elapsedMs: SESSION_VERIFY_GRACE_MS - 1 })).toBe(true)
    expect(isVerificationWithinGrace({ verifying: true, elapsedMs: SESSION_VERIFY_GRACE_MS })).toBe(false)
    expect(isVerificationWithinGrace({ verifying: false, elapsedMs: 0 })).toBe(false)
  })
})
