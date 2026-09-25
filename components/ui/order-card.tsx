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
 *     kiri ID, bukan tint seluruh kartu: kartu sudah memakai isi abu-abu
 *     (gray.100/dark gray.900) agar terbaca di background putih, jadi tint
 *     tambahan tidak terlihat; titik kecil cukup (§1 hitam = perhatian).
 *   - 2026-09-17 — garis aksen status 4px di tepi kiri (hijau selesai, merah
 *     sengketa, dst). Daftar panjang lebih cepat "dipindai warna" daripada
 *     dibaca label Badge satu per satu, tapi ketebalannya sengaja minimal
 *     (isyarat, bukan blok warna) dan tone-nya diambil dari
 *     `orderStatusTone()` yang sama dengan Badge — satu sumber warna status,
 *     tidak ada tabel warna kedua yang bisa drift.
 *   - Deadline (`deadlineAt`) dirender <Countdown> hanya bila status masih
 *     aktif; jika sudah lewat, `onDeadline` memberi tahu parent untuk refetch
 *     — kartu tidak mengubah status sendiri (sumber kebenaran = server).
 *   - Loading = <OrderCardSkeleton> terpisah dengan tinggi sama (≈132px)
 *     supaya list tidak melompat saat data masuk.
 */
import { useEffect, useRef, useState } from "react"
import { View, type ViewProps } from "react-native"
import { translate } from "@/lib/i18n/translate"
import { translateProp } from "@/lib/i18n"
import { formatCountdown } from "@/lib/format"
import { shortId } from "@/lib/short-id"
import { useClockTick } from "@/lib/use-clock-tick"

import { Amount } from "@/components/ui/amount"
import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Card, type CardProps } from "@/components/ui/card"
import { Dot } from "@/components/ui/dot"
import { type BadgeTone } from "@/components/ui/badge"
import {
  hasLiveDeadline,
  orderStatusTone,
  OrderStatusBadge,
  type OrderRole,
  type OrderStatus,
} from "@/components/ui/order-status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { hasOwn } from "@/lib/has-own"
import { formatRupiah } from "@/lib/format"
import { ORDER_STATUS_LABELS } from "@/lib/labels/status"

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

// J-03 (audit escrow 2026-09-24): label default dibungkus `translate()` di
// titik definisi supaya masuk katalog i18n dan ikut terjemah di mode English
// (dulu string polos Indonesia — pindai katalog tidak menemukan properti objek).
const DEFAULT_LABELS: OrderCardLabels = {
  seller: translate("Penjual"),
  buyer: translate("Pembeli"),
  deadline: translate("Batas waktu"),
}

/**
 * Garis aksen tipis di tepi kiri kartu, mengikuti TONE status (bukan tabel
 * warna baru): hijau selesai, merah sengketa, oranye butuh tindakan, biru
 * sedang berjalan. Status netral (dibatalkan/dikembalikan/kedaluwarsa) tidak
 * menggambar garis — di atas kartu abu, garis abu hanya jadi noise.
 *
 * 4px (`w-1`) dipilih supaya terbaca sebagai isyarat sekilas saat menggulir
 * daftar tanpa mengubah bobot visual kartu ("tidak usah terlalu tebal") dan
 * tetap >= 3:1 terhadap fill kartu (WCAG 1.4.11 untuk objek grafis).
 */
