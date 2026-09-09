/**
 * Test untuk kelas bug RUN-02 di endpoint lain: respons "verdict" yang di-cast
 * tanpa normalizer, lalu dipakai UI untuk mengambil keputusan.
 *
 * Setiap kasus adalah bentuk respons yang membuat fitur salah berperilaku:
 * voucher valid dianggap tidak berlaku, PIN salah dianggap benar, status
 * pembayaran tidak pernah terbaca sehingga polling tidak berhenti.
 */
import { describe, expect, it } from "vitest"

import { normalizePaymentStatus } from "@/lib/api/orders"
import { parseRetryAfterMs } from "@/lib/api/errors"
import { pickBoolean, readVerdict } from "@/lib/api/response"
import { normalizeVoucherValidation } from "@/lib/api/vouchers"

describe("readVerdict", () => {
  it("membaca flag dari banyak alias", () => {
    expect(readVerdict({ valid: true }, ["valid", "isValid"], false).value).toBe(true)
    expect(readVerdict({ isValid: false }, ["valid", "isValid"], true).value).toBe(false)
    expect(readVerdict({ is_valid: true }, ["valid", "is_valid"], false).value).toBe(true)
  })

  it("memakai fallback HANYA bila tidak ada alias yang dikirim", () => {
    // Arah fallback adalah keputusan keamanan: untuk PIN/password fallback-nya
    // `false`, sehingga bentuk respons tak dikenal TIDAK meloloskan verifikasi.
    expect(readVerdict({ message: "ok" }, ["valid"], false).value).toBe(false)
    expect(readVerdict({ message: "ok" }, ["favorited"], true).value).toBe(true)
  })

  it("membuka pembungkus data/result", () => {
    expect(readVerdict({ data: { isValid: true } }, ["isValid"], false).value).toBe(true)
  })

  it("string 'true'/'false' tetap terbaca", () => {
    expect(readVerdict({ valid: "false" }, ["valid"], true).value).toBe(false)
  })
})

describe("normalizeVoucherValidation", () => {
  it("voucher valid dengan alias isValid tetap diakui valid", () => {
    const result = normalizeVoucherValidation({
      isValid: true,
      voucher: { code: "HEMAT10", discountValue: 10000 },
    })
    expect(result.valid).toBe(true)
    expect(result.voucher?.code).toBe("HEMAT10")
    expect(result.voucher?.discountValue).toBe(10000)
  })

  it("voucher tidak berlaku membawa pesan dari backend", () => {
    const result = normalizeVoucherValidation({ valid: false, message: "Kode sudah dipakai" })
    expect(result.valid).toBe(false)
    expect(result.message).toBe("Kode sudah dipakai")
  })

  it("bentuk tak dikenal TIDAK diklaim valid", () => {
    expect(normalizeVoucherValidation({ ok: 1 }).valid).toBe(false)
  })
})

describe("normalizePaymentStatus", () => {
  it("membaca status dari alias `paymentStatus` — polling berhenti saat PAID", () => {
    expect(normalizePaymentStatus({ paymentStatus: "paid" }).status).toBe("PAID")
  })

  it("membaca status dari `payment.status` bersarang", () => {
    expect(normalizePaymentStatus({ payment: { status: "EXPIRED" } }).status).toBe("EXPIRED")
  })

  it("default PENDING bila backend tidak mengirim status", () => {
    expect(normalizePaymentStatus({}).status).toBe("PENDING")
  })

  it("membawa paidAt dan method", () => {
    const result = normalizePaymentStatus({
      status: "PAID",
      paid_at: "2026-09-09T10:00:00Z",
      paymentMethod: "QRIS",
    })
    expect(result.paidAt).toBe("2026-09-09T10:00:00Z")
    expect(result.method).toBe("QRIS")
  })
})

describe("pickBoolean pada field KYC", () => {
  it("'tidak dikirim' berbeda dari 'false' — ini akar bug transfer", () => {
    const tanpaField = pickBoolean({ username: "budi" }, ["kycVerified"])
    expect(tanpaField).toBeUndefined()
    expect(tanpaField !== true).toBe(true) // pola lama: semua penerima jadi nonaktif
    expect(pickBoolean({ kycVerified: false }, ["kycVerified"])).toBe(false)
  })
})

describe("parseRetryAfterMs", () => {
  it("membaca delta-detik", () => {
    expect(parseRetryAfterMs("120")).toBe(120_000)
    expect(parseRetryAfterMs("0")).toBeUndefined()
  })

  it("membaca tanggal HTTP", () => {
    const future = new Date(Date.now() + 60_000).toUTCString()
    const ms = parseRetryAfterMs(future)
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(60_000)
  })

  it("tanggal masa lalu dan nilai rusak → undefined", () => {
    expect(parseRetryAfterMs(new Date(Date.now() - 60_000).toUTCString())).toBeUndefined()
    expect(parseRetryAfterMs("sebentar lagi")).toBeUndefined()
    expect(parseRetryAfterMs(null)).toBeUndefined()
    expect(parseRetryAfterMs("")).toBeUndefined()
  })

  it("dibatasi 24 jam supaya UI tidak menampilkan hitung mundur absurd", () => {
    const farFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toUTCString()
    expect(parseRetryAfterMs(farFuture)).toBe(24 * 60 * 60 * 1000)
    expect(parseRetryAfterMs("999999")).toBe(24 * 60 * 60 * 1000)
  })
})
