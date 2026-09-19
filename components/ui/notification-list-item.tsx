/**
 * Kahade — <NotificationListItem> baris notifikasi in-app (§9.17 List Item,
 * §9.14 indikator "ada yang baru", §2.3 semantic hanya untuk status, §13).
 *
 * Satu baris `GET /v1/notifications`. Anatomi (v2 2026-09):
 *   - Baris judul: ikon-status kecil (ikon kategori / Check saat memilih) +
 *     judul (1 baris) → waktu meta di kanan → chevron navigasi. Tidak ada
 *     IconBox besar seragam: ikon STATUS KONTEKS (pesanan, wallet, chat,
 *     sengketa, keamanan, promo, referral, info), bukan lonceng untuk semua.
 *   - Isi 2 baris di bawah, DIINSET sejajar teks judul (bukan rata ikon besar)
 *     supaya teks dan ikon kategori punya hierarki baca yang jelas.
 * Tap membuka detail (`/notification/[id]`) — navigasi urusan pemanggil.
 *
 * Keputusan non-obvious:
 *   - Unread = judul weight 600 + bg-surface (bukan kolom Dot kanan). Ikon
 *     status dibaca sebagai "keterangan gambar"; chevron kanan hanya saat
 *     `onPress` ada, sebagai affordansi navigasi.
 *   - `tone="danger"` (keamanan/sengketa) mengubah WARNA ikon status (fill
 *     danger) — status, bukan kategori.
 *   - Aksi swipe (hapus / tandai dibaca) TIDAK di sini — bungkus dengan
 *     <SwipeableListItem> di layar, supaya komponen ini tetap bisa dipakai
 *     di tempat tanpa gesture (web, sheet ringkasan).
 *   - `onLongPress` untuk mode pilih-banyak (`/read-batch`, `/delete-batch`).
 *     `selected` = bg-surface + ikon Check menggantikan ikon status.
 *   - Waktu caption tabular (bukan Mono): meta, bukan timestamp teknis
 *     (§3.1); format eksplisit dari pemanggil (§13, tanpa relative time).
 */
import {
  Bell,
  CaretRight,
  ChatCircleText,
  Check,
  Gift,
  Megaphone,
  Receipt,
  ShieldWarning,
  Wallet,
} from "phosphor-react-native"
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
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
 * yang diam-diam berbeda.
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
  /** Peringatan (keamanan, sengketa) — ikon status danger */
  tone?: "neutral" | "danger"
  /** Mode pilih-banyak */
  selected?: boolean
  /** Getaran ringan saat ditekan — umpan balik "baris ini yang kupilih" */
  haptic?: boolean
  onPress?: () => void
  onLongPress?: () => void
  /**
   * Aksi terlihat di kanan baris (mis. <IconButton icon={DotsThreeVertical}>
   * yang membuka ActionSheet). Dirender DI LUAR Pressable baris supaya
   * ketukannya tidak ikut memicu `onPress`.
   *
   * Ada karena `onLongPress` saja tidak bisa ditemukan: di web tidak ada
   * affordance "tekan lama", dan pengguna yang mengetuk biasa melihat
   * "tidak ada aksi" walau menu itu ada.
   */
  action?: ReactNode
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
  haptic = false,
  onPress,
  onLongPress,
  action,
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

  /** Ikon status: Check saat memilih, warna danger untuk peringatan. */
  const statusIcon = selected ? Check : (icon ?? NOTIFICATION_CATEGORY_ICON[category])

  const row = (
    <View
      className={cn(
        "min-h-14 gap-1.5 px-5 py-3",
        (unread || selected) && "bg-surface",
      )}
    >
      {/* Baris judul: ikon status kecil → judul → waktu → chevron */}
      <View className="flex-row items-center gap-2">
        <View className="shrink-0 items-center justify-center">
          <Icon
            icon={statusIcon}
            size="xs"
            tone={
              selected
                ? "active"
                : tone === "danger"
                  ? "danger"
                  : unread
                    ? "active"
                    : "default"
            }
            weight={selected ? "bold" : tone === "danger" ? "fill" : undefined}
          />
        </View>
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
        {onPress ? <Icon icon={CaretRight} size="xs" tone="default" /> : null}
      </View>

      {/* Isi 2 baris di-inset sejajar teks judul (16px ikon + gap 8) */}
      {body ? (
        <Text
          variant="caption"
          tone={unread ? "primary" : "secondary"}
          numberOfLines={2}
          style={{ paddingLeft: tokens.icon.size.xs + tokens.space[2] }}
        >
          {body}
        </Text>
      ) : null}
    </View>
  )

  const content = onPress || onLongPress ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ selected }}
      accessibilityHint={action ? "Buka notifikasi, atau buka menu aksi di kanan" : "Buka notifikasi"}
      scaleOnPress={false}
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
      {action ? (
        <View className="w-full flex-row items-start">
          <View className="min-w-0 flex-1">{content}</View>
          <View className="items-center pr-3 pt-1">{action}</View>
        </View>
      ) : (
        content
      )}
      {/* Inset = px-5 (20) + ikon status xs (16) + gap-2 (8) = sejajar teks */}
      {divider ? (
        <View
          accessibilityRole="none"
          importantForAccessibility="no"
          className="h-px bg-border"
          style={{ marginLeft: tokens.layout.screenPaddingX + tokens.icon.size.xs + tokens.space[2] }}
        />
      ) : null}
    </View>
  )
}
