/**
 * Screen — Ruang Chat (GET /v1/chat/rooms). List ChatRoomListItem.
 *
 * v4 (2026-09-28, TIM D item 17 & 18):
 *   - FILTER CHIP (item 17): baris chip di bawah header — Semua / Belum
 *     dibaca / Transaksi / Diarsipkan. "Diarsipkan" memakai query terpisah
 *     `?archived=true` (server-side, B4 — arsip tidak pernah difilter
 *     client-side dari query utama supaya tidak "menguap" tiap refetch).
 *     "Belum dibaca" (`unreadCount > 0`) & "Transaksi" (punya `orderId` /
 *     type ORDER) adalah filter tampilan di atas halaman yang sudah dimuat
 *     (backend hanya mendukung filter `archived` di GET /v1/chat/rooms —
 *     dicatat supaya tidak disangka query server). Chip "Grup" tidak dibuat:
 *     tidak ada indikasi grup di data room existing (chat 1:1 & transaksi).
 *   - SWIPE (item 18): tiap baris = <SwipeableListItem> —
 *       swipe KANAN (aksi di kiri)  → Pin / Lepas pin (per perangkat, local)
 *       swipe KIRI  (aksi di kanan) → Arsip / Buka arsip, Hapus (destruktif)
 *     Pin disimpan per perangkat (lib/chat-pinned-rooms, SecureStore) karena
 *     backend belum punya endpoint pin RUANG (hanya pin PESAN). Sinkronisasi
 *     akun butuh keputusan produk + kerja backend — dicatat, tidak di sini.
 *     Hapus: dialog konfirmasi WAJIB (1-by-1, tanpa bulk). Aturan backend:
 *     room transaksi hanya boleh dihapus bila order COMPLETED — diperiksa via
 *     getOrder(orderId) (API existing) SEBELUM dialog; bila belum boleh, opsi
 *     hapus tidak dieksekusi dan dialog pesan jelas tampil. Room DM (tanpa
 *     orderId) bebas dihapus pemiliknya. Kontrak TIM B (2026-09-28):
 *     DELETE /v1/chat/rooms/:roomId → { deleted, roomId, permanent };
 *     permanent=true = DM hard delete, permanent=false = room order COMPLETED
 *     soft delete (riwayat untuk audit). 404 NOT_FOUND / 403
 *     NOT_ORDER_PARTICIPANT / 409 CHAT_ROOM_DELETE_ORDER_NOT_COMPLETED
 *     (fail closed, termasuk CANCELLED/DISPUTED) dipetakan ke pesan jelas.
 *   - Tekan lama tetap masuk MODE PILIH (aksi massal Bisukan/Arsipkan);
 *     swipe dimatikan selama mode pilih supaya gesture tidak bentrok.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { ScrollView, View, type View as RNView } from "react-native"
import { Archive, BellSlash, BellZ, Chats, GearSix, NotePencil, PushPin, Trash, X } from "phosphor-react-native"
import { router, useFocusEffect } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import {
  CHAT_PAGE_SIZE,
  canDeleteChatRoom,
  chatRoomPreview,
  deleteChatRoom,
  getOrCreateSelfRoom,
  setRoomArchived,
  setRoomMuted,
  type ChatRoom,
} from "@/lib/api/chat"
import {
  CHAT_SOCKET_EVENTS,
  TYPING_EXPIRY_MS,
  type ChatTypingPayload,
} from "@/lib/realtime/chat-events"
import { useRealtime } from "@/lib/realtime/realtime-context"
import { ORDER_STATUS_LABELS } from "@/lib/labels/status"
import { formatTimeAgo } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { TAB_BAR_HEIGHT } from "@/components/ui/bottom-tab-bar"
import {
  ensurePinnedLoaded,
  isRoomPinned,
  sortRoomsPinnedFirst,
  subscribePinnedRooms,
  toggleRoomPinned,
} from "@/lib/chat-pinned-rooms"
import { seedChatRoomPrefetch } from "@/lib/chat-room-prefetch"

import { ChatRoomListItem, type ChatRoomLastMessage } from "@/components/ui/chat-room-list-item"
import { Button } from "@/components/ui/button"
import { ChipGroup, type ChipOption } from "@/components/ui/chip"
import { CoachMark } from "@/components/ui/coach-mark"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { DrawerMenuButton } from "@/components/ui/drawer-menu-button"
import { ModeShiftFade } from "@/components/ui/mode-switcher"
import { PaginatedList } from "@/components/ui/paginated-list"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import {
  SwipeableListItem,
  useSwipeableGroup,
  type SwipeAction,
  type SwipeableGroup,
  type SwipeSide,
} from "@/components/ui/swipeable-list-item"
import { useToast } from "@/components/ui/toast"
import { useScrollElevation } from "@/lib/use-scroll-elevation"

/**
 * Batas jumlah ruang yang bisa dipilih sekaligus. Backend tidak punya
 * endpoint batch (satu PUT per ruang), jadi batas ini menjaga agar satu
 * ketukan tidak memicu ratusan request paralel; 50 selaras dengan
 * BatchNotificationIdsDto di layar Notifikasi.
 */
const SELECTION_MAX = 50
/** Baris skeleton saat muat pertama — sebentuk <ChatRoomListItem>. */
const SKELETON_COUNT = 7

/** Item 17 — filter daftar chat. "archived" = query server terpisah (B4). */
type ChatFilter = "all" | "unread" | "transaction" | "archived"
const FILTER_OPTIONS: readonly ChipOption<ChatFilter>[] = [
  { value: "all", label: "Semua" },
  { value: "unread", label: "Belum dibaca" },
  { value: "transaction", label: "Transaksi" },
  { value: "archived", label: "Diarsipkan" },
]

function ChatSkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 px-4 py-2.5">
      <Skeleton shape="circle" width={48} height={48} />
      <View className="min-w-0 flex-1 gap-1.5">
        <Skeleton height={14} style={{ width: "45%" }} />
        <Skeleton height={12} style={{ width: "80%" }} />
      </View>
    </View>
  )
}

/** "Transaksi" = punya orderId atau type ORDER (DRIFT-06: backend mengirim `type`). */
function isTransactionRoom(room: ChatRoom): boolean {
  return Boolean(room.orderId) || (room.type ?? room.roomType) === "ORDER"
}

/**
 * CHT-008: indikator "mengetik…" di DAFTAR room.
 *
 * Server hanya mengirim `chat.typing` ke socket yang join `chat:<roomId>`,
 * jadi layar daftar join room yang sedang tampil dan mendengarkan event
 * typing global. Join dilakukan BERTAHAP (hemat kuota WS 30/10 dtk, jangan
 * join puluhan room sekaligus). Tiap room punya timer expiry sendiri
 * (TYPING_EXPIRY_MS) — sinyal `stop` yang hilang tidak membuat indikator
 * macet. Join diulang saat: daftar room berubah, socket reconnect (epoch
 * baru), dan tab kembali fokus (layar room melepas join-nya saat unmount —
 * tanpa ini, indikator room yang baru dikunjungi mati diam-diam).
 *
 * Mengembalikan Set roomId yang sedang mengetik (selain diri sendiri).
 */
const TYPING_JOIN_BATCH = 10
const TYPING_JOIN_GAP_MS = 2000

