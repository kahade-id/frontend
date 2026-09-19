/**
 * Kahade — <ChatRoomListItem> (§9.17 List Item, §9.14 badge unread).
 *
 * Baris ruang obrolan di tab Chat: Avatar md (+ Dot online) -> nama + waktu
 * pesan terakhir di baris pertama; preview pesan + indikator (unread / muted /
 * pinned) di baris kedua. Konteks order opsional (mis. "Order #KHD-2391")
 * sebagai caption Mono text-secondary di bawah nama — bukan Badge.
 *
 * v2 (2026-09):
 *   - Daftar Chat TIDAK memakai pemisah antar baris: irama dibentuk dari
 *     spasi (`divider` top + bottom, `gap-0.5`, `min-h`) supaya daftar pesan
 *     terlihat rapat & sunyi, konsisten dengan daftar notifikasi. Divider
 *     tersisa saat BARIS PERTAMA/TERAKHIR butuh bingkai dari elemen
 *     bersebelahan (mis. kartu ringkasan).
 *   - Trailing `<CaretRight>` di kanan sebagai affordansi "ruang bisa
 *     dibuka", BUKAN unread-pill besar — jumlah belum dibaca jadi caption
 *     di bawah waktu agar navigasi tidak terikat status.
 *
 * Mengikuti anatomi ListItem (`min-h-14 px-5 py-3 gap-3`) supaya irama list
 * konsisten. Tidak dibangun di atas <ListItem> karena punya dua kolom kanan
 * (waktu di atas, unread di bawah) yang tidak ada di kontrak ListItem.
 *
 * Keputusan non-obvious:
 *   - Unread count = pill kecil `bg-primary` teks inverse caption 600
 *     tabular, BUKAN merah. §9.14 memakai dot merah tanpa angka hanya untuk
 *     tab bar; di dalam daftar, jumlah pesan bukan status bahaya — hitam
 *     (otoritas, §1) sudah cukup menonjol.
 *   - Baris unread menaikkan nama ke weight 600; preview ke 500 — ini
 *     pembeda utama sebelum user melihat angka.
 *   - Waktu caption tabular (bukan Mono). Formatnya tanggung jawab pemanggil.
 *   - `typing` mengganti preview dengan "mengetik…" weight 500.
 *   - Prefix "Anda: " ditambahkan bila `lastMessage.fromSelf`.
 *   - Online = <Dot size="md" tone="success" ring> di kanan-bawah avatar.
 *   - Muted/pinned = ikon 16px text-tertiary di sebelah waktu.
 */
import { View, type ViewProps } from "react-native"
import { BellSlash, CaretRight, PushPin } from "phosphor-react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Dot } from "@/components/ui/dot"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { focusRingInset } from "@/lib/focus-ring"

export type ChatRoomLastMessage = {
  text: string
  /** Pesan terakhir dikirim oleh pengguna sendiri -> prefix "Anda:" */
  fromSelf?: boolean
}

export type ChatRoomListItemProps = Omit<ViewProps, "children"> & {
  name: string
  avatar?: AvatarProps["source"]
  verified?: boolean
  online?: boolean
  lastMessage?: ChatRoomLastMessage
  /** Sudah diformat pemanggil: "14:32" / "Kemarin" / "12 Mar" */
  time?: string
  unreadCount?: number
  typing?: boolean
  muted?: boolean
  pinned?: boolean
  /** Konteks transaksi, mis. "Order #KHD-2391" — dirender Badge outline Mono */
  context?: string
  onPress?: () => void
  onLongPress?: () => void
  divider?: boolean
  /** Garis batas ATAS — untuk baris pertama yang butuh bingkai (kartu dst). */
  dividerTop?: boolean
  labels?: { you?: string; typing?: string; unread?: string }
  className?: string
}

const DEFAULT_LABELS = { you: "Anda", typing: "mengetik…", unread: "belum dibaca" }

export function ChatRoomListItem({
  name,
  avatar,
  verified = false,
  online = false,
  lastMessage,
  time,
  unreadCount = 0,
  typing = false,
  muted = false,
  pinned = false,
  context,
  onPress,
  onLongPress,
  divider = false,
  dividerTop = false,
  labels,
  className,
  ...rest
}: ChatRoomListItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const hasUnread = unreadCount > 0
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount)

  const preview = typing
    ? t.typing
    : lastMessage
      ? `${lastMessage.fromSelf ? `${t.you}: ` : ""}${lastMessage.text}`
      : ""

  const a11yLabel = [
    name,
    context,
    preview,
    time,
    hasUnread ? `${unreadCount} ${t.unread}` : undefined,
    muted ? "dibisukan" : undefined,
    pinned ? "disematkan" : undefined,
    online ? "online" : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  const row = (
    <View className="min-h-14 flex-row items-center gap-3 px-5 py-3">
      <View>
        <Avatar source={avatar} name={name} size="md" verified={verified} />
        {online ? (
          <Dot size="md" tone="success" ring className="absolute bottom-0 right-0" />
        ) : null}
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text ellipsizeMode="tail"
            variant="body"
            weight={hasUnread ? 600 : 500}
            tone="primary"
            numberOfLines={1}
            className="flex-1"
          >
            {name}
          </Text>
          <View className="flex-row items-center gap-1">
            {pinned ? <Icon icon={PushPin} size="xs" tone="default" /> : null}
            {muted ? <Icon icon={BellSlash} size="xs" tone="default" /> : null}
            {time ? (
              <Text
                variant="caption"
                tone={hasUnread ? "primary" : "secondary"}
                weight={hasUnread ? 500 : 400}
                className="tabular-nums"
              >
                {time}
              </Text>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <Text
            variant="caption"
            tone={typing || hasUnread ? "primary" : "secondary"}
            weight={typing || hasUnread ? 500 : 400}
            numberOfLines={1}
            className="flex-1"
          >
            {preview}
          </Text>
          {/* Panel kanan-bawah: count pesan belum dibaca → chevron navigasi. */}
          <View className="items-center">
            {hasUnread ? (
              <View className="items-center justify-center rounded-full bg-primary px-1.5 py-[1px]">
                <Text variant="caption" tone="inverse" weight={600} className="tabular-nums">
                  {unreadLabel}
                </Text>
              </View>
            ) : null}
          </View>
          {onPress ? <Icon icon={CaretRight} size="xs" tone="default" /> : null}
        </View>

        {context ? (
          <Text variant="caption" tone="secondary" numberOfLines={1} className="font-mono-500">
            {context}
          </Text>
        ) : null}
      </View>
    </View>
  )

  const dividerLine = (
    <View
      accessibilityRole="none"
      importantForAccessibility="no"
      className="h-px bg-border"
      style={{ marginLeft: tokens.layout.rowDividerInset.avatar }}
    />
  )

  return (
    <View className={cn("w-full", className)} {...rest}>
      {dividerTop ? dividerLine : null}

      {onPress || onLongPress ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint="Buka percakapan"
          scaleOnPress={false}
          onPress={onPress}
          onLongPress={onLongPress}
          containerClassName={cn("w-full", focusRingInset)}
        >
          {row}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={a11yLabel}>
          {row}
        </View>
      )}

      {divider ? dividerLine : null}
    </View>
  )
}