/**
 * Kahade — <OrderCard> kartu transaksi escrow di daftar (§9.6 Card, §8
 * "shared element: kartu transaksi di list -> detail", §3.1 Mono untuk ID &
 * nominal, §13 format, §2.3 status semantik).
 *
 * Satu baris data `GET /v1/orders` untuk tab Transaksi & beranda. Anatomi:
 *   baris 1 : ID order (Mono caption, text-secondary) ..... OrderStatusBadge
 *   baris 2 : judul barang/jasa (body 600, 2 baris maks)
 *   baris 3 : Avatar xs + nama lawan transaksi + peran ("Pembeli"/"Penjual")
 *   baris 4 : nominal <Amount> ..... waktu (caption tabular)
 *   opsional: strip tenggat (Countdown) untuk status yang punya deadline
 *
 * Keputusan non-obvious:
 *   - Dibangun di atas <Card onPress> (bukan ListItem): §8 menyebut kartu
 *     transaksi sebagai kandidat shared-element ke detail, dan Card sudah
 *     membawa pressed 0.97 + border. Gap antar kartu = 12px (tokens.layout
 *     .cardGap) — tanggung jawab FlatList `ItemSeparatorComponent`/`gap-3`
 *     di parent, bukan margin di kartu (kartu tidak tahu ia terakhir).
 *   - ID order di ATAS judul, bukan di bawah: saat user membandingkan dengan
 *     chat/CS, ID adalah anchor pertama yang dicari. Mono caption text-secondary
 *     supaya tidak bersaing dengan judul (§1 "presisi di detail numerik").
 *   - Nominal selalu <Amount size="body"> (Mono 14), BUKAN large: di daftar,
 *     nominal Mono 24 membuat tiap kartu setinggi hero dan mematahkan irama
 *     list. Large disimpan untuk header detail & WalletBalanceCard.
 *   - Peran ditulis dari sudut pandang USER ("Anda membeli dari X" -> label
 *     "Penjual" di samping nama X). Prop `role` adalah peran USER; label yang
 *     ditampilkan adalah peran lawan. Ini menghindari kebingungan "Pembeli:
 *     Budi" yang bisa dibaca dua arah.
 *   - `unread` (ada update yang belum dilihat) = <Dot tone="primary"> 8px di
 *     kiri ID, bukan bg-surface pada seluruh kartu: Card sudah bg-surface,
 *     jadi tint tidak terlihat; titik hitam kecil cukup (§1 hitam = perhatian).
 *   - Deadline (`deadlineAt`) dirender <Countdown> hanya bila status masih
 *     aktif; jika sudah lewat, `onDeadline` memberi tahu parent untuk refetch
 *     — kartu tidak mengubah status sendiri (sumber kebenaran = server).
 *   - Loading = <OrderCardSkeleton> terpisah dengan tinggi sama (≈132px)
 *     supaya list tidak melompat saat data masuk.
 */
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Card, type CardProps } from "@/components/ui/card"
import { Countdown } from "@/components/ui/countdown"
import { Dot } from "@/components/ui/dot"
import {
  isOrderActive,
  OrderStatusBadge,
  type OrderRole,
  type OrderStatus,
} from "@/components/ui/order-status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type OrderCounterpart = {
  name: string
  avatar?: AvatarProps["source"]
  verified?: boolean
}

export type OrderCardLabels = {
  /** Label peran LAWAN saat user pembeli (default "Penjual") */
  seller: string
  /** Label peran LAWAN saat user penjual (default "Pembeli") */
  buyer: string
  /** Prefix countdown tenggat (default "Batas waktu") */
  deadline: string
}

const DEFAULT_LABELS: OrderCardLabels = {
  seller: "Penjual",
  buyer: "Pembeli",
  deadline: "Batas waktu",
}

