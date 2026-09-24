/**
 * M-07 (audit escrow 2026-09-24): tes domain order/escrow — satu-satunya
 * lapisan yang menjamin state machine, uang, dan normalizer tetap benar.
 *
 * Cakupan: matriks status × peran (gerbang aksi), `nextOrderStatus` kebal
 * kunci prototipe (A-01/M-03), pembagian fee integer (B-03/B-06/B-07/B-11),
 * `toEpochMs` domain jam (C-04/C-07/I-01), `parseRupiah`/`amountInputValue`
 * konsisten (B-10), `formatRupiah` menolak pecahan (I-04), `unwrapResponse`
 * envelope gagal (B-04), `normalizeInvoice` menolak total negatif (B-08) dan
 * tidak mengarang nomor (B-14), `toAmount` integer-only (B-09), `redactSensitive`
 * (L-03), `buildUrl` skip string kosong (H-06), `seg` menolak pemisah (H-05),
 * `assertDtoConstraints` menolak `null` non-nullable (B-12), `hasOwn` (I-02).
 */
import { describe, expect, it } from "vitest"

import {
  isCancellable,
  isDisputable,
  isExtendable,
  nextOrderStatus,
  toAmount,
  normalizeInvoice,
  ORDER_STATUS_FILTERS,
} from "@/lib/api/orders"
import { ORDER_STATUS_LABELS } from "@/lib/labels/status"
import { unwrapResponse, readList, readPage } from "@/lib/api/response"
import { redactSensitive, ApiError } from "@/lib/api/errors"
import { buildUrl, seg } from "@/lib/api/client"
import { assertDtoConstraints } from "@/lib/financial"
import { hasOwn } from "@/lib/has-own"
import {
  amountInputValue,
  formatCountdown,
  formatRupiah,
  parseRupiah,
  parseRupiahPartial,
  durationHoursParts,
} from "@/lib/format"
import { toEpochMs } from "@/lib/pending-actions"
import { feeShare, splitFee } from "@/lib/financial"

describe("state machine: status × peran", () => {
  it("pembatalan hanya pra-kirim (A-04)", () => {
    expect(isCancellable("WAITING_CONFIRMATION")).toBe(true)
    expect(isCancellable("PROCESSING")).toBe(true)
    expect(isCancellable("IN_DELIVERY")).toBe(false)
    expect(isCancellable("DELIVERED")).toBe(false)
  })

  it("sengketa terbuka sejak dana berjalan + WAITING_CONFIRMATION (A-05/A-06)", () => {
    expect(isDisputable("WAITING_CONFIRMATION")).toBe(true)
    expect(isDisputable("PAID")).toBe(true)
    expect(isDisputable("IN_DELIVERY")).toBe(true)
    expect(isDisputable("COMPLETED")).toBe(false)
    expect(isDisputable("WAITING_PAYMENT")).toBe(false)
  })

  it("perpanjangan hanya pra-kirim (F-03)", () => {
    expect(isExtendable("PROCESSING")).toBe(true)
    expect(isExtendable("IN_DELIVERY")).toBe(false)
    expect(isExtendable("DELIVERED")).toBe(false)
  })

  it("nextOrderStatus kebal kunci prototipe (A-01/M-03)", () => {
    expect(nextOrderStatus("toString")).toBeUndefined()
    expect(nextOrderStatus("constructor")).toBeUndefined()
    expect(typeof nextOrderStatus("WAITING_CONFIRMATION")).toBe("string")
  })

  it("ORDER_STATUS_FILTERS sinkron dengan tabel label (I-03)", () => {
    // I-03: filter, label, dan peta transisi harus sinkron — tes ini mengunci
    // agar satu pihak tidak menambah status tanpa yang lain. Setiap status
    // filter wajib punya label (chip filter dan badge kartu tidak boleh
    // menampilkan enum mentah).
    for (const status of ORDER_STATUS_FILTERS as readonly string[]) {
      expect(Object.keys(ORDER_STATUS_LABELS)).toContain(status)
    }
  })
})

describe("uang (B-03/B-06/B-07/B-11/I-04)", () => {
  it("splitFee integer; sisa pembulatan ke pembeli", () => {
    expect(splitFee(10_001, "SPLIT")).toEqual({ buyer: 5_001, seller: 5_000 })
    expect(splitFee(10_000, "BUYER")).toEqual({ buyer: 10_000, seller: 0 })
  })

  it("invariant B-06: pays - gets == fee - discount", () => {
    const orderValue = 100_000
    const fee = 10_000
    const discount = 2_000
    // M-11 (audit end-to-end): rumus fallback FeeBreakdown diperbaiki —
    // voucher penuh memotong TAGIHAN pembeli; penjual tidak menerima share
    // voucher. pays = V + s.b − D; gets = V − s.s.
    const share = splitFee(fee, "SPLIT")
    const pays = orderValue + share.buyer - discount
    const gets = orderValue - share.seller
    expect(pays - gets).toBe(fee - discount)
    // V=100rb, fee=10rb SPLIT (s.b=5rb), diskon=2rb → pays=100+5−2=103rb;
    // gets=100−5=95rb. Voucher penuh memotong tagihan pembeli (M-11).
    expect(pays).toBe(103_000)
    expect(gets).toBe(95_000)
  })

  it("feeShare hanya label persen (B-07)", () => {
    expect(feeShare("SPLIT")).toEqual({ buyer: 0.5, seller: 0.5 })
  })

  it("formatRupiah menolak pecahan nyata (I-04)", () => {
    expect(formatRupiah(1000.5)).toBe("—")
    expect(formatRupiah(1500)).toBe("Rp1.500")
  })
})

