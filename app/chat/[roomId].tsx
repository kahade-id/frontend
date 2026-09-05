/**
 * Screen — Ruang Chat Detail (GET messages, POST send, POST read).
 * Composer + bubbles; render lampiran sebagai placeholder teks.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Chats } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { ChatMessage } from "@/lib/api/chat"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { ChatComposer } from "@/components/ui/chat-composer"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)

  const fetchMessages = useCallback(async () => {
    if (!roomId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.chat.getChatMessages(roomId)
      setMessages(res ?? [])
      await api.chat.markChatRoomRead(roomId).catch(() => undefined)
    } catch {
      setError("Gagal memuat pesan.")
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    void fetchMessages()
  }, [fetchMessages])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchMessages()
    setRefreshing(false)
  }, [fetchMessages])

  const handleSend = useCallback(
    async (payload: { content: string; attachments: unknown[]; replyToId?: string }) => {
      if (!roomId || !payload.content.trim()) return
      setSending(true)
      try {
        const msg = await api.chat.sendChatMessage(roomId, {
          messageType: "TEXT",
          content: payload.content.trim(),
        })
        setMessages((prev) => [...prev, msg])
        setDraft("")
      } catch {
        toast.show({ title: "Gagal mengirim pesan", tone: "danger" })
      } finally {
        setSending(false)
      }
    },
    [roomId, toast.show],
  )

  return (
    <Screen
      edges={["top"]}
      padded={false}
      footer={
        <View className="px-6 pb-4">
          <ChatComposer
            value={draft}
            onChangeText={setDraft}
            onSend={(p) => void handleSend(p)}
            sending={sending}
            disabled={loading}
          />
        </View>
      }
    >
      <Header title="Percakapan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Chats} title="Memuat percakapan…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchMessages()} />
        ) : messages.length === 0 ? (
          <EmptyState icon={Chats} title="Belum ada pesan" description="Mulai percakapan Anda." />
        ) : (
          <View className="gap-1" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Pesan" />
            {messages.map((m, i) => (
              <ChatMessageBubble
                key={m.id}
                direction={m.fromUser ? "outgoing" : "incoming"}
                text={m.text ?? (m.messageType === "FILE" ? "📎 Lampiran" : "")}
                time={formatDateTime(m.createdAt)}
                grouped={messages[i - 1]?.fromUser === m.fromUser}
              />
            ))}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
