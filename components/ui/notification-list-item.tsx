/**
 * Kahade — <NotificationListItem> baris notifikasi in-app (§9.17 List Item,
 * §9.14 indikator "ada yang baru", §2.3 semantic hanya untuk status, §13).
 *
 * Anatomi (redesign 2026-09-27, kompak & sentuh-friendly):
 *   - Kiri: ikon kategori dalam lingkaran 40px BERWARNA per kategori
 *     (transaksi = primary, wallet = success, promo = amber, keamanan/
 *     sengketa = danger, chat = info, sistem = netral) — jenis notifikasi
 *     dikenali sekilas tanpa membaca judulnya.
 *   - Kolom teks: judul (maks 2 baris, 600 bila belum dibaca) → preview isi
 *     (2 baris) → baris meta berisi timestamp relatif ("5 menit") yang
 *     diformat pemanggil (§13).
 *   - Unread = DOT 8px `bg-primary` di kanan baris judul + tint `bg-surface`
 *     yang halus pada baris — BUKAN blok warna mencolok. Chip netral dibalik
 *     jadi `bg-background` supaya tetap terbaca di atas baris bertint.
 *   - Baris `min-h-[68px]` (target sentuh ≥ 48px), padding vertikal 12px:
 *     tidak terlalu kecil, tidak terlalu besar.
 *   - TIDAK ada chevron dan TIDAK ada tombol ⋮ per baris (permintaan produk
 *     2026-09-21): tap membuka detail, tekan lama masuk mode pilih.
 *
 * Keputusan non-obvious:
 *   - `selected` = chip jadi lingkaran primary berisi Check inverse (bukan
 *     sekadar mengganti ikon): di tengah daftar panjang, tanda pilih harus
 *     terlihat tanpa membaca judulnya lagi.
 *   - `tone="danger"` (kompatibilitas — pemanggil lama) memaksa chip danger;
 *     pemanggil baru cukup mengirim `category` ("security"/"dispute").
 *   - Ripple hidup secara default: baris list adalah permukaan sapuan jari
 *     (lihat PressableScale). Matikan lewat `ripple={false}` bila baris
 *     dibungkus gesture lain.
 *   - Aksi swipe (hapus / tandai dibaca) TIDAK di sini — bungkus dengan
 *     <SwipeableListItem> di layar, supaya komponen ini tetap bisa dipakai
 *     di tempat tanpa gesture (web, sheet ringkasan).
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
import { memo } from "react"
import { View, type ViewProps } from "react-native"

import { Icon, type IconComponent, type IconTone } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { translate, useLanguage } from "@/lib/i18n"
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

/**
 * Warna chip ikon per kategori — HANYA kategori yang memang ada di backend
 * (lihat `notificationTypeUiCategory` di lib/notification-category):
 * transaksi/order = primary, wallet/uang = success, promo = amber,
 * keamanan/sengketa = danger, chat = info, sistem/rujukan-netral = netral.
 */
export const NOTIFICATION_CATEGORY_CHIP: Record<
  NotificationCategory,
  { chip: string; tone: IconTone }
> = {
  order: { chip: "bg-primary", tone: "inverse" },
  wallet: { chip: "bg-success-soft", tone: "success" },
  chat: { chip: "bg-info-soft", tone: "info" },
  dispute: { chip: "bg-danger-soft", tone: "danger" },
  security: { chip: "bg-danger-soft", tone: "danger" },
  promo: { chip: "bg-warning-soft", tone: "warning" },
  referral: { chip: "bg-success-soft", tone: "success" },
  system: { chip: "bg-surface", tone: "default" },
}

