import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Ruang Chat (GET /v1/chat/rooms). List ChatRoomListItem.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Chats } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { ChatRoom } from "@/lib/api/chat"
import { formatDateTime, truncateMiddle } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { ChatRoomListItem } from "@/components/ui/chat-room-list-item"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"


export default function ChatScreen() {
  const insets = useSafeAreaInsets()

  const [items, setItems] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.chat.listChatRooms()
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat ruang chat.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRooms()
  }, [fetchRooms])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRooms()
    setRefreshing(false)
  }, [fetchRooms])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Chat" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchRooms()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Chats}
            title="Belum ada percakapan"
            description="Mulai chat dengan lawan transaksi Anda."
          />
        ) : (
          <View className="gap-1" style={{ paddingTop: tokens.space[3] }}>
            {items.map((room, i) => (
              <ChatRoomListItem
                key={room.id}
                name={room.counterpart?.fullName ?? `@${room.counterpart?.username ?? "—"}`}
                avatar={
                  room.counterpart?.avatarUrl ? { uri: room.counterpart.avatarUrl } : undefined
                }
                lastMessage={
                  room.lastMessage
                    ? {
                        text: room.lastMessage.text ?? "",
                        fromSelf: room.lastMessage.fromUser,
                      }
                    : undefined
                }
                time={room.lastMessage ? formatDateTime(room.lastMessage.createdAt) : undefined}
                unreadCount={room.unreadCount}
                context={room.orderId ? `Order ${truncateMiddle(room.orderId)}` : undefined}
                onPress={() => router.push(ROUTES.chatRoom(room.id))}
                divider={i < items.length - 1}
              />
            ))}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
