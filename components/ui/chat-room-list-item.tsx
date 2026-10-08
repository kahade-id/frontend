/**
 * Kahade — <ChatRoomListItem> (§9.17 List Item, §9.14 badge unread).
 *
 * Baris ruang obrolan di layar Chat. Anatomi v3 (2026-09-21, referensi
 * WhatsApp — permintaan pemilik produk) adalah DUA baris teks tepat, tanpa
 * baris konteks ketiga dan tanpa chevron:
 *
 *   [avatar 48] nama lengkap .................. order id (mono, terpotong tengah)
 *               preview pesan terakhir ........ [bisu] [unread] waktu
 *
 * Kenapa dua baris cukup (dan kenapa baris ketiga dihapus): konteks order
 * ("Pesanan KHD-23…") dulu menempati baris ketiga sehingga tiap baris list
 * setinggi ±86px — daftar chat terasa seperti daftar pesanan, bukan daftar
 * percakapan. Order id dipindah ke kanan baris pertama sebagai metadata
 * (mono, caption, tanpa kata "Pesanan" — redundan di layar Chat), dan daftar
 * kembali rapat: satu layar memuat 8–9 percakapan, bukan 5.
 *
 * Ukuran & tipografi (pas di semua device, bukan hanya 360dp):
 *   - Avatar 48px (`size="lg"` di-override `h-12 w-12`) — di antara md 40 dan
 *     lg 56; 48 adalah titik tempat wajah tetap terbaca tanpa membuat baris
 *     lebih tinggi dari 68px. Di layar sempit (< 360dp, mis. iPhone SE
 *     landscape/Android go) turun ke md 40 agar nama tidak terpotong.
 *   - Nama `bodyLarge` (16) weight 500, naik 600 saat ada pesan belum dibaca.
 *   - Preview `body` (14) text-secondary; `text-primary` + 500 saat unread /
 *     mengetik — pembeda utama sebelum mata sampai ke angka unread.
 *   - Order id & waktu `caption` (12) tabular; waktu naik ke primary/500 saat
 *     unread (pola WhatsApp: jam ikut menebal bersama badge).
 *
 * Keputusan non-obvious:
 *   - TANPA pemisah antar baris dan TANPA garis di baris pertama: irama
 *     dibentuk spasi (py-2.5) + hierarki tipografi. `divider`/`dividerTop`
 *     tetap tersedia untuk pemakai yang butuh bingkai (mis. di bawah kartu
 *     ringkasan) — inset-nya dihitung dari anatomi baris di bawah.
 *   - TANPA `<CaretRight>`: seluruh baris adalah target ketuk dan daftar chat
 *     adalah pola yang sudah dipahami; chevron hanya menambah tinta dan
 *     menyempitkan preview pesan.
 *   - Unread = pill `bg-primary` teks inverse caption 600 tabular (bukan
 *     merah — §9.14 memakai dot merah tanpa angka hanya untuk tab bar; jumlah
 *     pesan bukan status bahaya).
 *   - `typing` mengganti preview dengan "mengetik…" weight 500.
 *   - Prefix "Anda: " ditambahkan bila `lastMessage.fromSelf`; status kirim
 *     pesan sendiri (`lastMessage.status`) tampil sebagai centang di kiri
 *     waktu — satu (terkirim) / ganda tebal (dibaca), kosakata yang sama
 *     dengan <ChatMessageBubble> (pola Telegram: centang di sisi metadata).
 *   - `draft` (teks ketikan yang belum terkirim) MENGALAHKAN preview pesan
 *     terakhir: "Draf: …" dengan label merah (pola Telegram/WhatsApp) —
 *     pengingat ada ketikan yang tertinggal; mengetik lawan tetap menang.
 *   - Online = <Dot size="lg" tone="success" ring> di kanan-bawah avatar.
 *   - Mode pilih (`selecting`): baris menjadi target toggle, lencana Check
 *     menumpuk avatar (menggantikan dot online), dan baris terpilih diberi
 *     `bg-surface`. Dipakai layar Chat untuk aksi massal arsip/bisu — pola
 *     yang sama dengan daftar Notifikasi, TANPA ActionSheet.
 *   - `ripple` default ON di sini: baris list adalah permukaan yang disapu
 *     jari (lihat PressableScale — keputusan produk 2026-09-21).
 */
