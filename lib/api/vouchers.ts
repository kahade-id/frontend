/**
 * Kahade — domain `vouchers` (3 endpoint publik-otentikasi).
 * Dipakai VoucherRedeemBox saat membuat order & halaman voucher.
 */

import { asRecord, pickBoolean, pickNumber, pickString, readList, readVerdict } from "@/lib/api/response"

import { http } from "@/lib/api/client"
import type { ValidateVoucherDto } from "@/lib/api/types"

/** Voucher — UNVERIFIED. */
export type Voucher = {
  code: string
  title?: string
  description?: string
  discountType?: "FIXED" | "PERCENT"
  /**
   * Kosakata alternatif yang dipakai DTO admin (CreateVoucherDto):
   * FEE_DISCOUNT_FLAT | FEE_DISCOUNT_PERCENT | WALLET_CASHBACK | TOPUP_BONUS.
   * Spec mobile tidak mengekspor schema voucher, jadi layar membaca keduanya
   * (`discountTypeOf` di app/vouchers.ts) — menganggap "bukan FIXED = persen"
   * membuat voucher nominal tampil sebagai persen.
   */
  voucherType?: string
  discountValue?: number
  minOrderValue?: number
  maxDiscount?: number
  expiresAt?: string | null
  active: boolean
  usedAt?: string
  usageId?: string
  /**
   * Audit 2026-10-10 (F12): syarat peran dari `applicableTo` backend
   * (ALL | BUYER_ONLY | SELLER_ONLY | NEW_USER | DORMANT_USER) — dipetakan ke
   * badge Pembeli/Penjual di <VoucherCard>.
   */
  applicableTo?: VoucherApplicability
  /**
   * Audit 2026-10-10 (F08): pemakaian oleh user ini (backend B03:
   * `usedCount` / `remainingUses`; `remainingUses` null = tanpa batas per
   * user). `remainingUses === 0` → status "used".
   */
  usedCount?: number
  remainingUses?: number | null
}

export type VoucherApplicability = "ALL" | "BUYER_ONLY" | "SELLER_ONLY" | "NEW_USER" | "DORMANT_USER"

/**
 * Jenis manfaat voucher — menentukan bagaimana nominalnya DITAMPILKAN dan di
 * mana bisa dipakai (audit 2026-10-10, F10/F11):
 *   - FEE_DISCOUNT : potongan biaya layanan saat buat transaksi ("-Rp…").
 *   - CASHBACK     : dikreditkan setelah transaksi — BUKAN potongan tagihan.
 *   - TOPUP_BONUS  : bonus saldo saat top-up — create order MENOLAK kode ini.
 */
export type VoucherKind = "FEE_DISCOUNT" | "CASHBACK" | "TOPUP_BONUS" | "UNKNOWN"

export function voucherKindOf(voucherType: string | null | undefined): VoucherKind {
  const raw = (voucherType ?? "").toUpperCase()
  if (!raw) return "UNKNOWN"
  if (raw === "TOPUP_BONUS") return "TOPUP_BONUS"
  if (raw === "WALLET_CASHBACK" || raw === "CASHBACK") return "CASHBACK"
  if (raw.startsWith("FEE_DISCOUNT") || raw === "FIXED" || raw === "PERCENT" || raw === "PERCENTAGE") {
    return "FEE_DISCOUNT"
  }
  return "UNKNOWN"
}

/** Peta `applicableTo` backend → badge peran kartu voucher. */
export function voucherRoleOf(applicableTo: VoucherApplicability | undefined): "BUYER" | "SELLER" | "ALL" {
  if (applicableTo === "BUYER_ONLY") return "BUYER"
  if (applicableTo === "SELLER_ONLY") return "SELLER"
  return "ALL"
}

function normalizeApplicability(raw: string | undefined): VoucherApplicability | undefined {
  const value = raw?.toUpperCase()
  switch (value) {
    case "ALL":
    case "BUYER_ONLY":
    case "SELLER_ONLY":
    case "NEW_USER":
    case "DORMANT_USER":
      return value
    case "BUYER":
      return "BUYER_ONLY"
    case "SELLER":
      return "SELLER_ONLY"
    default:
      return undefined
  }
}