const STATUS_ACCENT: Record<BadgeTone, string | null> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  accent: "bg-accent",
  neutral: null,
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
  href,
  accessibilityLabel,
  className,
  ...rest
}: OrderCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const counterpartRole =
    role === "buyer" ? t.seller : role === "seller" ? t.buyer : "Lawan transaksi"
  const showDeadline = deadlineAt != null && hasLiveDeadline(status)
  const statusAccent = STATUS_ACCENT[orderStatusTone(status, role)]

  const a11y =
    accessibilityLabel ??
    summarize([
      unread ? "Ada pembaruan" : undefined,
      // R2 (audit ronde-2, butir #67): pembaca layar tidak disuguhi UUID 36
      // karakter — 8 heksa pertama cukup membedakan order milik satu pengguna.
      `Order #${shortId(orderId)}`,
      title,
      // K-02 (audit escrow 2026-09-24): nominal dan STATUS — dua informasi
      // finansial terpenting kartu — kini ikut diumumkan pembaca layar.
      hasOwn(ORDER_STATUS_LABELS, status) ? ORDER_STATUS_LABELS[status as OrderStatus] : undefined,
      formatRupiah(amount),
      `${counterpartRole} ${counterpart.name}`,
      timestamp,
    ])

  // Isi kartu abu-abu (gray.100 / gray.900 di dark), BUKAN putih: daftar
  // Transaksi berlatar background putih sehingga kartu elevated putih
  // hilang tanpa batas. Isi netral + border membuat kartu terbaca di
  // atas background (transaksi) maupun surface (Beranda).
  // §6: fill monokrom netral — pengecualian visual kartu daftar tercatat di
  // DARK_ALLOWLIST (scripts/check-tokens.mjs).
  return (
    <Card
      variant="default"
      elevation="flat"
      onPress={onPress}
      href={href}
      accessibilityLabel={a11y}
      accessibilityHint={onPress || href ? "Buka detail transaksi" : undefined}
      className={cn("gap-3 bg-surface", className)}
      {...rest}
    >
      {/* Garis status tipis (dekoratif, 4px) — aksen visual cepat; statusnya
          tetap dibaca dari <OrderStatusBadge> di baris pertama. */}
      {statusAccent ? (
        <View
          accessibilityRole="none"
          importantForAccessibility="no"
          className={cn("absolute bottom-0 left-0 top-0 w-1 rounded-l-md", statusAccent)}
        />
      ) : null}

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
          <OrderCardDeadline until={deadlineAt} onComplete={onDeadline} />
        </View>
      ) : null}
    </Card>
  )
}

/**
 * R2 (audit ronde-2, butir #64+#65): countdown kartu BERBAGI satu detak 1-Hz
 * global (`useClockTick`) alih-alih satu interval per kartu — 20 kartu di
 * layar daftar = 1 interval. Waktu dinyatakan epoch ms + `Date.now` domain
 * server (`serverNow` di dalam tick) bukan Date baru per render cell (#65).
 * `onComplete` ditembak sekali di batas habis; berhenti subscribe setelahnya.
 */
function OrderCardDeadline({
  until,
  onComplete,
}: {
  until: Date | number
  onComplete?: () => void
}) {
  const untilMs =
    until instanceof Date ? until.getTime() : typeof until === "number" ? until : NaN
  const valid = Number.isFinite(untilMs)
  const [done, setDone] = useState(false)
  const now = useClockTick(valid && !done)
  const firedRef = useRef(false)
  // Reset saat target tenggat berganti (kartu didaur ulang FlatList).
  useEffect(() => {
    setDone(false)
    firedRef.current = false
  }, [untilMs])
  const remainingSec = valid ? Math.max(0, Math.ceil((untilMs - now) / 1000)) : null
  useEffect(() => {
    if (remainingSec === 0 && !firedRef.current) {
      firedRef.current = true
      setDone(true)
      onComplete?.()
    }
  }, [remainingSec, onComplete])
  return (
    <Text
      variant="monoBody"
      tone="primary"
      accessibilityLabel={
        translateProp(
          valid
            ? translate("Tenggat dalam {x}", { x: formatCountdown(remainingSec ?? 0) })
            : "Tenggat tidak diketahui",
        )
      }
    >
      {valid ? formatCountdown(remainingSec ?? 0) : "—"}
    </Text>
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
      className={cn(
        "w-full gap-3 rounded-md border border-border bg-surface p-5",
        className,
      )}
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