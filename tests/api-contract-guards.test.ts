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
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
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

describe("assertDtoConstraints — pattern/minItems/maxItems", () => {
  /**
   * Ketiga aturan ini ada di `API_CONSTRAINTS` (ditulis generator dari spec)
   * tetapi sebelumnya TIDAK ditegakkan — bahkan tidak ada di tipe `Rules`.
   * Validasi tampak berjalan padahal tidak. Dikunci di sini.
   */
  it("menolak string yang tidak cocok `pattern` (NIK harus 16 digit)", async () => {
    const { assertDtoConstraints } = await import("@/lib/financial")
    const rules = { nik: { pattern: "^\\d{16}$" } }
    expect(() => assertDtoConstraints({ nik: "123" }, rules)).toThrow()
    expect(() => assertDtoConstraints({ nik: "3201010101010001" }, rules)).not.toThrow()
    // Huruf di dalam 16 karakter tetap harus ditolak — bukan sekadar cek panjang.
    expect(() => assertDtoConstraints({ nik: "320101010101000A" }, rules)).toThrow()
  })

  it("memakai pola nyata dari API_CONSTRAINTS, bukan pola bikinan test", async () => {
    const { API_CONSTRAINTS } = await import("@/lib/api/constraints")
    const { assertDtoConstraints } = await import("@/lib/financial")
    // Nomor rekening: ^\d{6,20}$
    expect(() =>
      assertDtoConstraints({ accountNumber: "12345" }, API_CONSTRAINTS.AddBankAccountDto),
    ).toThrow()
    expect(() =>
      assertDtoConstraints({ accountNumber: "123456" }, API_CONSTRAINTS.AddBankAccountDto),
    ).not.toThrow()
    // Kode referral: ^KH[A-Z0-9]{6,8}$ — 6..8 karakter SETELAH awalan "KH".
    expect(() => assertDtoConstraints({ code: "KHABC123" }, API_CONSTRAINTS.ApplyReferralDto)).not.toThrow()
    // 5 karakter setelah awalan: di bawah batas bawah.
    expect(() => assertDtoConstraints({ code: "KHABC12" }, API_CONSTRAINTS.ApplyReferralDto)).toThrow()
    // Awalan salah meski panjangnya sah.
    expect(() => assertDtoConstraints({ code: "XXABC123" }, API_CONSTRAINTS.ApplyReferralDto)).toThrow()
  })

  it("menegakkan maxItems pada array", async () => {
    const { assertDtoConstraints } = await import("@/lib/financial")
    const rules = { notifIds: { maxItems: 2 } }
    expect(() => assertDtoConstraints({ notifIds: ["a", "b"] }, rules)).not.toThrow()
    expect(() => assertDtoConstraints({ notifIds: ["a", "b", "c"] }, rules)).toThrow()
  })

  it("melewati field yang tidak diisi (opsional)", async () => {
    const { assertDtoConstraints } = await import("@/lib/financial")
    const rules = { nik: { pattern: "^\\d{16}$" } }
    expect(() => assertDtoConstraints({}, rules)).not.toThrow()
  })
})

/**
 * API-27 — kolom detail laporan pernah dibatasi 1000 karakter, padahal spec
 * hanya menerima 500. Pengguna yang menulis 501-1000 karakter baru ditolak
 * saat submit, dengan pesan "Gagal mengirim laporan" tanpa sebab yang jelas;
 * penghitung karakter di bawah kolom bahkan memberi lampu hijau sampai 1000.
 *
 * Komponen React Native tidak bisa diimpor di sini (lihat catatan
 * `vitest.config.ts`: tidak ada RN runtime), jadi yang dikunci adalah
 * invariannya: angka batas HARUS diturunkan dari spec dan tidak boleh ada
 * angka literal di berkas formulir itu.
 */
describe("batas panjang kolom detail laporan (API-27)", () => {
  // Bukan `new URL(rel, import.meta.url)`: di bawah lib DOM yang aktif,
  // `URL` global merujuk ke tipe DOM dan tidak cocok dengan `readFileSync`
  // (jebakan yang sama pernah menimpa `vitest.config.ts`).
  const here = dirname(fileURLToPath(import.meta.url))
  const read = (rel: string) => readFileSync(resolve(here, rel), "utf8")

  it("angka batas di constraints cocok dengan spec", async () => {
    const { API_CONSTRAINTS } = await import("@/lib/api/constraints")
    const spec = JSON.parse(read("../docs/api/kahade-api-mobile.json"))
    const fromSpec =
      spec.components.schemas.ReportUserSettingsDto.properties.description.maxLength
    expect(fromSpec).toBe(500)
    expect(API_CONSTRAINTS.ReportUserSettingsDto.description.maxLength).toBe(fromSpec)
  })

  it("report-form tidak lagi menulis maxLength sebagai angka literal", () => {
    const src = read("../components/ui/report-form.tsx")
    // Batas diturunkan dari konstanta spec ...
    expect(src).toMatch(
      /MAX_DETAIL\s*=\s*API_CONSTRAINTS\.ReportUserSettingsDto\.description\.maxLength/,
    )
    // ... dan dipakai apa adanya pada TextArea.
    expect(src).toContain("maxLength={MAX_DETAIL}")
    // Regresi yang dikunci: tidak boleh ada maxLength berupa angka di berkas ini.
    expect(src).not.toMatch(/maxLength=\{\s*\d+\s*\}/)
  })
})