export type VoucherValidation = {
  valid: boolean
  voucher?: Voucher
  message?: string
}

/**
 * Audit 2026-10-10 (F18): backend memberi halaman (default 20, maks. 100).
 * Tanpa `limit`, voucher ke-21 dan seterusnya tidak pernah tampil — satu
 * halaman 100 cukup untuk katalog promo yang aktif bersamaan.
 */
const AVAILABLE_LIMIT = 100

export function listAvailableVouchers(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/vouchers/available", {
      query: { page: 1, limit: AVAILABLE_LIMIT },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) =>
      readList<unknown>(raw, ["vouchers"])
        .map(normalizeVoucher)
        .filter((v): v is Voucher => v !== null),
    )
}

/**
 * Normalizer `GET /v1/vouchers/available` — SP-037.
 *
 * Backend mengirim bentuk kanonis
 * `{ code, name, description, voucherType (FEE_DISCOUNT_FLAT |
 * FEE_DISCOUNT_PERCENT | WALLET_CASHBACK | TOPUP_BONUS), discountAmount (IDR)
 * | discountPercent (number), maxDiscountAmount (IDR), minOrderValue (IDR),
 * validUntil, isActive, … }`. Tanpa normalizer, kartu voucher menampilkan
 * kode sebagai judul, nominal "Rp—", dan tanpa tanggal kedaluwarsa karena
 * layar membaca `title`/`discountValue`/`expiresAt`.
 */
export function normalizeVoucher(raw: unknown): Voucher | null {
  const record = asRecord(raw)
  if (!record) return null
  const code = pickString(record, ["code", "voucherCode"])
  if (!code) return null
  const discountPercent = pickNumber(record, ["discountPercent"])
  const discountAmount = pickNumber(record, ["discountAmount"])
  const percentValue = discountPercent !== undefined && discountPercent > 0 ? discountPercent : null
  return {
    code,
    title: pickString(record, ["name", "title"]) ?? undefined,
    description: pickString(record, ["description"]) ?? undefined,
    discountType: percentValue !== null ? "PERCENT" : "FIXED",
    voucherType: pickString(record, ["voucherType", "type"]) ?? undefined,
    discountValue: percentValue ?? discountAmount ?? undefined,
    minOrderValue: pickNumber(record, ["minOrderValue"]) ?? undefined,
    maxDiscount: pickNumber(record, ["maxDiscountAmount", "maxDiscount"]) ?? undefined,
    expiresAt: pickString(record, ["validUntil", "expiresAt", "expiredAt"]) ?? undefined,
    active: pickBoolean(record, ["isActive", "active"]) ?? true,
    applicableTo: normalizeApplicability(pickString(record, ["applicableTo", "applicable_to"])),
    usedCount: pickNumber(record, ["usedCount", "used_count"]) ?? undefined,
    // `remainingUses` null (tanpa batas per user) harus tetap null — bukan
    // 0 (= habis) dan bukan undefined (= tidak diketahui).
    remainingUses:
      record.remainingUses === null || record.remaining_uses === null
        ? null
        : (pickNumber(record, ["remainingUses", "remaining_uses"]) ?? undefined),
  }
}

/** Satu baris riwayat pemakaian voucher — bentuk yang dipakai UI. */
export type VoucherUsage = {
  usageId: string
  code: string
  title: string
  discountValue?: number
  orderId?: string
  usedAt?: string
}

/**
 * Normalizer `GET /v1/vouchers/my-usage` — SP-036.
 *
 * Backend mengirim item pemakaian
 * `{ id, orderId, paymentTxId, discountAmount (IDR), usedAt,
 * voucher: { voucherId, code, name, voucherType } }` — BUKAN bentuk
 * `Voucher`. Tanpa normalizer, layar membaca `u.code`/`u.title` yang tidak
 * ada (undefined → crash `code.toUpperCase()` di VoucherUsageListItem).
 */