describe("input uang konsisten (B-09/B-10)", () => {
  it("toAmount integer-only", () => {
    expect(toAmount(1500)).toBe(1500)
    expect(toAmount("1500")).toBe(1500)
    expect(toAmount("1500.5")).toBeUndefined()
    expect(toAmount(1500.5)).toBeUndefined()
  })

  it("parseRupiah vs amountInputValue: pemisah ambigu ditolak", () => {
    expect(Number.isNaN(parseRupiah("10.000,50"))).toBe(true)
    expect(amountInputValue("1.000.50")).toBeNull() // B-10: dulu 100050!
    expect(parseRupiahPartial("1.000.000")).toBe(1_000_000)
    expect(parseRupiahPartial("1.0000")).toBe(10_000) // typing state sah
  })

  it("normalizeInvoice: total negatif ditolak, nomor tidak dikarang (B-08/B-14)", () => {
    expect(() =>
      normalizeInvoice({ invoiceNumber: "INV-1", total: -1, issuedAt: "2026-09-24", items: [] }, "o1"),
    ).toThrow()
    const inv = normalizeInvoice(
      { total: 1000, issuedAt: "2026-09-24", items: [{ label: "x", amount: 1000 }] },
      "o1",
    )
    expect(inv.invoiceNumber).toBeUndefined()
  })
})

describe("waktu (C-04/C-07/I-01/I-05/I-06)", () => {
  it("toEpochMs mencampur domain jam dengan benar", () => {
    expect(toEpochMs(1_700_000_000_000)).toBe(1_700_000_000_000) // ms
    expect(toEpochMs(1_700_000_000)).toBe(1_700_000_000_000) // detik → ms
    expect(toEpochMs("1700000000000")).toBe(1_700_000_000_000) // string numerik (C-07)
    expect(toEpochMs("2026-09-24T00:00:00Z")).toBe(Date.parse("2026-09-24T00:00:00Z"))
    expect(toEpochMs(-5)).toBeUndefined()
  })

  it("formatCountdown >24 jam menyebut hari (I-06); durationHoursParts enum (I-05)", () => {
    expect(formatCountdown(2 * 86_400 + 4 * 3600)).toContain("hari")
    expect(durationHoursParts(48)).toEqual({ value: "2", unit: "day" })
  })
})

describe("kontrak & keamanan (B-04/B-12/D-10/H-05/H-06/L-03/I-02)", () => {
  it("unwrapResponse melempar envelope {success:false} (B-04)", () => {
    expect(() => unwrapResponse({ success: false, message: "x" })).toThrow()
    expect(unwrapResponse({ success: true, data: { a: 1 } })).toEqual({ a: 1 })
  })

  it("readList/readPage toleran kunci alias (D-01..D-04)", () => {
    expect(readList({ proofs: [{ id: "1" }] }, ["proofs"])).toHaveLength(1)
    const page = readPage({ data: [{ id: "1" }], meta: {} }, { page: 1, limit: 20 }, ["data"])
    expect(page.data).toHaveLength(1)
    expect(page.meta.total).toBeUndefined() // M-01: total boleh tiada, bukan 0 palsu
  })

  it("assertDtoConstraints menolak null non-nullable (B-12)", () => {
    expect(() => assertDtoConstraints({ name: null }, { name: { maxLength: 5 } })).toThrow()
    expect(() => assertDtoConstraints({}, { name: { maxLength: 5 } })).not.toThrow()
  })

  it("seg menolak pemisah URL (H-05); buildUrl skip string kosong (H-06)", () => {
    expect(() => seg("a/b")).toThrow(ApiError)
    expect(seg("abc")).toBe("abc")
    const url = buildUrl("/v1/x", { status: "", page: "2" })
    expect(url).not.toContain("status=")
    expect(url).toContain("page=2")
  })

  it("redactSensitive menyamarkan PIN/token (L-03)", () => {
    const safe = redactSensitive({ pin: "123456", note: "ok" }) as Record<string, unknown>
    expect(safe.pin).toBe("***")
    expect(safe.note).toBe("ok")
  })

  it("hasOwn kebal kunci prototipe (I-02)", () => {
    expect(hasOwn({ a: 1 }, "a")).toBe(true)
    expect(hasOwn({}, "toString")).toBe(false)
  })
})
