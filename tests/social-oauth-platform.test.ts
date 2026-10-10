/**
 * Gerbang platform OAuth + kontrak nonce (overhaul auth 2026-10-10, bagian 5).
 *
 * Dua hal yang dikunci di sini:
 *   1. "Lanjut dengan Apple" hanya ada di iOS. Di Android tombol itu tidak
 *      dirender sama sekali (bukan disabled, bukan "segera hadir") — baris yang
 *      tidak bisa dipakai hanya menambah beban pilih di layar masuk. Web ikut
 *      disembunyikan karena app/index.tsx mengarahkan pengunjung web ke
 *      https://kahade.id.
 *   2. Jalur Apple berbasis browser TETAP ADA dan tetap memakai nonce terbitan
 *      server (POST /v1/auth/apple/nonce, kontrak Wave 1 2026-09-28). Menyembunyikan
 *      tombolnya tidak boleh menghapus kemampuannya: kalau suatu permukaan web
 *      butuh Apple, yang dilonggarkan hanya `isAppleButtonSupported()`.
 *
 * Google tetap memakai nonce acak klien (backend memverifikasi bila dikirim,
 * G011) dan endpoint pertukaran token tetap POST /v1/auth/social/login —
 * tidak ada endpoint baru yang dikarang di overhaul ini.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const platform = vi.hoisted(() => ({
  OS: "ios" as string,
  select: <T,>(specific: { ios?: T; android?: T; web?: T; default?: T }) =>
    specific.ios ?? specific.default,
}))

const apple = vi.hoisted(() => ({
  signInAsync: vi.fn(),
  scope: { FULL_NAME: 0, EMAIL: 1 },
}))
const browser = vi.hoisted(() => ({
  openAuthSessionAsync: vi.fn(),
  maybeCompleteAuthSession: vi.fn(() => false),
}))
const authSession = vi.hoisted(() => ({
  ctor: vi.fn(),
  promptAsync: vi.fn(),
}))
const socialApi = vi.hoisted(() => ({
  requestAppleNonce: vi.fn(async () => "nonce-dari-server"),
}))

vi.mock("react-native", () => ({ Platform: platform }))
vi.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: apple.scope,
  signInAsync: apple.signInAsync,
}))
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: browser.maybeCompleteAuthSession,
  openAuthSessionAsync: browser.openAuthSessionAsync,
}))
vi.mock("expo-auth-session", () => ({
  AuthRequest: class {
    promptAsync = authSession.promptAsync
    constructor(config: unknown) {
      authSession.ctor(config)
    }
  },
  makeRedirectUri: () => "kahade://redirect",
  ResponseType: { IdToken: "id_token" },
}))
vi.mock("@/lib/api/social", () => ({ requestAppleNonce: socialApi.requestAppleNonce }))

const { SocialCancelledError, getSocialIdToken, isAppleButtonSupported } = await import(
  "@/lib/social-oauth"
)

beforeEach(() => {
  platform.OS = "ios"
  vi.clearAllMocks()
  socialApi.requestAppleNonce.mockResolvedValue("nonce-dari-server")
})

describe("tombol Apple per platform", () => {
  it("iOS: tampil", () => {
    platform.OS = "ios"
    expect(isAppleButtonSupported()).toBe(true)
  })

  it("Android: disembunyikan", () => {
    platform.OS = "android"
    expect(isAppleButtonSupported()).toBe(false)
  })

  it("Web: disembunyikan (corong web diarahkan ke kahade.id)", () => {
    platform.OS = "web"
    expect(isAppleButtonSupported()).toBe(false)
  })
})

describe("Apple di iOS: native + nonce server", () => {
  it("memakai expo-apple-authentication dengan nonce terbitan server", async () => {
    apple.signInAsync.mockResolvedValue({ identityToken: "apple-identity-token" })

    await expect(getSocialIdToken("APPLE", "id.kahade")).resolves.toEqual({
      idToken: "apple-identity-token",
      nonce: "nonce-dari-server",
    })
    expect(socialApi.requestAppleNonce).toHaveBeenCalledTimes(1)
    expect(apple.signInAsync).toHaveBeenCalledWith({
      requestedScopes: [apple.scope.FULL_NAME, apple.scope.EMAIL],
      nonce: "nonce-dari-server",
    })
    // Jalur browser tidak boleh ikut terpakai di iOS.
    expect(browser.openAuthSessionAsync).not.toHaveBeenCalled()
  })

  it("pembatalan pengguna menjadi SocialCancelledError → UI diam (T4-011)", async () => {
    apple.signInAsync.mockRejectedValue(new Error("ERR_CANCELED"))

    await expect(getSocialIdToken("APPLE", "id.kahade")).rejects.toBeInstanceOf(SocialCancelledError)
  })

  it("Apple tanpa identityToken = error jujur, bukan sesi kosong", async () => {
    apple.signInAsync.mockResolvedValue({ identityToken: null })

    await expect(getSocialIdToken("APPLE", "id.kahade")).rejects.toThrow(/identity token/)
  })
})

describe("Apple di web: jalur browser dipertahankan", () => {
  it("memakai response_mode=fragment + nonce server, dan membaca id_token dari hash", async () => {
    platform.OS = "web"
    browser.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "kahade://redirect#id_token=web-apple-token&state=abc",
    })

    await expect(getSocialIdToken("APPLE", "apple-client-id")).resolves.toEqual({
      idToken: "web-apple-token",
      nonce: "nonce-dari-server",
    })

    const [authUrl, redirectUri] = browser.openAuthSessionAsync.mock.calls[0] as [string, string]
    expect(redirectUri).toBe("kahade://redirect")
    expect(authUrl).toContain("https://appleid.apple.com/auth/authorize?")
    expect(authUrl).toContain("client_id=apple-client-id")
    expect(authUrl).toContain("response_mode=fragment")
    expect(authUrl).toContain("nonce=nonce-dari-server")
    expect(authUrl).toContain("scope=name+email")
  })

  it("pembatalan browser juga menjadi SocialCancelledError", async () => {
    platform.OS = "web"
    browser.openAuthSessionAsync.mockResolvedValue({ type: "cancel" })

    await expect(getSocialIdToken("APPLE", "apple-client-id")).rejects.toBeInstanceOf(
      SocialCancelledError,
    )
  })
})

describe("Google: nonce klien + endpoint pertukaran yang sudah ada", () => {
  it("tidak memanggil endpoint nonce Apple dan memakai expo-auth-session", async () => {
    authSession.promptAsync.mockResolvedValue({
      type: "success",
      params: { id_token: "google-id-token" },
    })

    const result = await getSocialIdToken("GOOGLE", "google-client-id")

    expect(socialApi.requestAppleNonce).not.toHaveBeenCalled()
    expect(result.idToken).toBe("google-id-token")
    // Nonce acak klien (G011) — 64 hex, dan HARUS sama dengan yang dikirim ke
    // backend supaya server bisa mencocokkannya di dalam id_token.
    expect(result.nonce).toMatch(/^[0-9a-f]{64}$/)
    expect(authSession.ctor).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "google-client-id",
        redirectUri: "kahade://redirect",
        responseType: "id_token",
        scopes: ["openid", "profile", "email"],
        extraParams: { nonce: result.nonce },
      }),
    )
  })

  it("cancel/dismiss → SocialCancelledError; tanpa id_token → error spesifik", async () => {
    authSession.promptAsync.mockResolvedValue({ type: "dismiss" })
    await expect(getSocialIdToken("GOOGLE", "google-client-id")).rejects.toBeInstanceOf(
      SocialCancelledError,
    )

    authSession.promptAsync.mockResolvedValue({ type: "success", params: {} })
    await expect(getSocialIdToken("GOOGLE", "google-client-id")).rejects.toThrow(/id_token/)
  })
})