export function normalizeVoucherUsage(raw: unknown): VoucherUsage | null {
  const record = asRecord(raw)
  if (!record) return null
  const voucher = asRecord(record.voucher)
  const code = (voucher && pickString(voucher, ["code"])) || pickString(record, ["code"])
  if (!code) return null
  return {
    usageId: pickString(record, ["id", "usageId"]) ?? "",
    code,
    title: (voucher && pickString(voucher, ["name", "title"])) || pickString(record, ["title"]) || code,
    discountValue: pickNumber(record, ["discountAmount", "discountValue"]) ?? undefined,
    orderId: pickString(record, ["orderId"]) ?? undefined,
    usedAt: pickString(record, ["usedAt"]) ?? undefined,
  }
}

export function listMyVoucherUsage(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/vouchers/my-usage", { auth: "required", retry: 1, signal })
    .then((raw) =>
      readList<unknown>(raw, ["usages", "usage"])
        .map(normalizeVoucherUsage)
        .filter((u): u is VoucherUsage => u !== null),
    )
}

/**
 * Normalizer `POST /v1/vouchers/validate`.
 *
 * `app/create-transaction.tsx` membaca `res.valid`; tanpa normalizer, backend
 * yang menjawab `{ isValid: true, … }` membuat voucher apa pun tampak "tidak
 * berlaku" (`undefined` → falsy) tanpa pesan yang menjelaskan.
 */
export function normalizeVoucherValidation(raw: unknown): VoucherValidation {
  const { value, record } = readVerdict(raw, ["valid", "isValid", "is_valid", "applicable"], false)
  const voucherRecord = asRecord(record.voucher) ?? asRecord(record.voucherDetail)
  let voucher = voucherRecord
    ? ({
        ...voucherRecord,
        code: pickString(voucherRecord, ["code", "voucherCode"]) ?? "",
        active: pickBoolean(voucherRecord, ["active", "isActive"]) ?? true,
      } as Voucher)
    : undefined
  // SP-038: backend `POST /v1/vouchers/validate` menjawab DATAR (tanpa objek
  // `voucher` bersarang): `{ valid, voucherId, code, name, voucherType,
  // discountAmount | cashbackAmount | topupBonusAmount (IDR), discountPercent,
  // minOrderValue, maxDiscountAmount }`. Tanpa pemetaan ini `res.voucher`
  // selalu undefined sehingga nominal diskon tidak pernah tampil saat
  // apply voucher — baca bentuk datar sebagai fallback.
  if (!voucher) {
    const code = pickString(record, ["code", "voucherCode"])
    if (code) {
      const discountPercent = pickNumber(record, ["discountPercent"])
      const percentValue = discountPercent !== undefined && discountPercent > 0 ? discountPercent : null
      voucher = {
        code,
        title: pickString(record, ["name", "title"]) ?? undefined,
        voucherType: pickString(record, ["voucherType", "type"]) ?? undefined,
        discountType: percentValue !== null ? "PERCENT" : "FIXED",
        discountValue:
          percentValue ?? pickNumber(record, ["discountAmount", "cashbackAmount", "topupBonusAmount"]) ?? undefined,
        minOrderValue: pickNumber(record, ["minOrderValue"]) ?? undefined,
        maxDiscount: pickNumber(record, ["maxDiscountAmount", "maxDiscount"]) ?? undefined,
        // Audit 2026-10-10 (B07): backend kini mengirim `applicableTo` dan
        // `validUntil` agar layar bisa menyebut syarat peran/kedaluwarsa.
        applicableTo: normalizeApplicability(pickString(record, ["applicableTo", "applicable_to"])),
        expiresAt: pickString(record, ["validUntil", "expiresAt"]) ?? undefined,
        active: true,
      }
    }
  }
  return {
    valid: value,
    voucher,
    message: pickString(record, ["message", "reason", "detail"]),
  }
}

export function validateVoucher(dto: ValidateVoucherDto) {
  return http
    .post<unknown, ValidateVoucherDto>("/v1/vouchers/validate", dto, { auth: "required" })
    .then(normalizeVoucherValidation)
}
