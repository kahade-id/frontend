/**
 * Kahade — <StatCard> kartu metrik ringkas (§9.6 Stat/Highlight, §3.1 Mono).
 *
 * Saldo tertahan, transaksi aktif, rating — untuk beranda & dashboard
 * penjual. Dibangun di atas <Card> supaya border, variant (termasuk
 * "inverted" yang ikut invert di dark mode §9.6), dan pressed-scale konsisten;
 * StatCard hanya menyusun tipografi di dalamnya.
 *
 * Keputusan non-obvious:
 *   - Nilai string/number dirender `h2` (22/700, tabular-nums). Kalau nilai
 *     adalah nominal uang, kirim <Amount size="large"> sebagai `value` —
 *     ReactNode diterima — supaya format §13 dan Mono §3.1 datang dari satu
 *     tempat; `mono` di sini hanya untuk angka non-Rupiah (jumlah transaksi,
 *     skor) yang tetap ingin Mono Large.
 *   - Tidak ada `adjustsFontSizeToFit`: type scale FIXED (§3.2). Nilai yang
 *     terlalu panjang harus diformat lebih pendek (compact) oleh pemanggil,
 *     bukan dikecilkan diam-diam.
 *   - Di kartu inverted SEMUA teks tone "inverse" (primary-foreground) —
 *     token mode tidak punya "inverse-secondary", dan menambah opacity pada
 *     teks sekunder akan menurunkan kontras di bawah AA. Hierarki label vs
 *     nilai cukup dari ukuran + weight.
 *   - `delta` mendapat warna semantik hanya pada teks + ikon panah kecil,
 *     bukan background — warna status hanya untuk elemen kecil (§2.3).
 *     Di kartu inverted delta tetap inverse (semantic text di atas bg-primary
 *     hitam tidak dijamin AA).
 *   - Loading = <Skeleton> pada baris nilai saja; label tetap tampil supaya
 *     layout tidak melompat saat data masuk.
 */
import type { ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight } from "phosphor-react-native"
import { View } from "react-native"

import { Card, type CardProps } from "@/components/ui/card"
import { Icon, type IconTone } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Text, type TextTone } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"

export type StatDelta = {
  /** Teks sudah diformat, mis. "+12%" atau "-Rp50.000" */
  label: string
  direction: "up" | "down" | "flat"
}

export type StatCardProps = Omit<CardProps, "children"> & {
  label: string
  /** Nilai sudah diformat (lib/format) atau node kustom (mis. <Amount/>) */
  value: ReactNode
  hint?: string
  delta?: StatDelta
  /** Ikon kecil di kanan atas label */
  icon?: ReactNode
  loading?: boolean
  /** Nilai primitif dirender Mono Large (angka non-Rupiah yang tetap butuh Mono) */
  mono?: boolean
}

/** Prefiks arah delta untuk label SR — panah visual tidak punya teks. */
const DELTA_PREFIX: Record<StatDelta["direction"], string> = {
  up: "naik ",
  down: "turun ",
  flat: "",
}

function isPrimitive(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number"
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
  accessibilityLabel,
  ...cardProps
}: StatCardProps) {
  const inverted = variant === "inverted"

  const labelTone: TextTone = inverted ? "inverse" : "secondary"
  const valueTone: TextTone = inverted ? "inverse" : "primary"
  const hintTone: TextTone = inverted ? "inverse" : "secondary"

  const deltaTone: TextTone = inverted
    ? "inverse"
    : delta?.direction === "up"
      ? "success"
      : delta?.direction === "down"
        ? "danger"
        : "secondary"
  // Ikon panah mengikuti warna teks delta; Icon tidak punya tone "secondary",
  // arah "flat" tidak menampilkan panah sehingga tidak perlu dipetakan.
  const deltaIconTone: IconTone = inverted
    ? "inverse"
    : delta?.direction === "up"
      ? "success"
      : "danger"

  // Ringkasan SR: StatCard membaca label, nilai, delta, dan hint sebagai satu
  // elemen ("Total transaksi, Rp 1.500.000, naik 12%, bulan ini") alih-alih
  // 4 fragmen lepas. Hanya dipakai bila `value` primitif — node kustom
  // (mis. <Amount>) tidak bisa dibaca dari sini, dan `accessible` justru akan
  // menyembunyikannya, jadi grouping dilewati (audit #4).
  const a11y = loading
    ? `Memuat ${label}`
    : isPrimitive(value)
      ? summarize([label, String(value), delta?.label && `${DELTA_PREFIX[delta.direction]}${delta.label}`, hint])
      : undefined

  return (
    // <Card> yang menerima accessibilityLabel otomatis `accessible` (varian
    // statis) atau sudah satu elemen lewat PressableScale (varian onPress).
    <Card
      variant={variant}
      accessibilityLabel={accessibilityLabel ?? a11y}
      className={cn("gap-2", className)}
      {...cardProps}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="caption" weight={500} tone={labelTone} numberOfLines={1} className="flex-1">
          {label}
        </Text>
        {icon ? <View>{icon}</View> : null}
      </View>

      {loading ? (
        <Skeleton className="h-8 w-3/5" />
      ) : isPrimitive(value) ? (
        <Text variant={mono ? "monoLarge" : "h2"} tone={valueTone} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}

      {delta || hint ? (
        <View className="flex-row items-center gap-2">
          {delta ? (
            <View className="flex-row items-center gap-1">
              {delta.direction === "up" ? (
                <Icon icon={ArrowUpRight} size="xs" tone={deltaIconTone} />
              ) : delta.direction === "down" ? (
                <Icon icon={ArrowDownRight} size="xs" tone={deltaIconTone} />
              ) : null}
              <Text variant="caption" weight={500} tone={deltaTone}>
                {delta.label}
              </Text>
            </View>
          ) : null}
          {hint ? (
            <Text variant="caption" tone={hintTone} numberOfLines={1} className="flex-1">
              {hint}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}
