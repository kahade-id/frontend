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
 *   - Divider inset ml-[76px] = px-6 + Avatar md (40) + gap-3.
 */
import type { ReactNode } from "react"
import { CaretRight } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type UserListItemProps = Omit<ViewProps, "children"> & {
  name: string
  padded?: boolean
  /** Tanpa "@" — prefix ditambahkan komponen */
  username?: string
  avatar?: Pick<AvatarProps, "source">
  verified?: boolean
  /** Mis. "128 transaksi · 4,9" */
  stat?: string
  /** Slot kanan: FollowButton / Button "Buka blokir" / Badge */
  action?: ReactNode
  /** Tampilkan CaretRight bila tanpa action */
  chevron?: boolean
  /** Baris pengguna yang diblokir — diredupkan */
  blocked?: boolean
  onPress?: () => void
  divider?: boolean
  className?: string
}

export function UserListItem({
  name,
  padded = true,
  username,
  avatar,
  verified = false,
  stat,
  action,
  chevron = false,
  blocked = false,
  onPress,
  divider = false,
  className,
  ...rest
}: UserListItemProps) {
  const handle = username ? `@${username}` : undefined
  const a11yLabel = [
    name,
    handle,
    verified ? "terverifikasi" : undefined,
    stat,
    blocked ? "diblokir" : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  const body = (
    <View
      className={cn("min-h-14 flex-1 flex-row items-center gap-3 py-3", blocked && "opacity-60")}
    >
      <Avatar source={avatar?.source} name={name} size="md" verified={verified} />
      <View className="flex-1 gap-[2px]">
        <Text variant="body" weight={500} tone="primary" numberOfLines={1}>
          {name}
        </Text>
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
      <View className={cn("flex-row items-center gap-3", padded && "px-6")}>
        {onPress ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint="Buka profil"
            scaleOnPress={false}
            onPress={onPress}
            containerClassName="flex-1"
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
      {divider ? <View className="ml-[76px] h-px bg-border" /> : null}
    </View>
  )
}
