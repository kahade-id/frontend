import { Text } from "@/components/ui/text"
import { DetailLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Detail Tiket Dukungan (GET /v1/support/tickets/{id} + reply).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import type { SupportMessage, SupportTicket } from "@/lib/api/support"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SupportTicketCard } from "@/components/ui/support-ticket-card"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

export default function SupportTicketDetailScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [reply, setReply] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.support.getSupportTicket(ticketId)
      setTicket(res)
      setMessages(res?.messages ?? [])
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    void fetchTicket()
  }, [fetchTicket])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTicket()
    setRefreshing(false)
  }, [fetchTicket])

  const handleSend = useCallback(async () => {
    if (!ticketId || !reply.trim()) return
    setSending(true)
    try {
      await api.support.replySupportTicket(ticketId, reply.trim())
      setReply("")
      await fetchTicket()
      toast.show({ title: "Balasan terkirim", tone: "success", duration: 2500 })
    } catch (err: unknown) {
      toast.show({ title: "Gagal mengirim balasan", description: userMessage(err), tone: "danger" })
    } finally {
      setSending(false)
    }
  }, [ticketId, reply, toast.show, fetchTicket])

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Tiket" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <DetailLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchTicket()} />
        ) : ticket ? (
          <View accessible={false} className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SupportTicketCard
              ticketNumber={ticket.ticketNumber}
              subject={ticket.subject}
              status={ticket.status}
              category={ticket.category}
              updatedAt={ticket.updatedAt ? formatDateTime(ticket.updatedAt) : undefined}
            />

            <SectionHeader title="Percakapan" />
            {!messages.length ? (
              <Text variant="body" tone="secondary">
                Belum ada pesan.
              </Text>
            ) : null}
            {messages.map((m, i) => (
              <ChatMessageBubble
                key={m.id}
                direction={m.fromUser ? "outgoing" : "incoming"}
                text={m.text}
                time={formatDateTime(m.createdAt)}
                grouped={messages[i - 1]?.fromUser === m.fromUser}
              />
            ))}

            <SectionHeader title="Balas" />
            <TextArea
              value={reply}
              onChangeText={setReply}
              placeholder="Tulis balasan Anda"
              maxLength={2000}
              numberOfLines={4}
            />
            <Button accessibilityHint="Ketuk untuk berinteraksi" loading={sending} disabled={!reply.trim()} onPress={() => void handleSend()}>
              Kirim Balasan
            </Button>
          </View>
        ) : null}
      </PullToRefresh>
    </Screen>
  )
}