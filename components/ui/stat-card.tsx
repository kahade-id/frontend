/**
 * StatCard — kartu metrik ringkas (saldo tertahan, transaksi aktif, rating)
 * untuk beranda dan dashboard penjual (§9 Display, "Stat").
 *
 * Keputusan non-obvious:
 *   - Dibangun di atas <Card> (bukan View sendiri) supaya border, variant, dan
 *     pressed-scale konsisten; StatCard hanya menyusun tipografi di dalamnya.
 *   - Nilai memakai heading-md tabular (font-mono opsional lewat `mono`) agar
 *     angka tidak "loncat" saat berubah — penting untuk saldo yang di-refresh.
 *   - `delta` mendapat warna semantik success/danger HANYA pada teks + ikon
 *     panah kecil, bukan background; §4 membatasi warna aksen ke elemen kecil.
 *   - Loading = Skeleton pada baris nilai saja; label tetap tampil supaya
 *     layout tidak melompat (CLS) saat data masuk.
 */
import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight } from "phosphor-react-native"

import { Card, type CardProps } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { View } from "react-native"

export type StatDelta = {
  /** Teks sudah diformat, mis. "+12%" atau "-Rp 50.000" */
  label: string
  direction: "up" | "down" | "flat"
}

export type StatCardProps = Omit<CardProps, "children"> & {
  label: string
  /** Nilai sudah diformat (pakai lib/format) atau node kustom (mis. <Amount/>) */
  value: ReactNode
  hint?: string
  delta?: StatDelta
  /** Ikon kecil di kanan atas label */
  icon?: ReactNode
  loading?: boolean
  mono?: boolean
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  loading = false,
  mono = false,
  className,
  variant = "default",
  ...cardProps
}: StatCardProps) {
  const inverted = variant === "inverted"
  const deltaTone =
    delta?.direction === "up"
      ? "text-success"
      : delta?.direction === "down"
        ? "text-danger"
        : inverted
          ? "text-text-inverse-secondary"
          : "text-text-secondary"

  return (
    <Card variant={variant} className={cn("gap-2", className)} {...cardProps}>
      <View className="flex-row items-center justify-between gap-2">
        <Text
          variant="body-sm"
          className={inverted ? "text-text-inverse-secondary" : "text-text-secondary"}
          numberOfLines={1}
        >
          {label}
        </Text>
        {icon ? <View>{icon}</View> : null}
      </View>

      {loading ? (
        <Skeleton className="h-8 w-3/5" />
      ) : typeof value === "string" || typeof value === "number" ? (
        <Text
          variant="heading-md"
          weight="semibold"
          className={cn(inverted ? "text-text-inverse" : "text-text-primary", mono && "font-mono")}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      ) : (
        value
      )}

      {delta || hint ? (
        <View className="flex-row items-center gap-1">
          {delta ? (
            <View className="flex-row items-center gap-[2px]">
              {delta.direction === "up" ? (
                <Icon icon={ArrowUpRight} size="xs" className={deltaTone} />
              ) : delta.direction === "down" ? (
                <Icon icon={ArrowDownRight} size="xs" className={deltaTone} />
              ) : null}
              <Text variant="caption" weight="medium" className={deltaTone}>
                {delta.label}
              </Text>
            </View>
          ) : null}
          {hint ? (
            <Text
              variant="caption"
              className={inverted ? "text-text-inverse-secondary" : "text-text-tertiary"}
              numberOfLines={1}
            >
              {hint}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}
