/**
 * Kahade — <NotificationListItem> baris notifikasi in-app (§9.17 List Item,
 * §9.14 indikator "ada yang baru", §2.3 semantic hanya untuk status, §13).
 *
 * Satu baris `GET /v1/notifications`. Anatomi (v3 2026-09-21):
 *   - Kiri: ikon kategori di dalam chip lingkaran 32px (bukan ikon 16px
 *     menggantung di samping judul) — notifikasi dikenali dari jenisnya
 *     sekilas, dan chip memberi kolom vertikal yang rapi untuk 1–2 baris isi.
 *   - Baris judul: judul (1 baris) → waktu meta di kanan.
 *   - Isi 2 baris di bawah, sejajar judul.
 *   - TIDAK ada chevron dan TIDAK ada tombol ⋮ per baris (permintaan produk
 *     2026-09-21): tap membuka detail, tekan lama masuk mode pilih — sama
 *     seperti daftar chat. Chevron menjanjikan "ada yang bisa digeser"
 *     padahal seluruh baris memang tombol, dan ⋮ menduplikasi aksi yang
 *     sudah ada di header mode pilih (tandai dibaca / hapus).
 *
 * Keputusan non-obvious:
 *   - Unread = judul weight 600 + `bg-surface` pada baris; chip ikonnya
 *     dibalik jadi `bg-background` supaya tetap terbaca di atas baris
 *     bertint (pola inversi yang sama dipakai ubin QuickActionGrid di dark).
 *   - `tone="danger"` (keamanan/sengketa) memberi chip `bg-danger-soft` +
 *     ikon danger: status, bukan kategori (§2.3 — warna hanya untuk makna).
 *   - `selected` = chip jadi lingkaran primary berisi Check inverse (bukan
 *     sekadar mengganti ikon): di tengah daftar panjang, tanda pilih harus
 *     terlihat tanpa membaca judulnya lagi.
 *   - Ripple hidup secara default: baris list adalah permukaan sapuan jari
 *     (lihat PressableScale). Matikan lewat `ripple={false}` bila baris
 *     dibungkus gesture lain.
 *   - Aksi swipe (hapus / tandai dibaca) TIDAK di sini — bungkus dengan
 *     <SwipeableListItem> di layar, supaya komponen ini tetap bisa dipakai
 *     di tempat tanpa gesture (web, sheet ringkasan).
 *   - Waktu caption tabular (bukan Mono): meta, bukan timestamp teknis
 *     (§3.1); format eksplisit dari pemanggil (§13, tanpa relative time).
 */
import {
  Bell,
  ChatCircleText,
  Check,
  Gift,
  Megaphone,
  Receipt,
  ShieldWarning,
  Wallet,
} from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { focusRingInset } from "@/lib/focus-ring"

export type NotificationCategory =
  | "order"
  | "wallet"
  | "chat"
  | "dispute"
  | "security"
  | "promo"
  | "referral"
  | "system"

/**
 * Ikon per kategori notifikasi — dipakai <NotificationListItem> dan layar
 * detail (`/notification/[id]`) supaya keduanya tidak punya dua tabel ikon
 * yang diam-diam berbeda. Peta ini tinggal di lapisan komponen (bukan lib/):
 * isinya komponen ikon Phosphor, yang tidak bisa di-parse di luar Metro.
 */
export const NOTIFICATION_CATEGORY_ICON: Record<NotificationCategory, IconComponent> = {
  order: Receipt,
  wallet: Wallet,
  chat: ChatCircleText,
  dispute: ShieldWarning,
  security: ShieldWarning,
  promo: Megaphone,
  referral: Gift,
  system: Bell,
}

export type NotificationListItemProps = Omit<ViewProps, "children"> & {
  title: string
  body?: string
  category?: NotificationCategory
  /** Ikon kustom — menimpa ikon kategori */
  icon?: IconComponent
  /** Sudah diformat pemanggil (§13): "3 Sep 2026, 14:30" */
  timestamp?: string
  unread?: boolean
  /** Peringatan (keamanan, sengketa) — chip + ikon status danger */
  tone?: "neutral" | "danger"
  /** Mode pilih-banyak */
  selected?: boolean
  /** Getaran ringan saat ditekan — umpan balik "baris ini yang kupilih" */
  haptic?: boolean
  /** Umpan balik ripple (default hidup — baris list = permukaan sapuan jari) */
  ripple?: boolean
  onPress?: () => void
  onLongPress?: () => void
  divider?: boolean
  className?: string
}

