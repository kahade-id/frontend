import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { ApiError } from "@/lib/api/errors"
import { formatRupiah } from "@/lib/format"

export type AmountLimits = { minimum: number; maximum: number }
export const AMOUNT_LIMITS = {
  topup: API_CONSTRAINTS.TopupDto.amount,
  withdraw: API_CONSTRAINTS.WithdrawDto.amount,
  transfer: API_CONSTRAINTS.TransferDto.amount,
  order: API_CONSTRAINTS.CreateOrderDto.orderValue,
} as const

export function isValidAmount(value: number, limits: AmountLimits): boolean {
  return Number.isSafeInteger(value) && value >= limits.minimum && value <= limits.maximum
}
export function assertValidAmount(value: number, limits: AmountLimits): void {
  if (!isValidAmount(value, limits))
    throw new ApiError({
      code: "VALIDATION",
      message: `Nominal harus berupa Rupiah bulat antara ${formatRupiah(limits.minimum)} dan ${formatRupiah(limits.maximum)}.`,
    })
}

/** Suggestions only; not balances, prices or fees. Contract limits remain authoritative. */
export const AMOUNT_PRESETS = {
  topup: [50_000, 100_000, 250_000, 500_000, 1_000_000],
  withdraw: [100_000, 250_000, 500_000, 1_000_000, 5_000_000],
  transfer: [25_000, 50_000, 100_000, 500_000, 1_000_000],
}

type Rules = Readonly<
  Record<
    string,
    {
      readonly minimum?: number
      readonly maximum?: number
      readonly minLength?: number
      readonly maxLength?: number
      readonly minItems?: number
      readonly maxItems?: number
      readonly enum?: readonly (string | number)[]
      readonly pattern?: string
    }
  >
>
/** Cache `RegExp` hasil kompilasi agar pola tidak dikompilasi ulang tiap pemanggilan. */
const patternCache = new Map<string, RegExp>()

/** Runtime counterpart of generated DTO rules; a TypeScript cast must not bypass validation. */
/**
 * Porsi biaya (0–1) per pihak untuk satu skema penanggung.
 *
 * B-07 (audit escrow 2026-09-24): `feeShare` HANYA untuk label persen — semua
 * perhitungan UANG wajib `splitFee` (satu jalur; nilai integer). Jangan pakai
 * `feeShare` untuk menghitung nominal: 0.5 × fee desimal menghasilkan pecahan.
 */
export function feeShare(responsibility: string): { buyer: number; seller: number } {
  if (responsibility === "BUYER") return { buyer: 1, seller: 0 }
  if (responsibility === "SELLER") return { buyer: 0, seller: 1 }
  return { buyer: 0.5, seller: 0.5 }
}

/**
 * Pembagian nominal biaya per penanggung — INTEGER Rupiah (B-03).
 *
 * B-03: fee desimal pernah dibagi `Math.floor(fee / 2)` menjadi pecahan
 * (5000,5) yang beredar di kartu biaya. Sumber kini integer (`toAmount`),
 * dan defensif terakhir: nilai non-integer di-truncate ke bawah — lebih baik
 * sisa 1 rupiah tampil eksplisit di baris SPLIT (B-11) daripada pecahan.
 * SPLIT: sisa pembulatan DIBEBANKAN KE PEMBELI (`buyer = fee - half`) —
 * dipertahankan karena sudah dikomunikasikan di UI (B-11).
 */
export function splitFee(feeAmount: number, responsibility: string): { buyer: number; seller: number } {
  const fee = Math.max(Math.trunc(feeAmount) || 0, 0)
  if (responsibility === "BUYER") return { buyer: fee, seller: 0 }
  if (responsibility === "SELLER") return { buyer: 0, seller: fee }
  const half = Math.floor(fee / 2)
  return { buyer: fee - half, seller: half }
}

export function assertDtoConstraints(dto: object, rules: Rules): void {
  const values = dto as Record<string, unknown>
  for (const [key, rule] of Object.entries(rules)) {
    const value = values[key]
    // B-12 (audit escrow 2026-09-24): hanya `undefined` yang OPSIONAL.
    // `null` dulu lolos lewat `value == null` — `attachments: null` /
    // `voucherCode: null` mem-bypass minItems/maxItems lalu dikirim sebagai
    // `"attachments":null` yang ditolak validator backend. `null` untuk field
    // non-nullable = VALIDATION di klien juga.
    if (value === undefined) continue
    if (value === null)
      throw new ApiError({
        code: "VALIDATION",
        message: `Isian ${key} tidak sesuai ketentuan layanan.`,
      })
    let valid = true
    if (rule.enum) valid = rule.enum.includes(value as string | number)
    if (rule.minimum != null || rule.maximum != null)
      valid =
        valid &&
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= (rule.minimum ?? Number.MIN_SAFE_INTEGER) &&
        value <= (rule.maximum ?? Number.MAX_SAFE_INTEGER)
    if (rule.minLength != null || rule.maxLength != null)
      valid =
        valid &&
        typeof value === "string" &&
        value.length >= (rule.minLength ?? 0) &&
        value.length <= (rule.maxLength ?? Infinity)
    /**
     * `pattern`, `minItems`, dan `maxItems` sebelumnya TIDAK ditegakkan, bahkan
     * tidak ada di tipe `Rules` — padahal generator menuliskannya ke
     * `API_CONSTRAINTS` (mis. `SubmitKycDto.nik` = `^\d{16}$`,
     * `AddBankAccountDto.accountNumber` = `^\d{6,20}$`). Aturan itu ada di data
     * tetapi diabaikan diam-diam, sehingga validasi tampak berjalan padahal tidak.
     *
     * `RegExp` dikompilasi sekali per aturan, bukan per pemanggilan.
     */
    if (rule.pattern != null)
      valid =
        valid &&
        typeof value === "string" &&
        (patternCache.get(rule.pattern) ??
          patternCache.set(rule.pattern, new RegExp(rule.pattern)).get(rule.pattern)!).test(value)
    if (rule.minItems != null || rule.maxItems != null)
      valid =
        valid &&
        Array.isArray(value) &&
        value.length >= (rule.minItems ?? 0) &&
        value.length <= (rule.maxItems ?? Infinity)
    if (!valid)
      throw new ApiError({
        code: "VALIDATION",
        message: `Isian ${key} tidak sesuai ketentuan layanan.`,
      })
  }
}
