/**
 * GAP-A G001–G025: penjaga kontrak normalizer social login.
 *
 * socialLogin() harus membedakan 5 hasil backend TANPA menebak:
 *  - session (accessToken+refreshToken)
 *  - twoFactor (requiresTwoFactor + tempToken)
 *  - phoneMigration (requiresPhoneMigration + migrationToken)
 *  - linkRequired (requiresLink + isNewIdentity → registrasi nomor HP dulu)
 *  - confirmLink (requiresLink tanpa isNewIdentity → konflik email, buktikan
 *    kepemilikan akun lama)
 *
 * Serta:
 *  - getProviders() hanya menampilkan provider terkonfigurasi (enabled + appId).
 *  - listLinked() membaca daftar dari envelope backend { providers: [...] }.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock("@/lib/api/session", () => ({
  startSession: vi.fn(),
}))

import { http } from "@/lib/api/client"
import {
  getProviders,
  listLinked,
  socialLogin,
} from "@/lib/api/social"

const post = http.post as unknown as ReturnType<typeof vi.fn>
const get = http.get as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe("socialLogin outcome normalization (GAP-A)", () => {
  it("session: accessToken + refreshToken", async () => {
    post.mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      user: { id: "u1" },
    })
    const res = await socialLogin({ provider: "GOOGLE", idToken: "id-token" })
    expect(res).toEqual({ kind: "session", accessToken: "a", refreshToken: "r", user: { id: "u1" } })
  })

  it("twoFactor: requiresTwoFactor + tempToken", async () => {
    post.mockResolvedValue({ requiresTwoFactor: true, tempToken: "tmp-123" })
    const res = await socialLogin({ provider: "APPLE", idToken: "id-token" })
    expect(res).toEqual({ kind: "twoFactor", tempToken: "tmp-123" })
  })

  it("phoneMigration: requiresPhoneMigration + migrationToken", async () => {
    post.mockResolvedValue({ requiresPhoneMigration: true, migrationToken: "mig-1" })
    const res = await socialLogin({ provider: "GOOGLE", idToken: "id-token" })
    expect(res).toEqual({ kind: "phoneMigration", migrationToken: "mig-1" })
  })

  it("linkRequired: identitas sosial BARU → registrasi nomor HP dulu (bukan silent register)", async () => {
    post.mockResolvedValue({ requiresLink: true, isNewIdentity: true, linkToken: "ltk-1" })
    const res = await socialLogin({ provider: "GOOGLE", idToken: "id-token" })
    expect(res).toEqual({ kind: "linkRequired", linkToken: "ltk-1" })
  })

  it("confirmLink: konflik email → buktikan kepemilikan akun lama", async () => {
    post.mockResolvedValue({
      requiresLink: true,
      isNewIdentity: false,
      linkToken: "ltk-2",
      maskedEmail: "a***@x.id",
      provider: "google",
    })
    const res = await socialLogin({ provider: "GOOGLE", idToken: "id-token" })
    expect(res).toEqual({
      kind: "confirmLink",
      linkToken: "ltk-2",
      maskedEmail: "a***@x.id",
      provider: "GOOGLE",
    })
  })

  it("melempar invalidResponse bila requiresLink tanpa linkToken", async () => {
    post.mockResolvedValue({ requiresLink: true, isNewIdentity: true })
    await expect(socialLogin({ provider: "GOOGLE", idToken: "t" })).rejects.toThrow()
  })

  it("melempar invalidResponse bila session tanpa token", async () => {
    post.mockResolvedValue({ user: {} })
    await expect(socialLogin({ provider: "GOOGLE", idToken: "t" })).rejects.toThrow()
  })
})

describe("getProviders capability filter (G002)", () => {
  it("enabled = terkonfigurasi server DAN punya appId; tombol hanya tampil bila enabled", async () => {
    get.mockResolvedValue({
      providers: [
        { provider: "GOOGLE", enabled: true, appId: "google-client-id" },
        { provider: "APPLE", enabled: true, appId: null },
      ],
    })
    const res = await getProviders()
    expect(res).toEqual([
      { provider: "GOOGLE", enabled: true, configured: true, appId: "google-client-id" },
      { provider: "APPLE", enabled: false, configured: false, appId: null },
    ])
    // Lapisan tombol memfilter di sini (social-login-buttons.tsx):
    expect(res.filter((c) => c.enabled)).toHaveLength(1)
  })
})

describe("listLinked envelope (G013)", () => {
  it("membaca providers dari envelope backend", async () => {
    get.mockResolvedValue({
      providers: [{ provider: "GOOGLE", linkedAt: "2026-09-27T00:00:00Z" }],
    })
    const res = await listLinked()
    expect(res).toEqual([{ provider: "GOOGLE", linkedAt: "2026-09-27T00:00:00Z" }])
  })
})
