/**
 * Kahade — <PaymentMethodSelector> (§9.5 Radio varian card, §9.7 Badge,
 * §3.1 Mono untuk nominal, §13 format Rupiah).
 *
 * Pemilih metode pembayaran untuk top-up saldo / bayar order escrow:
 * transfer bank (VA), e-wallet, QRIS, saldo Kahade. Data datang dari
 * `GET /v1/wallet/payment-methods` yang sudah menyertakan biaya per metode —
 * komponen ini menampilkan biaya itu apa adanya agar pengguna tahu total
 * sebelum menekan "Bayar".
 *
 * Dibangun DI ATAS <RadioGroup variant="card"> — pola yang sama dengan
 * <TwoFactorMethodSelector> — karena semantiknya persis "pilih satu":
 * screen reader membaca "radio, 1 dari 4", dan hierarki pilihan datang dari
 * border-focus kartu Radio (§6), bukan fill/shadow.
 *
 * Keputusan non-obvious:
 *   - Biaya dirender `monoBody` di kolom kanan (`trailing` dirakit ke dalam
 *     `label` karena Radio tidak punya slot trailing): "Gratis" bila 0,
 *     "+Rp4.000" bila flat, "+0,7%" bila persentase. Tanda "+" eksplisit
 *     menegaskan ini TAMBAHAN di atas nominal, bukan potongan (§13).
 *   - Saldo Kahade (`kind: "balance"`) menampilkan saldo tersedia sebagai
 *     deskripsi dan otomatis `disabled` bila `balance < amount` — pengguna
 *     tidak dibiarkan memilih lalu gagal di server. Alasannya ditulis di
 *     deskripsi ("Saldo tidak cukup"), bukan hanya diredupkan.
 *   - Ikon kategori memakai Phosphor monokrom (Bank, Wallet, QrCode, Coins),
 *     BUKAN logo bank/e-wallet berwarna: logo pihak ketiga memecah sistem
 *     monokrom (§1) dan menuntut lisensi aset. Nama provider ("BCA Virtual
 *     Account", "GoPay") sudah cukup membedakan. Pemanggil bisa mengirim
 *     `icon` per metode bila punya glyph monokrom sendiri.
 *   - `recommended` menambah <Badge tone="neutral" variant="outline">
 *     "Disarankan" — netral, bukan success: rekomendasi bukan status
 *     transaksi (§2.3).
 *   - Metode yang sedang gangguan (`unavailable`) tetap ditampilkan dengan
 *     `disabled` + deskripsi alasan, supaya pengguna tidak mencari-cari
 *     metode yang "hilang". Konsisten dengan BackupCodesDisplay yang tidak
 *     menyembunyikan kode terpakai.
 *   - Komponen stateless: `value`/`onChange` dari parent (id metode).
 */
import type { ReactNode } from "react"
import { Bank, Coins, QrCode, Wallet } from "phosphor-react-native"
import { View } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Radio, RadioGroup, type RadioGroupProps } from "@/components/ui/radio"
import { Text } from "@/components/ui/text"
import { formatRupiah } from "@/lib/format"

export type PaymentMethodKind = "bank" | "ewallet" | "qris" | "balance"

export type PaymentMethodFee =
  | { type: "free" }
  | { type: "flat"; amount: number }
  | { type: "percent"; value: number }
  | {
      type: "combined"
      fixed?: number
      percent?: number
      minFee?: number
      maxFee?: number
      freeLimit?: number
    }

export type PaymentMethod = {
  id: string
  kind: PaymentMethodKind
  /** "BCA Virtual Account", "GoPay", "QRIS", "Saldo Kahade" */
  name: string
  /** Baris deskripsi tambahan, mis. "Verifikasi otomatis 1–5 menit" */
  description?: string
  fee?: PaymentMethodFee
  /** Hanya untuk kind "balance" */
  balance?: number
  minAmount?: number
  maxAmount?: number
  recommended?: boolean
  /** Sedang gangguan; alasan ditampilkan sebagai deskripsi */
  unavailable?: boolean
  unavailableReason?: string
  /** Override ikon kategori */
  icon?: IconComponent
}

export type PaymentMethodSelectorLabels = {
  free: string
  recommended: string
  balanceAvailable: (formatted: string) => string
  insufficientBalance: string
  unavailable: string
}

export type PaymentMethodSelectorProps = Omit<
  RadioGroupProps,
  "children" | "variant" | "onChange"
> & {
  methods: PaymentMethod[]
  /** Nominal yang akan dibayar; dipakai untuk cek saldo cukup */
  amount?: number
  onChange: (methodId: string) => void
  labels?: Partial<PaymentMethodSelectorLabels>
}