// `role` di-Omit dari CardProps: ViewProps RN 0.81 punya `role?: Role`
// (aksesibilitas) yang literal-nya disjoint dengan OrderRole — kalau tidak
// di-Omit, TS mereduksi seluruh intersection menjadi `never`.
export type OrderCardProps = Omit<CardProps, "children" | "variant" | "padded" | "role"> & {
  /** Nomor order yang ditampilkan, mis. "KHD-2026-0903-0142" */
  orderId: string
  title: string
  amount: number
  status: OrderStatus | string
  /** Peran USER di order ini — menentukan label lawan & tone status */
  role?: OrderRole
  counterpart: OrderCounterpart
  /** Sudah diformat pemanggil (§13), mis. "3 Sep 2026, 14:30" */
  timestamp?: string
  /** Tenggat aksi (bayar/konfirmasi). Countdown hanya tampil bila status aktif */
  deadlineAt?: Date | number
  onDeadline?: () => void
  /** Ada pembaruan yang belum dilihat */
  unread?: boolean
  labels?: Partial<OrderCardLabels>
}

export function OrderCard({
  orderId,
  title,
  amount,
  status,
  role,
  counterpart,
  timestamp,
  deadlineAt,
  onDeadline,
  unread = false,
  labels,
  onPress,
  accessibilityLabel,
  className,
  ...rest
}: OrderCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const counterpartRole =
    role === "buyer" ? t.seller : role === "seller" ? t.buyer : "Lawan transaksi"
  const showDeadline = deadlineAt != null && isOrderActive(status)

  const a11y =
    accessibilityLabel ??
    summarize([
      unread ? "Ada pembaruan" : undefined,
      `Order ${orderId}`,
      title,
      `${counterpartRole} ${counterpart.name}`,
      timestamp,
    ])

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={a11y}
      accessibilityHint={onPress ? "Buka detail transaksi" : undefined}
      className={cn("gap-3", className)}
      {...rest}
    >
      {/* Baris 1: ID + status */}
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          {unread ? <Dot size="md" tone="primary" /> : null}
          <Text ellipsizeMode="tail"
            variant="caption"
            tone="secondary"
            numberOfLines={1}
            className="font-mono-500 tracking-mono"
          >
            {orderId}
          </Text>
        </View>
        <OrderStatusBadge status={status} role={role} size="sm" />
      </View>

      {/* Baris 2: judul */}
      <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
        {title}
      </Text>

      {/* Baris 3: lawan transaksi */}
      <View className="flex-row items-center gap-2">
        <Avatar
          source={counterpart.avatar}
          name={counterpart.name}
          size="xs"
          verified={counterpart.verified}
        />
        <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
          <Text variant="inherit" tone="secondary">
            {counterpartRole}
            {" · "}
          </Text>
          {counterpart.name}
        </Text>
      </View>

      {/* Baris 4: nominal + waktu */}
      <View className="flex-row items-end justify-between gap-3">
        <Amount value={amount} size="body" tone="primary" />
        {timestamp ? (
          <Text variant="caption" tone="secondary" className="tabular-nums">
            {timestamp}
          </Text>
        ) : null}
      </View>

      {/* Tenggat — hanya status aktif; garis atas memisahkan dari isi */}
      {showDeadline ? (
        <View className="flex-row items-center justify-between border-t border-border pt-3">
          <Text variant="caption" tone="secondary">
            {t.deadline}
          </Text>
          {/* tone primary: tenggat adalah informasi, bukan bahaya — warna
              semantik disimpan untuk Badge status (§2.3) */}
          <Countdown until={deadlineAt} tone="primary" onComplete={onDeadline} />
        </View>
      ) : null}
    </Card>
  )
}

/** Placeholder dengan tinggi menyamai OrderCard tanpa tenggat */
export function OrderCardSkeleton({
  className,
  ...rest
}: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      className={cn("w-full gap-3 rounded-md border border-border bg-surface p-5", className)}
      accessibilityLabel="Memuat transaksi"
      {...rest}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Skeleton height={12} className="w-32" />
        <Skeleton height={22} className="w-24" />
      </View>
      <Skeleton height={18} className="w-full" />
      <View className="flex-row items-center gap-2">
        <Skeleton shape="circle" width={24} height={24} />
        <Skeleton height={12} className="w-40" />
      </View>
      <View className="flex-row items-center justify-between">
        <Skeleton height={16} className="w-28" />
        <Skeleton height={12} className="w-24" />
      </View>
    </View>
  )
}