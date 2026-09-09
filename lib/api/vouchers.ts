import { asRecord, pickBoolean, pickString, readList, readVerdict } from "@/lib/api/response"
/**
 * Kahade — domain `vouchers` (3 endpoint publik-otentikasi).
 * Dipakai VoucherRedeemBox saat membuat order & halaman voucher.
 */
import { http } from "@/lib/api/client"
import type { ValidateVoucherDto } from "@/lib/api/types"

/** Voucher — UNVERIFIED. */
export type Voucher = {
  code: string
  title?: string
  description?: string
  discountType?: "FIXED" | "PERCENT"
  discountValue?: number
  minOrderValue?: number
  maxDiscount?: number
  expiresAt?: string | null
  active: boolean
  usedAt?: string
  usageId?: string
}

export type VoucherValidation = {
  valid: boolean
  voucher?: Voucher
  message?: string
}

export function listAvailableVouchers(signal?: AbortSignal) {
  return http
    .get<Voucher[]>("/v1/vouchers/available", { auth: "required", retry: 1, signal })
    .then((raw) => readList<Voucher>(raw, ["vouchers"]))
}

export function listMyVoucherUsage(signal?: AbortSignal) {
  return http
    .get<Voucher[]>("/v1/vouchers/my-usage", { auth: "required", retry: 1, signal })
    .then((raw) => readList<Voucher>(raw, ["usages", "usage"]))
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
  const voucher = voucherRecord
    ? ({
        ...voucherRecord,
        code: pickString(voucherRecord, ["code", "voucherCode"]) ?? "",
        active: pickBoolean(voucherRecord, ["active", "isActive"]) ?? true,
      } as Voucher)
    : undefined
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
