/**
 * Kahade — <NotificationListItem> baris notifikasi in-app (§9.17 List Item,
 * §9.14 indikator "ada yang baru", §2.3 semantic hanya untuk status, §13).
 *
 * Satu baris `GET /v1/notifications`. Anatomi: IconBox kategori -> judul +
 * isi (2 baris) + waktu -> Dot unread di kanan atas. Tap membuka deep link
 * (`/v1/deeplinks/notification/{id}`) — navigasi urusan pemanggil.
 *
 * Keputusan non-obvious:
 *   - Unread = <Dot size="md" tone="primary"> di kolom kanan + judul weight
 *     600 + bg-surface pada baris (pola SecurityLogItem). Berbeda dari Chat
 *     (tanpa bg) karena di sini leading-nya IconBox kotak, bukan avatar
 *     bulat — kotak di atas surface tetap rapi. Titik HITAM, bukan merah:
 *     §9.14 hanya memakai dot merah di tab bar; di dalam daftar, semua baris
 *     unread berdot merah akan terasa seperti deretan error.
 *   - `category` memilih ikon Phosphor saja; IconBox tetap `surface`
 *     (monokrom). Satu-satunya warna: `tone="danger"` bila notifikasi adalah
 *     peringatan keamanan/sengketa (IconBox danger) — status, bukan kategori.
 *   - Aksi swipe (hapus / tandai dibaca) TIDAK di sini — bungkus dengan
 *     <SwipeableListItem> di layar, supaya komponen ini tetap bisa dipakai
 *     di tempat tanpa gesture (web, sheet ringkasan).
 *   - `onLongPress` untuk mode pilih-banyak (`/read-batch`, `/delete-batch`).
 *     `selected` = bg-surface + ikon Check menggantikan Dot di kolom kanan,
 *     konsisten dengan ListItem `selected`. Sengaja BUKAN strip border kiri
 *     — pola "left-border accent" tidak ada di sistem ini (§6 hierarki dari
 *     border penuh + kontras, bukan aksen sisi).
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

import { Dot } from "@/components/ui/dot"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type NotificationCategory =
  | "order"
  | "wallet"
  | "chat"
  | "dispute"
  | "security"
  | "promo"
  | "referral"
  | "system"

const CATEGORY_ICON: Record<NotificationCategory, IconComponent> = {
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
  /** Peringatan (keamanan, sengketa) — IconBox danger */
  tone?: "neutral" | "danger"
  /** Mode pilih-banyak */
  selected?: boolean
  onPress?: () => void
  onLongPress?: () => void
  divider?: boolean
  className?: string
}

export function NotificationListItem({
  title,
  body,
  category = "system",
  icon,
  timestamp,
  unread = false,
  tone = "neutral",
  selected = false,
  onPress,
  onLongPress,
  divider = false,
  className,
  ...rest
}: NotificationListItemProps) {
  const a11y = [
    unread ? "Belum dibaca" : undefined,
    title,
    body,
    timestamp,
    selected ? "dipilih" : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  const row = (
    <View
      className={cn(
        "min-h-14 flex-row items-start gap-3 px-6 py-3",
        (unread || selected) && "bg-surface",
      )}
    >
      <IconBox icon={icon ?? CATEGORY_ICON[category]} size="md" variant={tone === "danger" ? "danger" : "surface"} />

      <View className="flex-1 gap-[2px]">
        <Text variant="body" weight={unread ? 600 : 500} tone="primary" numberOfLines={2}>
          {title}
        </Text>
        {body ? (
          <Text variant="caption" tone={unread ? "primary" : "secondary"} numberOfLines={2}>
            {body}
          </Text>
        ) : null}
        {timestamp ? (
          <Text variant="caption" tone="tertiary" className="tabular-nums">
            {timestamp}
          </Text>
        ) : null}
      </View>

      {/* Kolom kanan: Check (selected) > Dot (unread) > kosong; lebar tetap agar teks tidak bergeser */}
      <View className="w-5 items-center pt-1">
        {selected ? (
          <Icon icon={Check} size="sm" active />
        ) : unread ? (
          <Dot size="md" tone="primary" />
        ) : null}
      </View>
    </View>
  )

  return (
    <View className={cn("w-full", className)} {...rest}>
      {onPress || onLongPress ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityState={{ selected }}
          accessibilityHint="Buka notifikasi"
          scaleOnPress={false}
          onPress={onPress}
          onLongPress={onLongPress}
        >
          {row}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={a11y}>
          {row}
        </View>
      )}
      {/* Inset = px-6 (24) + IconBox md (40) + gap-3 (12) */}
      {divider ? <View className="ml-[76px] h-px bg-border" /> : null}
    </View>
  )
}