const DEFAULT_LABELS: PaymentMethodSelectorLabels = {
  free: "Gratis",
  recommended: "Disarankan",
  balanceAvailable: (f) => `Saldo tersedia ${f}`,
  insufficientBalance: "Saldo tidak cukup untuk nominal ini",
  unavailable: "Sedang tidak tersedia",
}

const kindIcon: Record<PaymentMethodKind, IconComponent> = {
  bank: Bank,
  ewallet: Wallet,
  qris: QrCode,
  balance: Coins,
}

/** Biaya -> label Mono. Persentase memakai koma desimal (§13). */
export function formatPaymentFee(fee: PaymentMethodFee | undefined, freeLabel: string): string {
  if (!fee) return "Belum dikonfirmasi"
  if (fee.type === "free") return freeLabel
  if (fee.type === "combined") {
    const parts = [
      fee.fixed != null ? formatRupiah(fee.fixed, { sign: "always" }) : null,
      fee.percent != null ? `${String(fee.percent).replace(".", ",")}%` : null,
    ].filter(Boolean)
    const bounds = [
      fee.minFee != null ? `min ${formatRupiah(fee.minFee)}` : null,
      fee.maxFee != null ? `maks ${formatRupiah(fee.maxFee)}` : null,
      fee.freeLimit != null ? `gratis hingga ${formatRupiah(fee.freeLimit)}` : null,
    ].filter(Boolean)
    return [...parts, ...bounds].join(" · ") || freeLabel
  }
  if (fee.type === "flat")
    return fee.amount === 0 ? freeLabel : formatRupiah(fee.amount, { sign: "always" })
  return `+${String(fee.value).replace(".", ",")}%`
}

export function PaymentMethodSelector({
  methods,
  amount,
  value,
  onChange,
  disabled,
  labels,
  ...rest
}: PaymentMethodSelectorProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  return (
    <RadioGroup value={value} onChange={onChange} disabled={disabled} variant="card" {...rest}>
      {methods.map((m) => {
        const insufficient =
          m.kind === "balance" && amount != null && m.balance != null && m.balance < amount
        const outOfRange =
          amount != null &&
          ((m.minAmount != null && amount < m.minAmount) ||
            (m.maxAmount != null && amount > m.maxAmount))
        const isDisabled = !canUsePaymentMethod(
          m,
          amount != null && amount > 0 ? amount : undefined,
        )
        const feeLabel = formatPaymentFee(m.fee, t.free)

        let description: ReactNode = m.description
        if (m.unavailable) description = m.unavailableReason ?? t.unavailable
        else if (outOfRange)
          description = [
            m.minAmount != null ? `Minimal ${formatRupiah(m.minAmount)}` : null,
            m.maxAmount != null ? `maksimal ${formatRupiah(m.maxAmount)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        else if (insufficient) description = t.insufficientBalance
        else if (m.kind === "balance" && m.balance != null)
          description = t.balanceAvailable(formatRupiah(m.balance))

        return (
          <Radio
            key={m.id}
            value={m.id}
            disabled={isDisabled}
            leading={<Icon icon={m.icon ?? kindIcon[m.kind]} size="sm" />}
            label={
              <View accessible={false} className="flex-row flex-wrap items-center gap-2">
                <Text
                  variant="body"
                  weight={500}
                  tone={isDisabled ? "disabled" : "primary"}
                  className="shrink"
                >
                  {m.name}
                </Text>
                {m.recommended && !isDisabled ? (
                  <Badge tone="neutral" variant="outline">
                    {t.recommended}
                  </Badge>
                ) : null}
                <View className="flex-1" />
                <Text variant="monoBody" tone={isDisabled ? "disabled" : "secondary"}>
                  {feeLabel}
                </Text>
              </View>
            }
            description={description}
            accessibilityLabel={`${m.name}, biaya ${feeLabel}${m.recommended ? `, ${t.recommended}` : ""}${
              typeof description === "string" ? `, ${description}` : ""
            }`}
          />
        )
      })}
    </RadioGroup>
  )
}

export function canUsePaymentMethod(method: PaymentMethod | undefined, amount?: number): boolean {
  if (!method || method.unavailable) return false
  if (amount == null) return true
  if (!Number.isFinite(amount)) return false
  if (method.minAmount != null && amount < method.minAmount) return false
  if (method.maxAmount != null && amount > method.maxAmount) return false
  if (method.kind === "balance" && (method.balance == null || method.balance < amount)) return false
  return true
}
