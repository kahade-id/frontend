/**
 * Kahade — <OrderSummaryStrip> ringkasan jumlah order per kelompok status di
 * beranda / atas tab Transaksi (§9.6 Card, §3.1 tabular figures, §9.25 Chip).
 *
 * Merender `GET /v1/orders/summary` (hitungan per status) sebagai baris
 * kotak-kotak yang bisa di-scroll horizontal; tiap kotak = kelompok status
 * yang MENUNTUT perhatian user ("Menunggu pembayaran", "Perlu konfirmasi",
 * "Dalam proses", "Sengketa") + total nominal escrow yang tertahan (opsional).
 * Tap kotak = filter daftar order ke status tersebut.
 *
 * Keputusan non-obvious:
 *   - Bukan 4 <StatCard>: StatCard punya padding card 20 + label/hint/delta,
 *     terlalu tinggi untuk strip ringkasan yang harus muat di atas list.
 *     Kotak di sini 84px tinggi, angka H2 tabular, label caption.
 *   - Angka memakai Sofia Sans tabular (bukan Mono): ini HITUNGAN, bukan
 *     nominal/ID (§3.1 "angka di dalam Sofia Sans -> tabular figures").
 *     Nominal escrow tertahan (bila ada) yang memakai <Amount> Mono.
 *   - Kotak dengan hitungan 0 tetap dirender tapi tone secondary + tidak
 *     interaktif: menghilangkannya membuat strip bergeser-geser tiap refresh
 *     dan user kehilangan orientasi posisi.
 *   - Kotak "Sengketa" > 0 mendapat angka tone danger — satu-satunya warna
 *     semantik di strip (§2.3 warna eksklusif status kritikal).
 *   - Kotak aktif (`selectedKey`) dirender inverted (bg-primary) mengikuti
 *     logika Chip selected §9.25, bukan border tebal — lebih terbaca saat
 *     scroll cepat.
 */
import { ScrollView, View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatNumber } from "@/lib/format"

export type OrderSummaryItem = {
  /** Kunci filter yang dikirim balik lewat onSelect (mis. "PENDING_PAYMENT") */
  key: string
  label: string
  count: number
  /** Angka diberi tone danger bila > 0 (mis. sengketa) */
  critical?: boolean
}

export type OrderSummaryStripLabels = {
  heldTitle: string
  heldHint: string
}

const DEFAULT_LABELS: OrderSummaryStripLabels = {
  heldTitle: "Dana di escrow",
  heldHint: "Tertahan sampai transaksi selesai",
}

export type OrderSummaryStripProps = Omit<ViewProps, "children"> & {
  items: OrderSummaryItem[]
  selectedKey?: string
  onSelect?: (key: string) => void
  /** Total nominal yang sedang ditahan escrow — kotak pertama bila ada */
  heldAmount?: number
  loading?: boolean
  labels?: Partial<OrderSummaryStripLabels>
  className?: string
}

const BOX_W = 132

export function OrderSummaryStrip({
  items,
  selectedKey,
  onSelect,
  heldAmount,
  loading = false,
  labels,
  className,
  ...rest
}: OrderSummaryStripProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  if (loading) {
    return (
      <View accessible accessibilityRole="progressbar" className={cn("w-full flex-row gap-3 px-6", className)} accessibilityLabel="Memuat ringkasan transaksi" {...rest}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} shape="card" height={84} width={BOX_W} />
        ))}
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-6"
      className={cn("w-full", className)}
      accessibilityRole="tablist"
      {...rest}
    >
      {heldAmount != null ? (
        <View
          accessible
          accessibilityLabel={`${t.heldTitle} ${formatNumber(heldAmount)} rupiah`}
          className="h-[84px] w-[156px] justify-between gap-2 rounded-md border border-border bg-surface-elevated p-4"
        >
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {t.heldTitle}
          </Text>
          <Amount value={heldAmount} size="body" tone="primary" compact />
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {t.heldHint}
          </Text>
        </View>
      ) : null}

      {items.map((item) => {
        const selected = item.key === selectedKey
        const empty = item.count === 0
        const interactive = !!onSelect && !empty

        return (
          <PressableScale
            key={item.key}
            scaleOnPress={false}
            disabled={!interactive}
            onPress={() => onSelect?.(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: !interactive }}
            accessibilityLabel={`${item.label}, ${item.count}`}
            containerClassName={cn("rounded-md", focusRing)}
            className={cn(
              "h-[84px] w-[132px] justify-between gap-2 rounded-md border p-4",
              // Tab belum terpilih adalah kontrol -> outline border-control >= 3:1 (WCAG 1.4.11, audit #6)
              selected ? "border-primary bg-primary" : "border-border-control bg-surface",
            )}
          >
            <Text
              variant="h2"
              tone={selected ? "inverse" : empty ? "secondary" : item.critical ? "danger" : "primary"}
              className="tabular-nums"
            >
              {formatNumber(item.count)}
            </Text>
            <Text variant="caption" tone={selected ? "inverse" : "secondary"} numberOfLines={1}>
              {item.label}
            </Text>
          </PressableScale>
        )
      })}
    </ScrollView>
  )
}
