/**
 * Test gerbang keamanan yang keputusannya diambil dari respons backend.
 *
 * Ketiga adapter ini dulunya hanya me-*cast* respons. Arah fallback-nya adalah
 * keputusan keamanan, jadi dikunci di sini: bila backend mengirim bentuk yang
 * tidak dikenal, verifikasi HARUS gagal (bukan lolos).
 *
 *   - verifyWalletPin   → `app/change-pin.tsx` membaca `res.valid === false`
 *   - verifyPassword    → re-auth sebelum ubah email / hapus akun
 *   - normalizeFavorite → ikon favorit di profil publik
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/session", () => ({
  getAccessToken: () => Promise.resolve("token"),
  getRefreshToken: () => Promise.resolve(null),
  setAccessToken: () => Promise.resolve(),
  setRefreshToken: () => Promise.resolve(),
  getSessionRevision: () => 1,
  clearSession: () => Promise.resolve(),
  emitSessionExpired: () => undefined,
  getDeviceId: () => Promise.resolve("device-1"),
  getDeviceInfo: () => "Kahade/test",
  getAppVersion: () => "0.0.0",
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

const { verifyWalletPin } = await import("@/lib/api/wallet")
const { verifyPassword } = await import("@/lib/api/auth")
const { addFavorite, isFavorite, removeFavorite } = await import("@/lib/api/users")

const reply = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ success: true, data: body })),
    blob: () => Promise.resolve(new Blob()),
  } as Response)

beforeEach(() => fetchMock.mockReset())

describe("verifyWalletPin", () => {
  it("PIN benar terbaca dari `valid`", async () => {
    fetchMock.mockImplementationOnce(() => reply({ valid: true }))
    expect((await verifyWalletPin({ pin: "123456" })).valid).toBe(true)
  })

  it("PIN salah terbaca dari alias `isValid`", async () => {
    fetchMock.mockImplementationOnce(() => reply({ isValid: false }))
    expect((await verifyWalletPin({ pin: "000000" })).valid).toBe(false)
  })

  it("bentuk tak dikenal → TIDAK terverifikasi (bukan lolos)", async () => {
    fetchMock.mockImplementationOnce(() => reply({ ok: true }))
    expect((await verifyWalletPin({ pin: "123456" })).valid).toBe(false)
  })
})

describe("verifyPassword", () => {
  it("password benar", async () => {
    fetchMock.mockImplementationOnce(() => reply({ valid: true }))
    expect((await verifyPassword({ password: "benar" })).valid).toBe(true)
  })

  it("password salah lewat alias `verified: false`", async () => {
    fetchMock.mockImplementationOnce(() => reply({ verified: false }))
    expect((await verifyPassword({ password: "salah" })).valid).toBe(false)
  })

  it("bentuk tak dikenal → ditolak, re-auth tidak boleh lolos", async () => {
    fetchMock.mockImplementationOnce(() => reply({ message: "ok" }))
    expect((await verifyPassword({ password: "apa saja" })).valid).toBe(false)
  })
})

describe("favorite", () => {
  it("membaca alias `isFavorite` — ikon tidak lagi selalu kosong", async () => {
    fetchMock.mockImplementationOnce(() => reply({ isFavorite: true, count: 3 }))
    const result = await isFavorite("budi")
    expect(result.favorited).toBe(true)
    expect(result.count).toBe(3)
  })

  it("addFavorite: bentuk tak dikenal tetap dianggap tersimpan (UI tidak berbalik)", async () => {
    fetchMock.mockImplementationOnce(() => reply({ message: "ok" }))
    expect((await addFavorite("budi")).favorited).toBe(true)
  })

  it("removeFavorite: bentuk tak dikenal tetap dianggap batal", async () => {
    fetchMock.mockImplementationOnce(() => reply({ message: "ok" }))
    expect((await removeFavorite("budi")).favorited).toBe(false)
  })

  it("status eksplisit dari server mengalahkan fallback", async () => {
    fetchMock.mockImplementationOnce(() => reply({ favorited: false }))
    expect((await addFavorite("budi")).favorited).toBe(false)
  })
})