function useChatListTyping(roomIds: string[]): Set<string> {
  const { socket, status, epoch, viewerId, joinRoom, leaveRoom, unwrapEvent } = useRealtime()
  const [typingRooms, setTypingRooms] = useState<Set<string>>(() => new Set())
  /** Room yang sedang di-join sesi ini — untuk leave saat tak tampil lagi. */
  const joinedRef = useRef<Set<string>>(new Set())
  /** Timer expiry per room — sinyal stop yang hilang tetap clear. */
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const epochRef = useRef(epoch)
  const apiRef = useRef({ joinRoom, leaveRoom, unwrapEvent, viewerId })
  apiRef.current = { joinRoom, leaveRoom, unwrapEvent, viewerId }
  /** Dipicu ulang tiap tab kembali fokus (lihat docblock). */
  const [focusTick, setFocusTick] = useState(0)
  useFocusEffect(
    useCallback(() => {
      setFocusTick((t) => t + 1)
    }, []),
  )

  const signalTyping = useCallback((roomId: string, isTyping: boolean) => {
    const timers = timersRef.current
    const prevTimer = timers.get(roomId)
    if (prevTimer) {
      clearTimeout(prevTimer)
      timers.delete(roomId)
    }
    setTypingRooms((prev) => {
      const has = prev.has(roomId)
      if (has === isTyping) return prev
      const next = new Set(prev)
      if (isTyping) next.add(roomId)
      else next.delete(roomId)
      return next
    })
    if (isTyping) {
      timers.set(
        roomId,
        setTimeout(() => {
          timers.delete(roomId)
          setTypingRooms((prev) => {
            if (!prev.has(roomId)) return prev
            const next = new Set(prev)
            next.delete(roomId)
            return next
          })
        }, TYPING_EXPIRY_MS),
      )
    }
  }, [])

  // Satu listener typing global per koneksi socket.
  useEffect(() => {
    if (!socket || status !== "connected") return
    const onTyping = (raw: unknown) => {
      const payload = apiRef.current.unwrapEvent(raw) as Partial<ChatTypingPayload> | null
      const roomId = payload?.roomId
      if (typeof roomId !== "string" || !roomId) return
      // Gema sendiri diabaikan — server broadcast termasuk ke pengirim.
      const me = apiRef.current.viewerId
      if (me != null && payload?.userId === me) return
      signalTyping(roomId, payload?.isTyping === true)
    }
    socket.on(CHAT_SOCKET_EVENTS.TYPING, onTyping)
    return () => {
      socket.off(CHAT_SOCKET_EVENTS.TYPING, onTyping)
    }
  }, [socket, status, epoch, signalTyping])

  // Join bertahap room yang tampil; leave yang tak tampil lagi.
  const roomKey = roomIds.join(",")
  useEffect(() => {
    if (!socket || status !== "connected") return
    const api = apiRef.current
    // Reconnect = join sisi server hilang semua — mulai dari nol.
    if (epochRef.current !== epoch) {
      epochRef.current = epoch
      joinedRef.current.clear()
    }
    const wanted = new Set(roomIds)
    const joined = joinedRef.current
    for (const id of Array.from(joined)) {
      if (!wanted.has(id)) {
        joined.delete(id)
        api.leaveRoom(id)
      }
    }
    const toJoin = roomIds.filter((id) => !joined.has(id))
    if (toJoin.length === 0) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let i = 0
    const step = () => {
      if (cancelled) return
      for (const id of toJoin.slice(i, i + TYPING_JOIN_BATCH)) {
        // Tandai dulu agar tidak di-join ganda antar tick.
        joined.add(id)
        void api.joinRoom(id).then((ok) => {
          if (!ok) joined.delete(id)
        })
      }
      i += TYPING_JOIN_BATCH
      if (i < toJoin.length) timer = setTimeout(step, TYPING_JOIN_GAP_MS)
    }
    step()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // roomKey: sengaja string agar effect tidak re-run tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, status, epoch, focusTick, roomKey])

  // Unmount: lepas semua join + matikan timer expiry.
  useEffect(() => {
    const joined = joinedRef.current
    const timers = timersRef.current
    return () => {
      const api = apiRef.current
      for (const id of joined) api.leaveRoom(id)
      joined.clear()
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  return typingRooms
}

/**
 * Batch 43: entri "Pesan untuk diri sendiri" di puncak daftar chat —
 * membuka/membuat self room (POST /v1/chat/self).
 */
function SelfChatEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <PressableScale
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="Pesan untuk diri sendiri"
      className="flex-row items-center gap-3 px-4 py-2.5"
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Icon icon={NotePencil} size={22} tone="active" />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
          Pesan untuk diri sendiri
        </Text>
        {/* FE-087: "Catatan, pengingat, dan draf untuk Anda" = tiga sinonim
            untuk satu fungsi — cukup "Catatan untuk Anda". */}
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {translate("Catatan untuk Anda")}
        </Text>
      </View>
    </PressableScale>
  )
}

/**
 * LR-003 (2026-09-29): satu baris daftar chat sebagai komponen module-level
 * yang di-`memo`.
 *
 * SEBELUMNYA `renderItem` inline di JSX membuat fungsi + SEMUA prop turunan
 * baru tiap render layar: array literal `leftActions`/`rightActions`
 * (dengan `onPress` arrow per baris), objek literal `lastMessage`/`avatar`,
 * dan arrow `onPress`/`onLongPress`/`onSwipeFull`. Akibatnya setiap update
 * kecil (badge unread, status online, indikator mengetik di SATU room)
 * me-render ulang SEMUA baris yang terlihat.
 *
 * Di sini: aksi swipe/avatar/lastMessage dibangun via `useMemo`, handler
 * via `useCallback`, dan `memo` memakai pembanding per-field — baris hanya
 * me-render ulang bila kontennya sendiri berubah.
 */
type ChatRoomRowProps = {
  room: ChatRoom
  pinned: boolean
  typing: boolean
  selecting: boolean
  selected: boolean
  swipeGroup: SwipeableGroup
  onOpenRoom: (room: ChatRoom) => void
  onTogglePin: (room: ChatRoom) => void
  onArchive: (room: ChatRoom) => void
  onDelete: (room: ChatRoom) => void
  onToggleSelect: (id: string) => void
  onEnterSelect: (id: string) => void
  onFullSwipe: (room: ChatRoom, side: SwipeSide) => void
  /**
   * FE-129: diisi hanya untuk baris pertama — View penjangkar coach mark
   * sekali-tampil gesture swipe. Stabil per mount, jadi tidak menjebol memo.
   */
  rowAnchor?: RefObject<RNView | null>
}

/**
 * Literal inline `["left", "right"]` di JSX membuat `confirmFull` baru tiap
 * render → menjebol `memo` di <SwipeableListItem>. Di-hoist ke modul.
 */
const CHAT_ROW_CONFIRM_FULL: SwipeSide[] = ["left", "right"]

function ChatRoomRowBase({
  room: item,
  pinned,
  typing,
  selecting,
  selected,
  swipeGroup,
  onOpenRoom,
  onTogglePin,
  onArchive,
  onDelete,
  onToggleSelect,
  onEnterSelect,
  onFullSwipe,
  rowAnchor,
}: ChatRoomRowProps) {
  const archived = item.isArchived === true

  const handlePress = useCallback(() => onOpenRoom(item), [item, onOpenRoom])
  const handleLongPress = useCallback(() => {
    if (selecting) onToggleSelect(item.id)
    else onEnterSelect(item.id)
  }, [selecting, item.id, onToggleSelect, onEnterSelect])
  const handleSwipeFull = useCallback(
    (side: SwipeSide) => onFullSwipe(item, side),
    [item, onFullSwipe],
  )

  const leftActions = useMemo<SwipeAction[]>(
    () => [
      {
        key: "pin",
        label: pinned ? "Lepas" : "Semat",
        icon: PushPin,
        onPress: () => void onTogglePin(item),
      },
    ],
    [pinned, onTogglePin, item],
  )
  const rightActions = useMemo<SwipeAction[]>(
    () => [
      {
        key: "archive",
        label: archived ? "Buka" : "Arsip",
        icon: Archive,
        onPress: () => void onArchive(item),
      },
      {
        key: "delete",
        label: "Hapus",
        icon: Trash,
        destructive: true,
        onPress: () => onDelete(item),
      },
    ],
    [archived, onArchive, onDelete, item],
  )

  const avatarSource = useMemo(
    () => (item.counterpart?.avatarUrl ? { uri: item.counterpart.avatarUrl } : undefined),
    [item.counterpart?.avatarUrl],
  )
  const lastMessageView = useMemo<ChatRoomLastMessage | undefined>(
    () =>
      item.lastMessage
        ? {
            // UI-C002: pesan terakhir berisi lampiran saja (tanpa teks)
            // menampilkan "(lampiran)", bukan baris kosong.
            text: chatRoomPreview(item.lastMessage, translate("(lampiran)")),
            fromSelf: item.lastMessage.fromUser,
          }
        : undefined,
    [item.lastMessage],
  )

  const row = (
    <SwipeableListItem
      id={item.id}
      group={swipeGroup}
      disabled={selecting}
      leftActions={leftActions}
      rightActions={rightActions}
      // Swipe penuh = aksi primer tiap sisi; hapus (destruktif) TIDAK
      // pernah dieksekusi dari swipe penuh — harus lewat dialog.
      onSwipeFull={handleSwipeFull}
      confirmFull={CHAT_ROW_CONFIRM_FULL}
    >
      <ChatRoomListItem
        name={item.counterpart?.fullName ?? `@${item.counterpart?.username ?? "—"}`}
        avatar={avatarSource}
        // CHT-009: badge seal lawan bicara di daftar.
        sealTier={item.counterpart?.sealTier ?? null}
        // CHT-008: indikator "mengetik…" (server → chat.typing).
        typing={typing}
        online={item.isOnline === true}
        muted={item.isMuted === true}
        pinned={pinned}
        lastMessage={lastMessageView}
        // UI-C001 (revisi 2026-09-28): cap waktu relatif `formatTimeAgo`
        // ("5 menit lalu" / "Kemarin").
        time={item.lastMessage ? formatTimeAgo(item.lastMessage.createdAt) : undefined}
        unreadCount={item.unreadCount}
        // U5-009 (UX-deep 2026-09-29): room ber-orderId ditandai badge
        // kecil "Escrow", bukan kode order mentah (user baru tidak tahu
        // "KHD-…" artinya chat terikat transaksi).
        orderBadge={item.orderId != null}
        selecting={selecting}
        selected={selected}
        onPress={handlePress}
        onLongPress={handleLongPress}
      />
    </SwipeableListItem>
  )
  // FE-129 (audit frontend 2026-09-29): hanya baris pertama (rowAnchor
  // diisi) dibungkus View penjangkar coach mark sekali-tampil gesture
  // swipe (kanan = semat, kiri = arsip/hapus) — baris lain tidak tersentuh.
  return rowAnchor ? (
    <View ref={rowAnchor} collapsable={false}>
      {row}
    </View>
  ) : (
    row
  )
}

/**
 * Pembanding per-field: identitas objek `room` boleh berganti (mis. hasil
 * `patchRoom` / refetch) selama ISI yang tampil sama — baris tidak ikut
 * re-render. Semua yang memengaruhi tampilan tercakup: counterpart
 * (nama/username/avatar/seal), pesan terakhir (id/teks/pengirim/waktu/tipe/
 * lampiran/hapus), unread, orderId, flag arsip/bisu/online, subject
 * (fallback nama di judul navigasi).
 */
function isSameRoomContent(a: ChatRoom, b: ChatRoom): boolean {
  if (a === b) return true
  const ca = a.counterpart
  const cb = b.counterpart
  const sameCounterpart =
    ca === cb ||
    (ca != null &&
      cb != null &&
      ca.id === cb.id &&
      (ca.fullName ?? null) === (cb.fullName ?? null) &&
      (ca.username ?? null) === (cb.username ?? null) &&
      (ca.avatarUrl ?? null) === (cb.avatarUrl ?? null) &&
      (ca.sealTier ?? null) === (cb.sealTier ?? null))
  const la = a.lastMessage
  const lb = b.lastMessage
  const sameLastMessage =
    la === lb ||
    (la != null &&
      lb != null &&
      la.id === lb.id &&
      (la.text ?? null) === (lb.text ?? null) &&
      la.fromUser === lb.fromUser &&
      la.createdAt === lb.createdAt &&
      la.messageType === lb.messageType &&
      (la.attachments?.length ?? 0) === (lb.attachments?.length ?? 0) &&
      !!la.isDeleted === !!lb.isDeleted)
  return (
    sameCounterpart &&
    sameLastMessage &&
    a.unreadCount === b.unreadCount &&
    (a.orderId ?? null) === (b.orderId ?? null) &&
    (a.isArchived ?? false) === (b.isArchived ?? false) &&
    (a.isMuted ?? false) === (b.isMuted ?? false) &&
    (a.isOnline ?? false) === (b.isOnline ?? false) &&
    (a.subject ?? null) === (b.subject ?? null)
  )
}

function areChatRowPropsEqual(prev: ChatRoomRowProps, next: ChatRoomRowProps): boolean {
  return (
    isSameRoomContent(prev.room, next.room) &&
    prev.pinned === next.pinned &&
    prev.typing === next.typing &&
    prev.selecting === next.selecting &&
    prev.selected === next.selected &&
    prev.swipeGroup === next.swipeGroup &&
    prev.onOpenRoom === next.onOpenRoom &&
    prev.onTogglePin === next.onTogglePin &&
    prev.onArchive === next.onArchive &&
    prev.onDelete === next.onDelete &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.onEnterSelect === next.onEnterSelect &&
    prev.onFullSwipe === next.onFullSwipe &&
    prev.rowAnchor === next.rowAnchor
  )
}

const ChatRoomRow = memo(ChatRoomRowBase, areChatRowPropsEqual)

// FE-064: elemen header kiri yang stabil — <DrawerMenuButton> tanpa prop,
// aman dipakai ulang antar render agar memo <Header> bisa bail-out.
const CHAT_HEADER_LEFT = <DrawerMenuButton />

export default function ChatScreen() {
  const toast = useToast()
  const insets = useSafeAreaInsets()
  // FE-129: jangkar coach mark sekali-tampil gesture swipe di baris pertama.
  const firstRowRef = useRef<RNView | null>(null)
  const [filter, setFilter] = useState<ChatFilter>("all")
  const archiveOpen = filter === "archived"
  const mainQuery = usePaginatedQuery<ChatRoom>(
    "chat-rooms",
    (page, signal) => api.chat.listChatRooms({ page, limit: CHAT_PAGE_SIZE }, signal),
    // F-01 (audit): kembali dari ruang chat — unread/lastMessage di daftar
    // disegarkan diam-diam tanpa menunggu poll atau pull-to-refresh.
    // C-08 (audit): percakapan yang baru dibalas harus naik ke atas.
    { refreshOnFocus: true, compare: byTimestampDesc<ChatRoom>((room) => room.updatedAt) },
  )
  // B4 (fix 2026-09-26): daftar terarsip = QUERY TERPISAH ke ?archived=true.
  // Backend menyembunyikan room arsip di query utama secara server-side,
  // jadi memfilter arsip client-side dari satu query membuat arsip "menguap"
  // setiap refetch (refreshOnFocus / pull-to-refresh). Server adalah source
  // of truth keanggotaan tiap tab.
  const archivedQuery = usePaginatedQuery<ChatRoom>(
    "chat-rooms-archived",
    (page, signal) =>
      api.chat.listChatRooms({ page, limit: CHAT_PAGE_SIZE, archived: true }, signal),
    {
      refreshOnFocus: true,
      compare: byTimestampDesc<ChatRoom>((room) => room.updatedAt),
      // Jangan tembak API sebelum tab arsip dibuka — saat `enabled` flip,
      // identitas `load` berubah sehingga effect hook memuat halaman pertama.
      enabled: archiveOpen,
    },
  )

  // ── Item 18: pin per-perangkat — daftar subscribe agar toggle pin
  // memperbarui urutan tanpa refetch. ────────────────────────────────
  const [, setPinVersion] = useState(0)
  useEffect(() => {
    void ensurePinnedLoaded().then(() => setPinVersion((v) => v + 1))
    return subscribePinnedRooms(() => setPinVersion((v) => v + 1))
  }, [])
  const swipeGroup = useSwipeableGroup()

  // ── Mode pilih (aksi massal arsip/bisu, tanpa ActionSheet) ──
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  // Efek scroll: header terangkat (bayangan) saat daftar digulir.
  const { elevated, onScrollWorklet } = useScrollElevation()

  // FE-064: prop `right` header di-memo agar memo <Header> bisa bail-out.
  // Handler stabil — tidak ada state yang berubah per render.
  const headerRight = useMemo(
    () => (
      <IconButton
        icon={GearSix}
        variant="ghost"
        size="md"
        accessibilityLabel="Pengaturan chat"
        onPress={() => router.push(ROUTES.chatSettings)}
      />
    ),
    [],
  )

  // Query aktif mengikuti tab — tiap tab datanya sudah difilter server
  // (utama = non-arsip, arsip = ?archived=true). "Belum dibaca"/"Transaksi"
  // filter client-side di atas halaman yang dimuat (lihat catatan item 17).
  const activeQuery = archiveOpen ? archivedQuery : mainQuery
  const shownRooms = useMemo(() => {
    const base = activeQuery.data
    const filtered =
      filter === "unread"
        ? base.filter((r) => r.unreadCount > 0)
        : filter === "transaction"
          ? base.filter(isTransactionRoom)
          : base
    return sortRoomsPinnedFirst(filtered)
  }, [activeQuery.data, filter])

  // CHT-008: indikator typing di daftar — join bertahap room yang tampil.
  const roomIds = useMemo(() => shownRooms.map((r) => r.id), [shownRooms])
  const typingRooms = useChatListTyping(roomIds)

  // Terapkan hasil arsip/mute ke baris list tanpa memuat ulang seluruhnya.
  // Untuk arsip, ini hanya umpan balik instan — `handleBatchArchive`
  // merekonsiliasi kedua query dengan server setelahnya (keanggotaan tab
  // berubah di server, bukan cuma flag lokal).
  const activeSetData = activeQuery.setData
  const patchRoom = useCallback(
    (id: string, patch: Partial<ChatRoom>) => {
      activeSetData((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    },
    [activeSetData],
  )

  /**
   * Batch 43: buka self-chat ("Pesan untuk diri sendiri") — POST /v1/chat/self
   * bila belum ada. Gagal → toast sopan (bukan layar error).
   */
  const openSelfChat = useCallback(async () => {
    try {
      const room = await getOrCreateSelfRoom()
      router.push(ROUTES.chatRoom(room.id, "Pesan untuk diri sendiri", true))
    } catch (err) {
      toast.show({
        title: "Gagal membuka pesan untuk diri sendiri",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    }
  }, [toast.show])

  /** Hapus baris room dari daftar lokal (umpan balik instan setelah DELETE). */
  const removeRoom = useCallback(
    (id: string) => {
      activeSetData((prev) => prev.filter((r) => r.id !== id))
    },
    [activeSetData],
  )

  const selectedRooms = useMemo(
    () => shownRooms.filter((r) => selected.has(r.id)),
    [shownRooms, selected],
  )
  const selectedCount = selected.size
  /**
   * Arah aksi toggle mengikuti isi pilihan: selama masih ada ruang yang
   * BELUM bisu, satu ketukan membisukan semuanya (niat pengguna memilih
   * beberapa ruang hampir selalu "berhentikan bunyi ini"), sebaliknya
   * mengembalikan suara.
   */
  const anyUnmuted = selectedRooms.some((r) => r.isMuted !== true)

  const exitSelect = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
  }, [])

  const enterSelect = useCallback((id: string) => {
    haptic("select")
    setSelected(new Set([id]))
    setSelecting(true)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < SELECTION_MAX) next.add(id)
      return next
    })
    haptic("select")
  }, [])

  // Ganti filter membatalkan pilihan: id yang dipilih bisa tidak ada lagi di
  // daftar yang sedang tampil.
  useEffect(() => {
    exitSelect()
  }, [filter, exitSelect])

  /**
   * Jalankan satu aksi untuk semua ruang terpilih. `Promise.allSettled` (bukan
   * `all`): satu ruang yang gagal (403/404 karena ruang dihapus lawan bicara)
   * tidak boleh membatalkan pembaruan ruang lain yang sudah berhasil di
   * server. Kegagalan dilaporkan sekali, ringkas.
   */
  const runBatch = useCallback(
    async (
      action: (room: ChatRoom) => Promise<Partial<ChatRoom>>,
      successTitle: string,
      failTitle: string,
    ) => {
      if (selectedRooms.length === 0 || batchBusy) return
      setBatchBusy(true)
      const targets = selectedRooms
      const results = await Promise.allSettled(targets.map((room) => action(room)))
      let ok = 0
      let firstError: unknown
      results.forEach((res, i) => {
        const room = targets[i]!
        if (res.status === "fulfilled") {
          ok += 1
          patchRoom(room.id, res.value)
        } else {
          firstError ??= res.reason
        }
      })
      setBatchBusy(false)
      exitSelect()
      if (ok > 0) {
        haptic("success")
        toast.show({
          title: ok === 1 ? successTitle : `${successTitle} (${ok} percakapan)`,
          tone: "success",
          duration: 2500,
        })
      }
      if (firstError) {
        toast.show({
          title: failTitle,
          description: isApiError(firstError) ? userMessage(firstError) : undefined,
          tone: "danger",
        })
      }
    },
    [batchBusy, exitSelect, patchRoom, selectedRooms, toast.show],
  )

  const handleBatchMute = useCallback(() => {
    const next = anyUnmuted
    return runBatch(
      async (room) => {
        const res = await setRoomMuted(room.id, next)
        return { isMuted: res.isMuted, mutedUntil: res.mutedUntil }
      },
      next ? "Percakapan dibisukan" : "Suara percakapan dikembalikan",
      "Gagal memperbarui bisu percakapan",
    )
  }, [anyUnmuted, runBatch])

  const handleBatchArchive = useCallback(async () => {
    // Di daftar terarsip aksi yang sama berarti "buka arsip" — satu ikon,
    // arah mengikuti ruang yang dipilih (bukan mode tampilan).
    await runBatch(
      async (room) => {
        const res = await setRoomArchived(room.id, !room.isArchived)
        return { isArchived: res.isArchived }
      },
      archiveOpen ? "Pesan dikeluarkan dari arsip" : "Pesan diarsipkan",
      "Gagal memperbarui arsip percakapan",
    )
    // B4: arsip/unarsip memindahkan room antar tab DI SERVER. Patch lokal
    // di atas hanya umpan balik instan — rekonsiliasi kedua query agar
    // daftar selalu mencerminkan server (bukan memori yang bisa basi).
    // refresh() = senyap (baris lama tetap tampil), dan aman dipanggil saat
    // query arsip nonaktif (tidak menembak API).
    mainQuery.refresh()
    archivedQuery.refresh()
  }, [archiveOpen, runBatch, mainQuery, archivedQuery])

  // ── Item 18: swipe per-baris ─────────────────────────────────────────
  const handleTogglePin = useCallback(
    async (room: ChatRoom) => {
      // Batch 43: pin kini backend-backed (toggleRoomPinned → API) — gagal
      // (mis. batas pin server) wajib toast error, bukan crash diam.
      try {
        const pinned = await toggleRoomPinned(room.id)
        haptic("select")
        toast.show({
          title: pinned ? "Percakapan disematkan" : "Semat percakapan dilepas",
          tone: "neutral",
          duration: 2000,
        })
      } catch (err) {
        toast.show({
          title: "Gagal mengubah sematan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [toast.show],
  )

  const handleSingleArchive = useCallback(
    async (room: ChatRoom) => {
      const unarchive = room.isArchived === true
      try {
        const res = await setRoomArchived(room.id, !unarchive)
        patchRoom(room.id, { isArchived: res.isArchived })
        haptic("success")
        toast.show({
          title: unarchive ? "Pesan dikeluarkan dari arsip" : "Pesan diarsipkan",
          tone: "neutral",
          duration: 2000,
        })
        mainQuery.refresh()
        archivedQuery.refresh()
      } catch (err: unknown) {
        toast.show({
          title: "Gagal memperbarui arsip percakapan",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [patchRoom, toast.show, mainQuery, archivedQuery],
  )

  // ── Item 18: hapus — dialog konfirmasi + gate aturan backend ─────────
  /** Room yang menunggu konfirmasi hapus (null = dialog tutup). */
  const [deleteRoom, setDeleteRoom] = useState<ChatRoom | null>(null)
  /** Pesan "belum boleh" bila aturan hapus tidak terpenuhi. */
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState<string | null>(null)
  const [deleteChecking, setDeleteChecking] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const closeDelete = useCallback(() => {
    setDeleteRoom(null)
    setDeleteBlockedMessage(null)
  }, [])

  const requestDelete = useCallback(
    (room: ChatRoom) => {
      // Room DM (tanpa orderId) bebas dihapus pemiliknya — langsung konfirmasi.
      if (!room.orderId) {
        setDeleteBlockedMessage(null)
        setDeleteRoom(room)
        return
      }
      // Room transaksi: PATUHI aturan backend — hanya bila order COMPLETED.
      // Status dicek dari API existing (getOrder), bukan dari tebakan.
      setDeleteChecking(true)
      api.orders
        .getOrder(room.orderId)
        .then((order) => {
          if (canDeleteChatRoom(order.status)) {
            setDeleteBlockedMessage(null)
            setDeleteRoom(room)
          } else {
            const label =
              ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ??
              order.status
            setDeleteBlockedMessage(
              `Chat transaksi hanya bisa dihapus setelah pesanan selesai. Status pesanan ini: ${label}.`,
            )
            setDeleteRoom(room)
          }
        })
        .catch(() => {
          setDeleteBlockedMessage(
            "Status pesanan tidak bisa diperiksa saat ini. Coba lagi nanti.",
          )
          setDeleteRoom(room)
        })
        .finally(() => setDeleteChecking(false))
    },
    [],
  )

  const confirmDelete = useCallback(async () => {
    if (!deleteRoom || deleteBusy) return
    const roomId = deleteRoom.id
    setDeleteBusy(true)
    try {
      // Kontrak TIM B: DELETE /v1/chat/rooms/:roomId → { deleted, roomId,
      // permanent }. permanent=true = DM hard delete; permanent=false = room
      // order COMPLETED soft delete (riwayat dipertahankan untuk audit).
      // Efek di UI sama: room hilang dari daftar.
      await deleteChatRoom(roomId)
      // Umpan balik instan + rekonsiliasi kedua query dengan server (seperti arsip).
      removeRoom(roomId)
      haptic("success")
      toast.show({ title: translate("Pesan dihapus"), tone: "neutral" })
      closeDelete()
      mainQuery.refresh()
      archivedQuery.refresh()
    } catch (err: unknown) {
      const backendCode = isApiError(err) ? err.backendCode : undefined
      const status = isApiError(err) ? err.status : undefined
      if (backendCode === "NOT_FOUND" || status === 404) {
        // Room sudah tidak ada di server — selaraskan daftar lokal.
        removeRoom(roomId)
        closeDelete()
        mainQuery.refresh()
        archivedQuery.refresh()
        toast.show({
          title: translate("Percakapan sudah tidak ada"),
          description: translate("Kemungkinan sudah dihapus sebelumnya."),
          tone: "neutral",
        })
      } else if (
        backendCode === "CHAT_ROOM_DELETE_ORDER_NOT_COMPLETED" ||
        status === 409
      ) {
        // Fail closed server: order belum COMPLETED (termasuk CANCELLED /
        // DISPUTED) — atau status berubah setelah pengecekan getOrder.
        // Tampilkan sebagai pesan jelas di dialog (pola yang sama dengan
        // gate pra-konfirmasi di requestDelete).
        setDeleteBlockedMessage(
          translate("Chat transaksi hanya bisa dihapus setelah pesanan selesai (COMPLETED)."),
        )
      } else if (backendCode === "NOT_ORDER_PARTICIPANT" || status === 403) {
        toast.show({
          title: translate("Tidak bisa menghapus"),
          description: translate("Anda bukan anggota percakapan ini."),
          tone: "danger",
        })
        closeDelete()
      } else {
        toast.show({
          title: translate("Gagal menghapus percakapan"),
          description: userMessage(err),
          tone: "danger",
        })
      }
    } finally {
      setDeleteBusy(false)
    }
  }, [deleteRoom, deleteBusy, closeDelete, toast.show, removeRoom, mainQuery, archivedQuery])

  const fullSwipeAction = useCallback(
    (room: ChatRoom, side: SwipeSide) => {
      if (side === "left") void handleTogglePin(room)
      else void handleSingleArchive(room)
    },
    [handleTogglePin, handleSingleArchive],
  )

  /**
   * LR-003: pembuka room stabil untuk baris memo — logika identik dengan
   * `onPress` inline sebelumnya (mode pilih = toggle; biasa = navigasi).
   * Nama room dikirim via param (C-06): layar ruang hanya mencari judul di
   * 30 ruang pertama.
   */
  const openRoom = useCallback(
    (room: ChatRoom) => {
      if (selecting) {
        toggleSelect(room.id)
        return
      }
      // PERF-FIX (network P1): titipkan objek room dari daftar ke cache
      // consume-once — layar room memakai ini untuk header dan melewatkan
      // `GET /v1/chat/rooms/:roomId` (lihat lib/chat-room-prefetch.ts).
      seedChatRoomPrefetch(room)
      router.push(
        ROUTES.chatRoom(
          room.id,
          room.counterpart?.fullName ??
            (room.counterpart?.username
              ? `@${room.counterpart.username}`
              : (room.subject ?? undefined)),
        ),
      )
    },
    [selecting, toggleSelect],
  )

  /**
   * LR-003: `renderItem` via `useCallback` — SEBELUMNYA inline di JSX
   * sehingga tiap render layar membuat fungsi baru + semua prop turunan
   * inline (array aksi swipe, objek lastMessage/avatar, arrow handler).
   * Barisnya sendiri (<ChatRoomRow>, module-level, di-memo) hanya
   * me-render ulang bila kontennya berubah.
   */
  const renderChatRoomItem = useCallback(
    ({ item, index }: { item: ChatRoom; index: number }) => (
      <ChatRoomRow
        room={item}
        pinned={isRoomPinned(item.id)}
        typing={typingRooms.has(item.id)}
        selecting={selecting}
        selected={selected.has(item.id)}
        swipeGroup={swipeGroup}
        // FE-129: baris pertama menjadi jangkar coach mark gesture swipe.
        rowAnchor={index === 0 ? firstRowRef : undefined}
        onOpenRoom={openRoom}
        onTogglePin={handleTogglePin}
        onArchive={handleSingleArchive}
        onDelete={requestDelete}
        onToggleSelect={toggleSelect}
        onEnterSelect={enterSelect}
        onFullSwipe={fullSwipeAction}
      />
    ),
    [
      typingRooms,
      selecting,
      selected,
      swipeGroup,
      openRoom,
      handleTogglePin,
      handleSingleArchive,
      requestDelete,
      toggleSelect,
      enterSelect,
      fullSwipeAction,
    ],
  )

  /**
   * R1-005 (2026-09-29, audit render-perf): elemen header/empty/loading
   * distabilkan — identitas baru tiap render membatalkan `useMemo` di dalam
   * <PaginatedList> dan memaksa VirtualizedList render ulang kontainer.
   */
  const chatListHeader = useMemo(
    () => (filter === "all" ? <SelfChatEntry onOpen={() => void openSelfChat()} /> : undefined),
    [filter, openSelfChat],
  )
  const chatListLoading = useMemo(
    () => (
      <SkeletonGroup>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <ChatSkeletonRow key={index} />
        ))}
      </SkeletonGroup>
    ),
    [],
  )
  const chatListEmpty = useMemo(
    // FE-088: description yang mengulang judul dihapus — empty state =
    // judul + CTA (§9 aturan 7).
    () =>
      archiveOpen ? (
        <EmptyState
          icon={Archive}
          title="Belum ada percakapan terarsip"
        />
      ) : filter === "unread" ? (
        <EmptyState
          icon={Chats}
          title="Tidak ada yang belum dibaca"
        />
      ) : filter === "transaction" ? (
        <EmptyState
          icon={Chats}
          title="Belum ada pesan transaksi"
        />
      ) : (
        <EmptyState
          icon={Chats}
          title="Belum ada percakapan"
          // UI-C004: empty state wajib punya jalan keluar yang bisa
          // diketuk — chat selalu bermula dari sebuah transaksi.
          action={
            <Button fullWidth={false} onPress={() => router.push(ROUTES.transactions)}>
              Lihat transaksi
            </Button>
          }
        />
      ),
    [archiveOpen, filter],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      {selecting ? (
        <Header
          // Jumlah dipilih lewat translate(): template literal di atribut JSX
          // tidak terbaca generator katalog i18n (hanya children JSX, properti
          // objek, dan argumen translate()), jadi copy dinamis harus dibungkus.
          title={selectedCount > 0 ? translate(`${selectedCount} dipilih`) : "Pilih percakapan"}
          titleAlign="left"
          showBack={false}
          separator={false}
          elevated={elevated}
          left={
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              ripple
              accessibilityLabel="Batal memilih"
              onPress={exitSelect}
            />
          }
          right={
            <>
              <IconButton
                icon={anyUnmuted ? BellSlash : BellZ}
                size="sm"
                variant="ghost"
                ripple
                disabled={selectedCount === 0 || batchBusy}
                accessibilityLabel={
                  anyUnmuted ? "Bisukan percakapan terpilih" : "Kembalikan suara percakapan terpilih"
                }
                onPress={() => void handleBatchMute()}
              />
              <IconButton
                icon={Archive}
                size="sm"
                variant="ghost"
                ripple
                disabled={selectedCount === 0 || batchBusy}
                accessibilityLabel={
                  archiveOpen
                    ? "Keluarkan percakapan terpilih dari arsip"
                    : "Arsipkan percakapan terpilih"
                }
                onPress={() => void handleBatchArchive()}
              />
            </>
          }
        />
      ) : (
        <Header
          // Chat = slot navbar (bukan push dari layar lain): tidak ada Back.
          // Satu-satunya keluar adalah slot navbar di bawah — pola yang sama
          // dengan tab Transaksi/Dompet.
          showBack={false}
          separator={false}
          elevated={elevated}
          titleAlign="left"
          titleVariant="h2"
          title={archiveOpen ? "Diarsipkan" : "Pesan"}
          // T5-002 (audit UI/UX intuitif 2026-09-29): drawer bisa dibuka dari
          // semua tab, bukan cuma Etalase.
          left={CHAT_HEADER_LEFT}
          // Batch 43: pintu masuk pengaturan privasi/template balasan.
          right={headerRight}
        />
      )}
      {!selecting ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4 pb-2"
          accessibilityRole="tablist"
        >
          <ChipGroup
            single
            options={FILTER_OPTIONS.map((o) => ({ ...o, label: translate(o.label) }))}
            value={[filter]}
            onChange={(next) => {
              const picked = next[0]
              if (picked) setFilter(picked)
            }}
          />
        </ScrollView>
      ) : null}
      <ModeShiftFade>
      <PaginatedList
        {...activeQuery}
        onScrollWorklet={onScrollWorklet}
        // Batch 43: entri "Pesan untuk diri sendiri" di puncak daftar (hanya
        // tab Semua; arsip/filter lain tidak menampilkan self-chat).
        header={chatListHeader}
        // ChatRoomListItem memasang px-4 sendiri. `padded` default menambah
        // paddingHorizontal 20px lagi di contentContainer -> baris menjorok
        // dan tidak sejajar Header di atasnya. Sama seperti app/notifications.tsx.
        padded={false}
        data={shownRooms}
        onRefresh={activeQuery.refresh}
        onRetry={activeQuery.reload}
        onLoadMore={activeQuery.loadMore}
        // Baris chat punya padding vertikal sendiri; gap antar baris 0 menjaga
        // irama rapat ala aplikasi pesan (satu layar memuat lebih banyak ruang).
        gap={0}
        loadingPlaceholder={chatListLoading}
        bottomPadding={insets.bottom + TAB_BAR_HEIGHT + tokens.space[4]}
        empty={chatListEmpty}
        renderItem={renderChatRoomItem}
      />
      {/*
       * FE-129 (audit frontend 2026-09-29): coach mark SEKALI-tampil untuk
       * gesture swipe (kanan = semat, kiri = arsip/hapus) — satu-satunya
       * petunjuk discoverability di UI. Jangkar = baris pertama; bila daftar
       * kosong, target tak terukur dan flag tidak ditandai (kesempatan tampil
       * tidak hilang).
       */}
      <CoachMark
        id="chat-swipe"
        targetRef={firstRowRef}
        message={translate("Geser baris ke kanan untuk menyemat, ke kiri untuk mengarsip atau menghapus")}
        delayMs={900}
      />
      </ModeShiftFade>

      {/* Item 18: hapus 1-by-1 — dialog konfirmasi, atau pesan jelas bila
          aturan backend melarang (room transaksi, order belum COMPLETED). */}
      <Dialog
        title={translate("Hapus percakapan?")}
        description={
          deleteBlockedMessage
            ? deleteBlockedMessage
            : translate("Percakapan ini akan dihapus dari daftar Anda. Tindakan ini tidak dapat dibatalkan.")
        }
        visible={deleteRoom !== null}
        destructive={!deleteBlockedMessage}
        hideCancel={deleteBlockedMessage !== null}
        confirmLabel={deleteBlockedMessage ? translate("Mengerti") : translate("Hapus")}
        cancelLabel={translate("Batal")}
        loading={deleteBusy}
        onConfirm={() => {
          if (deleteBlockedMessage) closeDelete()
          else void confirmDelete()
        }}
        onCancel={closeDelete}
        onRequestClose={closeDelete}
      />
      {/* Status pemeriksaan aturan hapus (dialog diganti sementara). */}
      {deleteChecking ? (
        <Dialog
          title={translate("Memeriksa status pesanan…")}
          description={translate("Aturan: chat transaksi hanya bisa dihapus setelah pesanan selesai.")}
          visible
          hideCancel
          confirmLabel={translate("Tunggu")}
          confirmButtonProps={{ disabled: true, loading: true }}
          onConfirm={() => undefined}
          onRequestClose={() => undefined}
        />
      ) : null}
    </Screen>
  )
}
