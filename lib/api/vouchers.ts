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
}

export type VoucherValidation = {
  valid: boolean
  voucher?: Voucher
  message?: string
}

export function listAvailableVouchers() {
  return http.get<Voucher[]>("/v1/vouchers/available", { auth: "required", retry: 1 })
}

export function listMyVoucherUsage() {
  return http.get<Voucher[]>("/v1/vouchers/my-usage", { auth: "required", retry: 1 })
}

export function validateVoucher(dto: ValidateVoucherDto) {
  return http.post<VoucherValidation, ValidateVoucherDto>("/v1/vouchers/validate", dto, {
    auth: "required",
  })
}
