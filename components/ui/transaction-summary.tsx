/**
 * Kahade — <TransactionSummary> (kartu ringkasan transaksi — konfirmasi).
 *
 * Kartu eksklusif untuk step konfirmasi Isi Saldo, Tarik Dana, Transfer.
 * Layout:
 *   - Nominal BESAR di bagian atas (centered), aksen accent
 *   - Divider
 *   - Deret KeyValue (metode, penerima/rekening, biaya, catatan, ref)
 *   - Total final di bagian bawah (emphasis)
 *
 * Bersifat komposisional (children untuk baris KeyValue) supaya pemanggil
 * bisa memasang baris yang relevan untuk alurnya (topup/withdraw/transfer).
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Card } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type TransactionSummaryProps = Omit<ViewProps, "children"> & {
  /** Label di atas nominal (mis. "Jumlah top-up") */
  label?: string
  /** Nominal utama yang ditampilkan besar */
  amount: number
  /** Tone nominal — default "primary"; "accent" untuk dana berhasil/escrow */
  amountTone?: "primary" | "accent" | "success" | "danger"
  /** Sub-teks di bawah nominal (mis. "Ke BCA • 1234567890 a.n. Budi") */
  subtitle?: string
  /** Baris detail (KeyValue) di dalam kartu */
  children?: ReactNode
  /** Total baris bawah (setelah divider) */
  totalLabel?: string
  totalValue?: number
  totalHint?: string
  className?: string
}

export function TransactionSummary({
  label,
  amount,
  amountTone = "primary",
  subtitle,
  children,
  totalLabel,
  totalValue,
  totalHint,
  className,
  ...rest
}: TransactionSummaryProps) {
  return (
    <Card variant="elevated" className={cn("gap-4", className)} {...rest}>
      {/* ----- Hero nominal di tengah ----- */}
      <View className="items-center gap-1 py-2">
        {label ? (
          <Text variant="caption" tone="secondary" className="text-center uppercase tracking-wider">
            {label}
          </Text>
        ) : null}
        <Amount value={amount} size="large" tone={amountTone} className="text-center" animated={false} />
        {subtitle ? (
          <Text variant="body" tone="secondary" className="text-center text-balance" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {children ? (
        <>
          <Divider />
          <View className="gap-0">{children}</View>
        </>
      ) : null}

      {totalLabel && totalValue != null ? (
        <>
          <Divider />
          <View className="flex-row items-end justify-between gap-4">
            <View className="gap-0.5">
              <Text variant="body" weight={500} tone="secondary">
                {totalLabel}
              </Text>
              {totalHint ? (
                <Text variant="caption" tone="secondary">
                  {totalHint}
                </Text>
              ) : null}
            </View>
            <Amount value={totalValue} size="large" tone="primary" />
          </View>
        </>
      ) : null}
    </Card>
  )
}
