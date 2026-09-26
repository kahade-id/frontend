/**
 * Kahade — <UserListItem> (§9.17 List Item, §9.4 Avatar).
 * API: GET /v1/users/{username}/followers, GET /v1/users/{username}/following,
 *      GET /v1/users/me/blocked, GET /v1/settings/blocked-users,
 *      GET /v1/users/search
 *
 * Baris satu pengguna: Avatar -> nama (+ SealCheck via Avatar verified) +
 * @handle -> slot aksi di kanan. Satu komponen untuk empat daftar karena
 * anatominya identik; yang berbeda hanya `action`:
 *   - followers/following : <FollowButton size="sm">
 *   - blocked             : <Button size="sm" variant="secondary">Buka blokir</Button>
 *   - search              : tanpa aksi, chevron
 *
 * Keputusan non-obvious:
 *   - Aksi berada di LUAR Pressable baris (sibling dalam flex-row) agar tap
 *     tombol tidak memicu onPress baris — pola FollowButton di Discover.
 *   - `stat` (mis. "128 transaksi · 4,9") caption secondary di bawah handle,
 *     bukan Badge: informasi pendukung, bukan status.
 *   - `blocked` meredupkan avatar & nama (opacity) tanpa warna semantik:
 *     pemblokiran adalah preferensi pengguna, bukan error.
 *   - Divider inset ml-[72px] = px-5 (20) + Avatar md (40) + gap-3 (12).
 */
import type { ReactNode } from "react"
import { CaretRight } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"
import { type SealTier } from "@/components/ui/verified-seal"
import { VerifiedName } from "@/components/ui/verified-name"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { focusRingInset } from "@/lib/focus-ring"

export type UserListItemProps = Omit<ViewProps, "children"> & {
  name: string
  padded?: boolean
  /** Tanpa "@" — prefix ditambahkan komponen */
  username?: string
  avatar?: Pick<AvatarProps, "source">
  verified?: boolean
  /**
   * R1 (audit 2026-09-26): tier seal dari payload backend (`sealTier`,
   * mis. GET /v1/users/search) — dirender sebagai <VerifiedSeal> di samping
   * nama tanpa N+1 request badge.
   */
  sealTier?: SealTier | null
  /** Mis. "128 transaksi · 4,9" */
  stat?: string
  /** Slot kanan: FollowButton / Button "Buka blokir" / Badge */
  action?: ReactNode
  /** Tampilkan CaretRight bila tanpa action */
  chevron?: boolean
  /** Baris pengguna yang diblokir — diredupkan */
  blocked?: boolean
  onPress?: () => void
  /** Divider inset 60px = 24+24+12 (token derived) — audit #... */
  divider?: boolean
  className?: string
}

export function UserListItem({
  name,
  padded = true,
  username,
  avatar,
  verified = false,
  sealTier,
  stat,
  action,
  chevron = false,
  blocked = false,
  onPress,
  divider = false,
  className,
  ...rest
}: UserListItemProps) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  const handle = username ? `@${username}` : undefined
  const a11yLabel = [
    name,
    handle,
    sealTier ?? (verified ? translate("terverifikasi") : undefined),
    stat,
    blocked ? "diblokir" : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  const body = (
    <View
      className={cn("min-h-14 flex-1 flex-row items-center gap-3 py-3", blocked && "opacity-60")}
    >
      <Avatar source={avatar?.source} name={name} size="md" />
      <View className="flex-1 gap-0.5">
        <VerifiedName
          name={name}
          variant="body"
          badges={null}
          verified={verified}
          tier={sealTier ?? null}
          textProps={{ weight: 500, tone: "primary", ellipsizeMode: "tail" }}
        />
        {handle || stat ? (
          <View className="flex-row flex-wrap items-center gap-x-2">
            {handle ? (
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {handle}
              </Text>
            ) : null}
            {stat ? (
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {stat}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {!action && chevron ? <Icon icon={CaretRight} size="sm" tone="default" /> : null}
    </View>
  )

  return (
    <View className={cn("w-full", className)} {...rest}>
      <View className={cn("flex-row items-center gap-3", padded && "px-5")}>
        {onPress ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint={translate("Buka profil")}
            scaleOnPress={false}
            onPress={onPress}
            containerClassName={cn("flex-1", focusRingInset)}
            className="flex-1"
          >
            {body}
          </PressableScale>
        ) : (
          <View accessible accessibilityLabel={a11yLabel} className="flex-1">
            {body}
          </View>
        )}
        {action ? <View className="shrink-0">{action}</View> : null}
      </View>
      {divider ? <View
          accessibilityRole="none"
          importantForAccessibility="no"
          className="h-px bg-border"
          style={{
            // `padded={false}` = parent yang memasang gutter (mis. hasil Cari
            // di dalam FlatList ber-padding): gutter tidak dihitung dua kali.
            marginLeft: padded
              ? tokens.layout.rowDividerInset.icon
              : tokens.layout.rowDividerInset.leading,
          }}
        /> : null}
    </View>
  )
}