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
export function assertDtoConstraints(dto: object, rules: Rules): void {
  const values = dto as Record<string, unknown>
  for (const [key, rule] of Object.entries(rules)) {
    const value = values[key]
    if (value == null) continue // Optionality is enforced by the DTO and server.
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
