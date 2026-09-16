/**
 * Screen — Ruang Chat (GET /v1/chat/rooms). List ChatRoomListItem.
 *
 * Fitur lanjutan (spec backend chat):
 *   - Dot online dari `isOnline`/`lastSeenAt` (sudah disertakan GET /rooms)
 *     + ikon bel-slash untuk `isMuted`.
 *   - Tekan lama room → ActionSheet: Arsip/Buka arsip (PUT /archive) dan
 *     Bisukan/Bukakan bisu (PUT /mute, opsi 1 jam via durationHours).
 *   - Room terarsip disembunyikan dari daftar utama (belum ada folder Arsip
 *     — follow-up); statusnya bisa diubah lewat menu tekan lama setelah
 *     dibuka ulang.
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
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { useToast } from "@/components/ui/toast"

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const query = usePaginatedQuery<ChatRoom>("chat-rooms", (page, signal) =>
    api.chat.listChatRooms({ page, limit: CHAT_PAGE_SIZE }, signal),
  )
  const [roomMenu, setRoomMenu] = useState<ChatRoom | null>(null)
  const [roomBusy, setRoomBusy] = useState(false)

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

  const visibleRooms = query.data.filter((r) => !r.isArchived)

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Chat" />
      <PaginatedList
        {...query}
        data={visibleRooms}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={0}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={
          <EmptyState
            icon={Chats}
            title="Belum ada percakapan"
            description="Mulai chat dengan lawan transaksi Anda."
          />
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
            onPress={() => router.push(ROUTES.chatRoom(item.id))}
            onLongPress={() => setRoomMenu(item)}
            divider={index < visibleRooms.length - 1}
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