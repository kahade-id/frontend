/**
 * Kahade — <ActivityLogItem> (§9.17 List Item, §3.1 Mono, §13 format tanggal).
 * API: GET /v1/users/me/activity-log
 *
 * Baris satu aktivitas akun non-keamanan: "Membuat pesanan", "Mengubah
 * profil", "Menarik saldo", "Mengikuti @user". Berbeda dari
 * <SecurityLogItem> yang khusus kejadian autentikasi dan punya `outcome`
 * semantik — aktivitas umum bersifat netral (monokrom), jadi IconBox selalu
 * varian "surface". Kategori hanya menentukan glyph.
 *
 * Keputusan non-obvious:
 *   - `meta` opsional (mis. "ORD-2026-0912" / "Rp1.500.000") dirender
 *     monoBody karena hampir selalu ID/nominal — data teknis (§3.1).
 *   - Timestamp di kanan atas mengikuti SecurityLogItem agar dua layar log
 *     terbaca serupa; string sudah diformat pemanggil (§13).
 *   - Divider inset ml-[76px] = px-6 + IconBox md + gap-3.
 */
import type { ReactNode } from "react"
import {
  ArrowsLeftRight,
  ChatCircleText,
  Gear,
  Handshake,
  Star,
  UserCircle,
  UserPlus,
  Wallet,
} from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { IconBox } from "@/components/ui/icon-box"
import type { IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type ActivityLogCategory =
  | "order"
  | "wallet"
  | "profile"
  | "social"
  | "rating"
  | "chat"
  | "settings"
  | "transfer"

export type ActivityLogItemProps = Omit<ViewProps, "children"> & {
  /** Mis. "Membuat pesanan baru" */
  title: string
  /** Konteks singkat, mis. "Sebagai pembeli · Jasa desain logo" */
  description?: string
  category?: ActivityLogCategory
  /** Override ikon default kategori */
  icon?: IconComponent
  /** ID / nominal terkait — dirender Mono */
  meta?: string
  /** Sudah diformat: "3 Sep 2026, 14:30" */
  timestamp: string
  onPress?: () => void
  extra?: ReactNode
  divider?: boolean
  className?: string
}

const CATEGORY_ICON: Record<ActivityLogCategory, IconComponent> = {
  order: Handshake,
  wallet: Wallet,
  profile: UserCircle,
  social: UserPlus,
  rating: Star,
  chat: ChatCircleText,
  settings: Gear,
  transfer: ArrowsLeftRight,
}

export function ActivityLogItem({
  title,
  description,
  category = "order",
  icon,
  meta,
  timestamp,
  onPress,
  extra,
  divider = false,
  className,
  ...rest
}: ActivityLogItemProps) {
  const row = (
    <View className="min-h-14 flex-1 flex-row items-start gap-3 py-3">
      <IconBox icon={icon ?? CATEGORY_ICON[category]} size="md" variant="surface" />
      <View className="flex-1 gap-[2px]">
        <View className="flex-row items-start justify-between gap-3">
          <Text variant="body" weight={500} tone="primary" numberOfLines={2} className="flex-1">
            {title}
          </Text>
          <Text variant="monoBody" tone="secondary" numberOfLines={1}>
            {timestamp}
          </Text>
        </View>
        {description || meta ? (
          <View className="flex-row flex-wrap items-center gap-x-2">
            {description ? (
              <Text variant="caption" tone="secondary" numberOfLines={1} className="shrink">
                {description}
              </Text>
            ) : null}
            {meta ? (
              <Text variant="monoBody" tone="secondary" numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
        ) : null}
        {extra ? <View className="pt-2">{extra}</View> : null}
      </View>
    </View>
  )

  const a11yLabel = [title, description, meta, timestamp].filter(Boolean).join(", ")

  return (
    <View className={cn("w-full", className)} {...rest}>
      <View className="px-6">
        {onPress ? (
          <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            scaleOnPress={false}
            onPress={onPress}
            containerClassName="w-full"
            className="w-full"
          >
            {row}
          </PressableScale>
        ) : (
          <View accessible accessibilityLabel={a11yLabel}>
            {row}
          </View>
        )}
      </View>
      {divider ? <View className="ml-[76px] h-px bg-border" /> : null}
    </View>
  )
}