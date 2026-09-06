/**
 * Screen — Ruang Chat (GET /v1/chat/rooms). List ChatRoomListItem.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Chats } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { CHAT_PAGE_SIZE, type ChatRoom } from "@/lib/api/chat"
import { formatDateTime, truncateMiddle } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { ChatRoomListItem } from "@/components/ui/chat-room-list-item"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const query = usePaginatedQuery<ChatRoom>("chat-rooms", (page, signal) =>
    api.chat.listChatRooms({ page, limit: CHAT_PAGE_SIZE }, signal),
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Chat" />
      <PaginatedList
        {...query}
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
            divider={index < query.data.length - 1}
          />
        )}
      />
    </Screen>
  )
}