export type NotificationListItemProps = Omit<ViewProps, "children"> & {
  title: string
  body?: string
  category?: NotificationCategory
  /** Ikon kustom — menimpa ikon kategori */
  icon?: IconComponent
  /** Sudah diformat pemanggil (§13): relatif ("5 menit") atau eksplisit */
  timestamp?: string
  unread?: boolean
  /** Peringatan (keamanan, sengketa) — memaksa chip danger (kompatibilitas) */
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

/** Chip ikon: 40px — ikon sm (20px) + napas 10px tiap sisi, seimbang dengan judul 2 baris. */
const ICON_CHIP_SIZE = 40
/** Dot unread: 8px, cukup terlihat tanpa mendominasi baris. */
const UNREAD_DOT_SIZE = 8

/**
 * Tint baris (murni — dikunci test): unread/selected → tint halus `bg-surface`;
 * selain itu tanpa tint. Disatukan di sini supaya komponen dan test membaca
 * keputusan yang sama.
 */
export function notificationRowTintClass(unread: boolean, selected: boolean): string | null {
  return unread || selected ? "bg-surface" : null
}

/**
 * LR-007 (perf-fix): dibungkus `memo` — tampilan & perilaku tidak berubah;
 * hanya mencegah re-render baris saat daftar re-render (mis. toggle satu
 * baris tidak me-render ulang semua baris).
 */
export const NotificationListItem = memo(function NotificationListItem({
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
  // Baris di-memo: langganan bahasa di sini supaya label a11y ikut berganti
  // saat pengguna mengubah bahasa tanpa menunggu props berubah.
  useLanguage()
  // Audit Notifikasi 2026-10-10 (FE-39): tiap bagian diterjemahkan SENDIRI
  // sebelum digabung — label gabungan ("Belum dibaca, Judul, …") tidak pernah
  // cocok dengan kunci kamus, jadi `translateProp` di PressableScale tidak
  // bisa menerjemahkannya; pengguna EN mendengar "Belum dibaca" / "dipilih".
  const a11y = summarize([
    unread ? translate("Belum dibaca") : undefined,
    title,
    body,
    timestamp,
    selected ? translate("Dipilih") : undefined,
  ])

  /** Baris bertint (belum dibaca / terpilih) → chip dibalik agar terbaca. */
  const tinted = unread || selected
  const danger = tone === "danger" && !selected
  const chipStyle = danger
    ? { chip: "bg-danger-soft", tone: "danger" as IconTone }
    : (NOTIFICATION_CATEGORY_CHIP[category] ?? NOTIFICATION_CATEGORY_CHIP.system)
  // Chip netral (bg-surface) tenggelam di atas baris bertint → balik ke bg-background.
  const chipClass = !selected && tinted && chipStyle.chip === "bg-surface" ? "bg-background" : chipStyle.chip

  const row = (
    <View
      className={cn(
        "min-h-[68px] w-full flex-row items-start gap-3 px-5 py-3",
        notificationRowTintClass(unread, selected),
      )}
    >
      {/* Chip ikon kategori berwarna */}
      <View
        className={cn(
          "shrink-0 items-center justify-center rounded-full",
          selected ? "bg-primary" : chipClass,
        )}
        style={{ height: ICON_CHIP_SIZE, width: ICON_CHIP_SIZE }}
      >
        <Icon
          icon={selected ? Check : (icon ?? NOTIFICATION_CATEGORY_ICON[category])}
          size="sm"
          tone={selected ? "inverse" : chipStyle.tone}
          weight={selected || danger ? "bold" : undefined}
        />
      </View>

      <View className="min-w-0 flex-1">
        {/* Baris judul: judul (maks 2 baris) → dot unread di kanan */}
        <View className="flex-row items-start gap-2">
          <Text
            ellipsizeMode="tail"
            variant="body"
            weight={unread ? 600 : 500}
            tone="primary"
            numberOfLines={2}
            className="min-w-0 flex-1"
          >
            {title}
          </Text>
          {unread ? (
            <View
              testID="notification-unread-dot"
              accessibilityRole="none"
              importantForAccessibility="no"
              className="mt-[5px] shrink-0 rounded-full bg-primary"
              style={{ height: UNREAD_DOT_SIZE, width: UNREAD_DOT_SIZE }}
            />
          ) : null}
        </View>

        {body ? (
          <Text
            variant="caption"
            tone={unread ? "primary" : "secondary"}
            numberOfLines={2}
            className="mt-0.5"
          >
            {body}
          </Text>
        ) : null}

        {timestamp ? (
          <Text variant="caption" tone="secondary" className="mt-1 shrink-0 tabular-nums">
            {timestamp}
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
      {/* Inset = px-5 (20) + chip 40 + gap-3 (12) = sejajar teks judul */}
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
})
