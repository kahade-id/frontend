/**
 * Kahade — <ChatRoomListItem> (§9.17 List Item, §9.14 badge unread).
 *
 * Baris ruang obrolan di tab Chat: Avatar md (+ Dot online) -> nama +
 * waktu pesan terakhir di baris pertama; preview pesan + indikator
 * (unread / muted / pinned) di baris kedua. Konteks order opsional
 * (mis. "Order #KHD-2391") sebagai caption Mono text-tertiary di bawah nama
 * — bukan Badge: tiga baris teks + Badge berbingkai membuat baris terlalu
 * ramai, dan ID order adalah data teknis (Mono, §3.1) yang tidak butuh
 * penekanan warna.
 *
 * Mengikuti anatomi ListItem/UserDiscoverResultItem (`min-h-14 px-6 py-3
 * gap-3`, divider inset ml-[64px] = px-6 + avatar md) supaya irama list
 * konsisten. Tidak dibangun di atas <ListItem> karena punya dua kolom
 * kanan (waktu di atas, unread di bawah) yang tidak ada di kontrak ListItem.
 *
 * Keputusan non-obvious:
 *   - Unread count = pill `bg-primary` teks inverse caption 600 tabular,
 *     BUKAN merah. §9.14 memakai dot merah tanpa angka hanya untuk tab bar;
 *     di dalam daftar, jumlah pesan bukan status bahaya — hitam (otoritas,
 *     §1) sudah cukup menonjol di antara baris abu-abu. Angka > 99 jadi
 *     "99+" agar lebar pill tidak melebar tak terbatas.
 *   - Baris dengan unread menaikkan nama & preview ke weight 600 / tone
 *     primary; baris terbaca kembali ke 500 / secondary. Ini pembeda utama
 *     sebelum user melihat angka — sama seperti `unread` di SecurityLogItem,
 *     tapi di sini TIDAK memakai bg-surface karena avatar bulat di atas
 *     surface membuat baris terlihat "kotak-kotak".
 *   - Waktu caption tabular (bukan Mono) — alasan sama dengan
 *     ChatMessageBubble: meta percakapan, bukan timestamp teknis (§3.1).
 *     Formatnya tanggung jawab pemanggil (hari ini "14:32", kemarin
 *     "Kemarin", lebih lama "12 Mar") supaya komponen tidak mengunci aturan
 *     relatif-waktu yang bisa berubah per layar.
 *   - `typing` mengganti preview dengan "mengetik…" weight 500 text-secondary
 *     — tanpa italic (font yang di-bundle tidak menyertakan italic, §3.1)
 *     dan tanpa animasi titik: satu titik kejutan per layar (§1) sudah
 *     dipakai pull-to-refresh di daftar ini.
 *   - Prefix "Anda: " ditambahkan bila `lastMessage.fromSelf` — supaya user
 *     tahu bola ada di lawan bicara, tanpa ikon centang ganda tambahan yang
 *     akan bersaing dengan unread pill di kolom kanan.
 *   - Online = <Dot size="md" tone="success" ring> ditumpuk di kanan-bawah
 *     avatar. Ring memisahkan dari avatar tanpa shadow (§6). Dot dipasang
 *     absolute karena harus overlap — pengecualian sadar dari aturan flex.
 *   - Muted/pinned = ikon 16px text-tertiary di sebelah waktu, tanpa label.
 *     Keduanya masuk accessibilityLabel baris agar tetap terbaca SR.
 */
import { View, type ViewProps } from "react-native"
import { BellSlash, PushPin } from "phosphor-react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Dot } from "@/components/ui/dot"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

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
    <View className="min-h-14 flex-row items-center gap-3 px-6 py-3">
      <View>
        <Avatar source={avatar} name={name} size="md" verified={verified} />
        {online ? (
          <Dot size="md" tone="success" ring className="absolute bottom-0 right-0" />
        ) : null}
      </View>

      <View className="flex-1 gap-[2px]">
        <View className="flex-row items-center gap-2">
          <Text
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
                tone={hasUnread ? "primary" : "tertiary"}
                weight={hasUnread ? 500 : 400}
                className="tabular-nums"
              >
                {time}
              </Text>
            ) : null}
          </View>
        </View>

        {context ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1} className="font-mono-500">
            {context}
          </Text>
        ) : null}

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
          {hasUnread ? (
            <View className="min-w-5 items-center justify-center rounded-full bg-primary px-[6px] py-[1px]">
              <Text variant="caption" tone="inverse" weight={600} className="tabular-nums">
                {unreadLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )

  return (
    <View className={cn("w-full", className)} {...rest}>
      {onPress || onLongPress ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint="Buka percakapan"
          scaleOnPress={false}
          onPress={onPress}
          onLongPress={onLongPress}
        >
          {row}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={a11yLabel}>
          {row}
        </View>
      )}

      {divider ? <View className="ml-[64px] h-px bg-border" /> : null}
    </View>
  )
}
