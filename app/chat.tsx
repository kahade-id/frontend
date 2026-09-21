/**
 * Screen — Ruang Chat (GET /v1/chat/rooms). List ChatRoomListItem.
 *
 * v2 (2026-09):
 *   - Header: icon BACK di kiri (konsisten dengan layar stack lain, sejajar
 *     foto profil baris list) dan icon ARSIP di kanan untuk membuka/menutup
 *     "Daftar terarsip" — pintu masuk tetap ada walau room terarsip tidak
 *     pernah boleh lenyap diam-diam.
 *   - Daftar TANPA separator antar baris: irama dibentuk dari spasi &
 *     typography (list pesan rapat), garis batas hanya diberikan pada baris
 *     PERTAMA sebagai bingkai dari header.
 *
 * Fitur lanjutan (spec backend chat):
 *   - Dot online dari `isOnline`/`lastSeenAt` + ikon bel-slash untuk `isMuted`.
 *   - Tekan lama room → ActionSheet: Arsip/Buka arsip (PUT /archive) dan
 *     Bisukan/Bukakan bisu (PUT /mute, opsi 1 jam via durationHours).
 *   - Ruang terarsip ditampilkan di "Daftar terarsip" (bukan disembunyikan).
 */
import { useState } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Archive, BellSlash, BellZ, Chats } from "phosphor-react-native"
import { router } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import {
  CHAT_PAGE_SIZE,
  setRoomArchived,
  setRoomMuted,
  type ChatRoom,
} from "@/lib/api/chat"
import { formatDateTime, truncateMiddle } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { ActionSheet } from "@/components/ui/action-sheet"
import { ChatRoomListItem } from "@/components/ui/chat-room-list-item"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const query = usePaginatedQuery<ChatRoom>(
    "chat-rooms",
    (page, signal) => api.chat.listChatRooms({ page, limit: CHAT_PAGE_SIZE }, signal),
    // F-01 (audit): kembali dari ruang chat — unread/lastMessage di daftar
    // disegarkan diam-diam tanpa menunggu poll atau pull-to-refresh.
    { refreshOnFocus: true },
  )
  const [roomMenu, setRoomMenu] = useState<ChatRoom | null>(null)
  const [roomBusy, setRoomBusy] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Terapkan hasil arsip/mute ke baris list tanpa memuat ulang seluruhnya.
  const patchRoom = (id: string, patch: Partial<ChatRoom>) => {
    query.setData((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const runRoomAction = async (action: () => Promise<unknown>, onDone?: () => void) => {
    if (!roomMenu) return
    setRoomBusy(true)
    try {
      await action()
      onDone?.()
    } catch (err) {
      toast.show({
        title: "Gagal memperbarui percakapan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setRoomBusy(false)
      setRoomMenu(null)
    }
  }

  const archivedRooms = query.data.filter((r) => r.isArchived)
  const visibleRooms = query.data.filter((r) => !r.isArchived)
  const shownRooms = archiveOpen ? archivedRooms : visibleRooms

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title={archiveOpen ? "Diarsipkan" : "Chat"}
        right={
          <IconButton
            icon={Archive}
            size="md"
            variant="ghost"
            active={archiveOpen}
            accessibilityLabel={archiveOpen ? "Tutup daftar terarsip" : "Buka daftar terarsip"}
            onPress={() => setArchiveOpen((v) => !v)}
          />
        }
      />
      <PaginatedList
        {...query}
        // ChatRoomListItem memasang px-5 sendiri (dan inset divider-nya
        // dihitung dari 20px itu). `padded` default menambah paddingHorizontal
        // 20px lagi di contentContainer -> baris menjorok 40px, tidak sejajar
        // Header di atasnya. Sama seperti app/notifications.tsx.
        padded={false}
        data={shownRooms}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={tokens.space[1]}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={
          archiveOpen ? (
            <EmptyState
              icon={Archive}
              title="Belum ada percakapan terarsip"
              description="Percakapan yang Anda arsipkan akan tersimpan di sini."
            />
          ) : (
            <EmptyState
              icon={Chats}
              title="Belum ada percakapan"
              description="Mulai chat dengan lawan transaksi Anda."
            />
          )
        }
        renderItem={({ item, index }) => (
          <ChatRoomListItem
            name={item.counterpart?.fullName ?? `@${item.counterpart?.username ?? "—"}`}
            avatar={item.counterpart?.avatarUrl ? { uri: item.counterpart.avatarUrl } : undefined}
            online={item.isOnline === true}
            muted={item.isMuted === true}
            lastMessage={
              item.lastMessage
                ? {
                    text: item.lastMessage.text ?? "",
                    fromSelf: item.lastMessage.fromUser,
                  }
                : undefined
            }
            time={item.lastMessage ? formatDateTime(item.lastMessage.createdAt) : undefined}
            unreadCount={item.unreadCount}
            context={item.orderId ? `Pesanan ${truncateMiddle(item.orderId)}` : undefined}
            onPress={() =>
              router.push(
                ROUTES.chatRoom(
                  item.id,
                  // C-06 (audit): layar ruang hanya mencari judul di 30 ruang
                  // pertama — nama dikirim lewat param agar ruang ke-31+ tidak
                  // jatuh ke "Percakapan".
                  item.counterpart?.fullName ??
                    (item.counterpart?.username ? `@${item.counterpart.username}` : item.subject ?? undefined),
                ),
              )
            }
            onLongPress={() => setRoomMenu(item)}
            dividerTop={index === 0}
          />
        )}
      />

      <ActionSheet
        visible={roomMenu != null}
        onRequestClose={() => setRoomMenu(null)}
        title={roomMenu?.counterpart?.fullName ?? "Percakapan"}
        actions={[
          {
            key: "mute",
            label: roomMenu?.isMuted ? "Bukakan suara" : "Bisukan",
            disabled: roomBusy,
            icon: roomMenu?.isMuted ? BellZ : BellSlash,
            onPress: () =>
              void runRoomAction(
                async () => {
                  if (!roomMenu) return
                  const next = !roomMenu.isMuted
                  const res = await setRoomMuted(roomMenu.id, next)
                  patchRoom(roomMenu.id, { isMuted: res.isMuted, mutedUntil: res.mutedUntil })
                },
              ),
          },
          {
            key: "mute1h",
            label: "Bisukan 1 jam",
            icon: BellSlash,
            disabled: roomBusy || roomMenu?.isMuted === true,
            onPress: () =>
              void runRoomAction(
                async () => {
                  if (!roomMenu) return
                  const res = await setRoomMuted(roomMenu.id, true, 1)
                  patchRoom(roomMenu.id, { isMuted: res.isMuted, mutedUntil: res.mutedUntil })
                },
              ),
          },
          {
            key: "archive",
            label: roomMenu?.isArchived ? "Buka arsip" : "Arsipkan",
            disabled: roomBusy,
            icon: Archive,
            onPress: () =>
              void runRoomAction(
                async () => {
                  if (!roomMenu) return
                  const res = await setRoomArchived(roomMenu.id, !roomMenu.isArchived)
                  patchRoom(roomMenu.id, { isArchived: res.isArchived })
                },
              ),
          },
        ]}
      />
    </Screen>
  )
}
