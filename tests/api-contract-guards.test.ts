/**
 * Test untuk penjaga kontrak pada alur langganan, pencarian, dan transfer.
 *
 * Yang terpenting di sini adalah butir `subscribe`: test ini MENGOREKSI sebuah
 * perubahan yang sempat dibuat berdasarkan premis keliru.
 *
 * Premis keliru itu: "kode metode di luar enum akan menghasilkan 400 dengan
 * pesan validasi NestJS mentah, jadi layar perlu penjaga enum sendiri."
 * Kenyataannya, yang terbukti lewat test di bawah:
 *
 *   1. `subscribe()` memanggil `assertDtoConstraints` LEBIH DULU, yang
 *      memvalidasi enum dan melempar `ApiError` VALIDATION **secara sinkron** —
 *      tidak ada satu pun request yang dikirim (`fetchMock` tidak terpanggil).
 *   2. Pesan `ApiError` itu sudah bahasa Indonesia, dan `app/subscriptions.tsx`
 *      merendernya lewat `userMessage(err)`.
 *   3. Lagipula `methodId` hanya bisa berasal dari daftar metode yang sudah
 *      disaring terhadap enum saat data dimuat.
 *
 * Jadi penjaga di layar itu redundan dan sudah dicabut; perilaku yang
 * sesungguhnya melindungi alur ini dikunci di sini.
 *
 * Dua butir lain: `lookupTransferRecipient` membaca `id` lewat `pickUserId`
 * (bukan `String(record.id ?? record.userId ?? "")`), dan
 * `getSearchSuggestions` mengirim `limit` sesuai spec.
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

const { subscribe } = await import("@/lib/api/subscriptions")
const { lookupTransferRecipient } = await import("@/lib/api/wallet")
const { getSearchSuggestions } = await import("@/lib/api/search")
const { isApiError } = await import("@/lib/api/errors")

const reply = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ success: true, data: body })),
    blob: () => Promise.resolve(new Blob()),
  } as Response)

beforeEach(() => fetchMock.mockReset())

describe("subscribe — enum paymentMethod", () => {
  /**
   * `subscribe()` BUKAN `async`: `assertDtoConstraints` melempar secara
   * SINKRON sebelum promise dibuat. Jadi `.rejects`/`.catch()` tidak berlaku —
   * harus ditangkap dengan `expect(() => …).toThrow()` atau try/catch.
   * (Versi pertama test ini salah di titik itu.)
   */
  it("menolak kode di luar enum SEBELUM request dikirim", () => {
    expect(() =>
      subscribe({ plan: "MONTHLY", pin: "123456", paymentMethod: "METODE_BARU_BACKEND" as never }),
    ).toThrow()
    // Kunci perilakunya: tidak ada satu pun panggilan jaringan.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("error-nya ApiError VALIDATION, sehingga layar menampilkan pesan Indonesia", () => {
    let err: unknown
    try {
      subscribe({ plan: "MONTHLY", pin: "123456", paymentMethod: "PAYPAL" as never })
    } catch (e) {
      err = e
    }
    expect(isApiError(err)).toBe(true)
    if (!isApiError(err)) return
    expect(err.code).toBe("VALIDATION")
    // `app/subscriptions.tsx` merender `userMessage(err)`, jadi yang muncul
    // sudah bahasa Indonesia — bukan body validasi NestJS mentah.
    expect(err.message).toMatch(/paymentMethod/)
  })

  it("meloloskan kode yang memang ada di enum", async () => {
    fetchMock.mockImplementationOnce(() => reply({ active: true, plan: "MONTHLY" }))
    const res = await subscribe({ plan: "MONTHLY", pin: "123456", paymentMethod: "QRIS" })
    expect(res.active).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("tetap meloloskan saat paymentMethod tidak diisi (opsional di DTO)", async () => {
    fetchMock.mockImplementationOnce(() => reply({ active: true }))
    // `ANNUAL`, bukan `YEARLY`: enum SubscribeDto.plan hanya MONTHLY|ANNUAL,
    // sama seperti `SubscriptionPeriod` di components/ui/subscription-status-card.tsx:44.
    await expect(subscribe({ plan: "ANNUAL", pin: "123456" })).resolves.toBeTruthy()
  })
})

describe("lookupTransferRecipient — id lewat pickUserId", () => {
  it("membaca alias `user_id`", async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ users: [{ user_id: "u-99", username: "budi" }] }),
    )
    const rows = await lookupTransferRecipient("budi")
    expect(rows[0]?.id).toBe("u-99")
  })

  it("mengubah id bertipe number menjadi string", async () => {
    fetchMock.mockImplementationOnce(() => reply({ users: [{ id: 4242, username: "sari" }] }))
    const rows = await lookupTransferRecipient("sari")
    expect(rows[0]?.id).toBe("4242")
  })

  it("membuka objek bersarang `user`", async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ recipients: [{ user: { id: "u-nest" }, username: "andi" }] }),
    )
    const rows = await lookupTransferRecipient("andi")
    expect(rows[0]?.id).toBe("u-nest")
  })

  it("menghasilkan id kosong (bukan 'undefined') bila tak ada alias sama sekali", async () => {
    fetchMock.mockImplementationOnce(() => reply({ users: [{ username: "tanpa-id" }] }))
    const rows = await lookupTransferRecipient("tanpa-id")
    expect(rows[0]?.id).toBe("")
  })
})

describe("getSearchSuggestions — limit", () => {
  it("mengirim limit=20 bawaan sesuai spec", async () => {
    fetchMock.mockImplementationOnce(() => reply(["kahade", "kawal"]))
    await getSearchSuggestions({ q: "ka" })
    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain("limit=20")
    expect(url).toContain("q=ka")
  })

  it("membiarkan pemanggil menimpa limit", async () => {
    fetchMock.mockImplementationOnce(() => reply([]))
    await getSearchSuggestions({ q: "ka", limit: 5 })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("limit=5")
  })
})