import { BellSlash, Check, Checks, LockKey, PushPin } from "phosphor-react-native"
import { memo } from "react"
import { useWindowDimensions, View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { type SealTier } from "@/components/ui/verified-seal"
import { Badge } from "@/components/ui/badge"
import { Dot } from "@/components/ui/dot"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"
import { focusRingInset } from "@/lib/focus-ring"

export type ChatRoomLastMessage = {
  text: string
  /** Pesan terakhir dikirim oleh pengguna sendiri -> prefix "Anda:" */
  fromSelf?: boolean
  /**
   * Status kirim pesan sendiri (hanya bermakna bila `fromSelf`): "sent" =
   * centang satu, "read" = centang ganda tebal. Tidak diisi = tanpa centang.
   */
  status?: "sent" | "read"
}

export type ChatRoomListItemProps = Omit<ViewProps, "children"> & {
  name: string
  avatar?: AvatarProps["source"]
  verified?: boolean
  /**
   * CHT-009: tier seal lawan bicara (dari GET /v1/chat/rooms →
   * counterpart.sealTier) — badge avatar memakai warna tier, konsisten
   * dengan header room & bubble. `verified` tetap didukung untuk pemanggil
   * lama (fallback biru di Avatar).
   */
  sealTier?: SealTier | null
  online?: boolean
  lastMessage?: ChatRoomLastMessage
  /** Sudah diformat pemanggil: "14:32" / "Kemarin" / "12 Mar" */
  time?: string
  unreadCount?: number
  typing?: boolean
  /** Ketikan yang belum terkirim di room ini — preview jadi "Draf: …". */
  draft?: string
  muted?: boolean
  pinned?: boolean
  /**
   * Metadata transaksi ringkas di kanan baris pertama — order id mentah yang
   * sudah dipotong pemanggil (`truncateMiddle(orderId)`), TANPA kata
   * "Pesanan". Dirender Mono caption text-secondary.
   */
  context?: string
  /**
   * U5-009 (UX-deep 2026-09-29): badge "Terlindungi" dengan ikon gembok di
   * kanan baris pertama menggantikan kode order mentah (`context`). `context`
   * tetap didukung untuk pemanggil lain (tidak ada lagi saat ini).
   */
  orderBadge?: boolean
  onPressIn?: () => void
  onPress?: () => void
  onLongPress?: () => void
  /** Mode pilih-banyak aktif: baris menjadi toggle, lencana Check tampil. */
  selecting?: boolean
  /** Baris ini sedang dipilih (hanya bermakna saat `selecting`). */
  selected?: boolean
  /** Umpan balik ripple — default ON (baris list = permukaan sapuan jari). */
  ripple?: boolean
  divider?: boolean
  /** Garis batas ATAS — untuk baris pertama yang butuh bingkai (kartu dst). */
  dividerTop?: boolean
  labels?: { you?: string; typing?: string; unread?: string; selected?: string; draft?: string }
  className?: string
}

const DEFAULT_LABELS = {
  you: "Anda",
  typing: "mengetik…",
  unread: "belum dibaca",
  selected: "dipilih",
  draft: "Draf",
}

/**
 * Lebar layar (dp) di bawahnya avatar turun ke `md` (40px). 360 adalah lebar
 * Android paling umum; di bawah itu (320dp) kolom teks kehilangan 8px yang
 * justru dibutuhkan nama panjang.
 */
const NARROW_WIDTH = 360
/** Diameter avatar baris chat di layar normal — lihat docblock. */
const AVATAR_WIDE_CLASS = "h-12 w-12"
/**
 * Inset divider = gutter kiri (px-4 = 16) + avatar (48) + gap (space.3 = 12)
 * = 76, supaya garis mulai sejajar TEKS nama, bukan sejajar avatar.
 */
const DIVIDER_INSET_WIDE = tokens.space[4] + 48 + tokens.space[3]
const DIVIDER_INSET_NARROW = tokens.space[4] + 40 + tokens.space[3]

export function ChatRoomListItemBase({
  name,
  avatar,
  verified = false,
  sealTier = null,
  online = false,
  lastMessage,
  time,
  unreadCount = 0,
  typing = false,
  draft,
  muted = false,
  pinned = false,
  context,
  orderBadge = false,
  onPressIn,
  onPress,
  onLongPress,
  selecting = false,
  selected = false,
  ripple = true,
  divider = false,
  dividerTop = false,
  labels,
  className,
  ...rest
}: ChatRoomListItemProps) {
  useLanguage()
  // Label digabung ke string preview (bukan children <Text> murni), jadi
  // diterjemahkan eksplisit — `translate` mengembalikan sumber bila tak ada.
  const merged = { ...DEFAULT_LABELS, ...labels }
  const t = {
    ...merged,
    you: translate(merged.you),
    typing: translate(merged.typing),
    draft: translate(merged.draft),
  }
  const protectedLabel = translate("Terlindungi")
  const { width } = useWindowDimensions()
  const compact = width < NARROW_WIDTH
  const hasUnread = unreadCount > 0
  const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount)

  const draftText = draft?.trim() ?? ""
  const showDraft = !typing && draftText.length > 0
  const preview = typing
    ? t.typing
    : showDraft
      ? draftText
      : lastMessage
        ? `${lastMessage.fromSelf ? `${t.you}: ` : ""}${lastMessage.text}`
        : ""
  const selfStatus = !typing && lastMessage?.fromSelf ? lastMessage.status : undefined

  const a11yLabel = [
    selecting && selected ? t.selected : undefined,
    name,
    showDraft ? `${t.draft}: ${preview}` : preview,
    selfStatus === "read" ? translate("Dibaca") : selfStatus === "sent" ? translate("Terkirim") : undefined,
    orderBadge ? protectedLabel : context,
    time,
    hasUnread ? `${unreadCount} ${t.unread}` : undefined,
    muted ? "dibisukan" : undefined,
    pinned ? "disematkan" : undefined,
    online ? "online" : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  const row = (
    <View
      className={cn(
        "min-h-16 flex-row items-center gap-3 px-4 py-2.5",
        selecting && selected && "bg-surface",
      )}
    >
      {/* Leading: avatar + status (online / lencana pilih) */}
      <View>
        <Avatar
          source={avatar}
          name={name}
          size={compact ? "md" : "lg"}
          verified={verified || sealTier != null}
          sealTier={sealTier ?? undefined}
          className={compact ? undefined : AVATAR_WIDE_CLASS}
        />
        {selecting ? (
          <View
            className={cn(
              "absolute bottom-0 right-0 h-5 w-5 items-center justify-center rounded-full border-focus border-background",
              selected ? "bg-primary" : "bg-surface",
            )}
          >
            {selected ? (
              <Icon icon={Check} size={12} tone="inverse" weight="bold" />
            ) : null}
          </View>
        ) : online ? (
          <Dot size="lg" tone="success" ring className="absolute bottom-0 right-0" />
        ) : null}
      </View>

      {/* Kolom teks: tepat dua baris */}
      <View className="min-w-0 flex-1 gap-0.5">
        {/* Baris 1 — nama (kiri) · order id (kanan) */}
        <View className="flex-row items-center gap-2">
          <Text
            ellipsizeMode="tail"
            variant="bodyLarge"
            weight={hasUnread ? 600 : 500}
            tone="primary"
            numberOfLines={1}
            className="min-w-0 flex-1"
          >
            {name}
          </Text>
          {pinned ? <Icon icon={PushPin} size="xs" tone="default" /> : null}
          {orderBadge ? (
            <View className="shrink-0 flex-row items-center gap-1">
              <Icon icon={LockKey} size="xs" tone="accent" />
              <Badge tone="accent" variant="outline" className="shrink-0">
                {protectedLabel}
              </Badge>
            </View>
          ) : context ? (
            <Text
              variant="caption"
              tone="secondary"
              numberOfLines={1}
              className="max-w-[38%] shrink-0 font-mono-500"
            >
              {context}
            </Text>
          ) : null}
        </View>

        {/* Baris 2 — preview pesan (kiri) · indikator + waktu (kanan) */}
        <View className="flex-row items-center gap-2">
          <Text
            ellipsizeMode="tail"
            variant="body"
            tone={typing || hasUnread ? "primary" : "secondary"}
            weight={typing || hasUnread ? 500 : 400}
            numberOfLines={1}
            className="min-w-0 flex-1"
          >
            {showDraft ? (
              <Text variant="inherit" tone="danger" weight={500}>
                {t.draft}:{" "}
              </Text>
            ) : null}
            {preview}
          </Text>
          <View className="flex-row shrink-0 items-center gap-1.5">
            {muted ? <Icon icon={BellSlash} size="xs" tone="default" /> : null}
            {selfStatus === "read" ? (
              <Icon icon={Checks} size="xs" tone="active" weight="bold" />
            ) : selfStatus === "sent" ? (
              <Icon icon={Check} size="xs" tone="default" />
            ) : null}
            {hasUnread ? (
              <View className="items-center justify-center rounded-full bg-primary px-1.5 py-[1px]">
                <Text variant="caption" tone="inverse" weight={600} className="tabular-nums">
                  {unreadLabel}
                </Text>
              </View>
            ) : null}
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
      </View>
    </View>
  )

  const dividerLine = (
    <View
      accessibilityRole="none"
      importantForAccessibility="no"
      className="h-px bg-border"
      style={{ marginLeft: compact ? DIVIDER_INSET_NARROW : DIVIDER_INSET_WIDE }}
    />
  )

  return (
    <View className={cn("w-full", className)} {...rest}>
      {dividerTop ? dividerLine : null}

      {onPress || onLongPress ? (
        <PressableScale
          accessibilityRole={selecting ? "checkbox" : "button"}
          accessibilityLabel={a11yLabel}
          accessibilityState={selecting ? { selected, checked: selected } : undefined}
          accessibilityHint={
            selecting ? undefined : "Buka percakapan, atau tekan lama untuk memilih beberapa"
          }
          scaleOnPress={false}
          ripple={ripple}
          onPressIn={onPressIn}
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

/**
 * LR-003 (2026-09-29): pembanding kustom untuk `memo`.
 *
 * `avatar` dan `lastMessage` adalah objek yang sering dibuat ulang pemanggil
 * (literal `{ uri }` / `{ text, fromSelf }` per render) — dibandingkan per
 * FIELD, bukan referensi. `labels` juga per-field sebagai pertahanan lapis
 * kedua. Sisanya primitif/callback by-value/by-reference.
 *
 * `...rest` (ViewProps tambahan) TIDAK dibandingkan: pemanggil yang memakai
 * prop ekstra harus menjaganya stabil sendiri. Pemakaian saat ini (daftar
 * chat) tidak mengirim prop ekstra.
 */
function isSameAvatarSource(
  a: ChatRoomListItemProps["avatar"],
  b: ChatRoomListItemProps["avatar"],
): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== "object" || typeof b !== "object") return a === b
  // RN 0.88: `ImageSource` memakai `ReadonlyArray<ImageURISource>`, dan
  // `Array.isArray` TIDAK mempersempit tipe readonly — guard eksplisit ini
  // yang membuat cabang array terbuang sebelum `.uri` dibaca.
  const isReadonlyArray = (v: unknown): v is readonly unknown[] => Array.isArray(v)
  if (isReadonlyArray(a) || isReadonlyArray(b)) return false
  return (a.uri ?? null) === (b.uri ?? null)
}

function isSameLastMessage(
  a: ChatRoomListItemProps["lastMessage"],
  b: ChatRoomListItemProps["lastMessage"],
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.text === b.text &&
    !!a.fromSelf === !!b.fromSelf &&
    (a.status ?? null) === (b.status ?? null)
  )
}

function isSameLabels(
  a: ChatRoomListItemProps["labels"],
  b: ChatRoomListItemProps["labels"],
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    (a.you ?? null) === (b.you ?? null) &&
    (a.typing ?? null) === (b.typing ?? null) &&
    (a.unread ?? null) === (b.unread ?? null) &&
    (a.selected ?? null) === (b.selected ?? null) &&
    (a.draft ?? null) === (b.draft ?? null)
  )
}

function areRoomItemPropsEqual(
  prev: ChatRoomListItemProps,
  next: ChatRoomListItemProps,
): boolean {
  return (
    prev.name === next.name &&
    isSameAvatarSource(prev.avatar, next.avatar) &&
    prev.verified === next.verified &&
    (prev.sealTier ?? null) === (next.sealTier ?? null) &&
    prev.online === next.online &&
    isSameLastMessage(prev.lastMessage, next.lastMessage) &&
    prev.time === next.time &&
    (prev.unreadCount ?? 0) === (next.unreadCount ?? 0) &&
    prev.typing === next.typing &&
    (prev.draft ?? "") === (next.draft ?? "") &&
    prev.muted === next.muted &&
    prev.pinned === next.pinned &&
    (prev.context ?? null) === (next.context ?? null) &&
    (prev.orderBadge ?? false) === (next.orderBadge ?? false) &&
    prev.onPressIn === next.onPressIn &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.selecting === next.selecting &&
    prev.selected === next.selected &&
    prev.ripple === next.ripple &&
    prev.divider === next.divider &&
    prev.dividerTop === next.dividerTop &&
    isSameLabels(prev.labels, next.labels) &&
    (prev.className ?? null) === (next.className ?? null)
  )
}

/**
 * LR-003: baris daftar chat di-`memo` — update kecil di satu room (badge
 * unread, status online, indikator mengetik) tidak lagi me-render ulang
 * semua baris yang terlihat.
 */
export const ChatRoomListItem = memo(ChatRoomListItemBase, areRoomItemPropsEqual)