/** Chip ikon: 32px, cukup untuk ikon sm (20px) + napas 6px tiap sisi. */
const ICON_CHIP_SIZE = tokens.icon.size.sm + tokens.space[3]

export function NotificationListItem({
  title,
  body,
  category = "system",
  icon,
  timestamp,
  unread = false,
  tone = "neutral",
  selected = false,
  haptic = false,
  ripple = true,
  onPress,
  onLongPress,
  divider = false,
  className,
  ...rest
}: NotificationListItemProps) {
  const a11y = summarize([
    unread ? "Belum dibaca" : undefined,
    title,
    body,
    timestamp,
    selected ? "dipilih" : undefined,
  ])

  /** Baris bertint (belum dibaca / terpilih) → chip dibalik agar terbaca. */
  const tinted = unread || selected
  const danger = tone === "danger" && !selected

  const row = (
    <View
      className={cn(
        "min-h-16 w-full flex-row items-start gap-3 px-5 py-3",
        tinted && "bg-surface",
      )}
    >
      {/* Chip ikon kategori / status */}
      <View
        className={cn(
          "shrink-0 items-center justify-center rounded-full",
          selected
            ? "bg-primary"
            : danger
              ? "bg-danger-soft"
              : tinted
                ? "bg-background"
                : "bg-surface",
        )}
        style={{ height: ICON_CHIP_SIZE, width: ICON_CHIP_SIZE }}
      >
        <Icon
          icon={selected ? Check : (icon ?? NOTIFICATION_CATEGORY_ICON[category])}
          size="sm"
          tone={
            selected ? "inverse" : danger ? "danger" : unread ? "active" : "default"
          }
          weight={selected || danger ? "bold" : undefined}
        />
      </View>

      <View className="min-w-0 flex-1 gap-1">
        {/* Baris judul: judul → waktu */}
        <View className="flex-row items-baseline gap-2">
          <Text
            ellipsizeMode="tail"
            variant="body"
            weight={unread ? 600 : 500}
            tone="primary"
            numberOfLines={1}
            className="min-w-0 flex-1"
          >
            {title}
          </Text>
          {timestamp ? (
            <Text variant="caption" tone="secondary" className="shrink-0 tabular-nums">
              {timestamp}
            </Text>
          ) : null}
        </View>

        {body ? (
          <Text variant="caption" tone={unread ? "primary" : "secondary"} numberOfLines={2}>
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  )

  const content =
    onPress || onLongPress ? (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ selected }}
        // Tanpa chevron/⋮, satu-satunya affordance adalah barisnya sendiri:
        // hint menyebut kedua gesture supaya mode pilih tetap bisa ditemukan.
        accessibilityHint={
          onLongPress
            ? "Membuka notifikasi, atau tekan lama untuk memilih beberapa"
            : "Membuka notifikasi"
        }
        scaleOnPress={false}
        ripple={ripple}
        haptic={haptic}
        onPress={onPress}
        onLongPress={onLongPress}
        containerClassName={cn("w-full", focusRingInset)}
      >
        {row}
      </PressableScale>
    ) : (
      <View accessible accessibilityLabel={a11y}>
        {row}
      </View>
    )

  return (
    <View className={cn("w-full", className)} {...rest}>
      {content}
      {/* Inset = px-5 (20) + chip 32 + gap-3 (12) = sejajar teks judul */}
      {divider ? (
        <View
          accessibilityRole="none"
          importantForAccessibility="no"
          className="h-px bg-border"
          style={{ marginLeft: tokens.layout.screenPaddingX + ICON_CHIP_SIZE + tokens.space[3] }}
        />
      ) : null}
    </View>
  )
}
