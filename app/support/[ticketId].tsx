import { Text } from "@/components/ui/text"
import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Detail Tiket Dukungan (GET /v1/support/tickets/{id} + reply).
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import type { SupportMessage, SupportTicket } from "@/lib/api/support"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

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

  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect: request dibatalkan saat
   * layar di-unmount, `refreshing` terpisah dari `loading` (tarik-untuk-
   * menyegarkan tidak lagi mengosongkan percakapan), dan error lewat
   * `userMessage(err)`. `messages` diturunkan dari tiket — sebelumnya ia state
   * terpisah yang hanya pernah diisi dari respons yang sama.
   */
  const query = useApiQuery<SupportTicket>(
    `support-ticket:${ticketId}`,
    (signal) => api.support.getSupportTicket(ticketId, signal),
    Boolean(ticketId),
  )
  const ticket = query.data
  const messages: SupportMessage[] = ticket?.messages ?? []

  const handleSend = useCallback(async () => {
    if (!ticketId || !reply.trim()) return
    setSending(true)
    try {
      await api.support.replySupportTicket(ticketId, reply.trim())
      setReply("")
      await query.reload()
      toast.show({ title: "Balasan terkirim", tone: "success", duration: 2500 })
    } catch (err: unknown) {
      toast.show({ title: "Gagal mengirim balasan", description: userMessage(err), tone: "danger" })
    } finally {
      setSending(false)
    }
  }, [ticketId, reply, toast.show, query])

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Tiket" />
      <PullToRefresh
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={query.loading} skeleton={<DetailLoading />}>
          {query.error ? (
          <ErrorState
            title="Gagal memuat"
            description={query.error}
            onRetry={() => void query.reload()}
          />
        ) : ticket ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
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
            <Button loading={sending} disabled={!reply.trim()} onPress={() => void handleSend()}>
              Kirim balasan
            </Button>
            </View>
          ) : null}
        </Crossfade>
      </PullToRefresh>
    </Screen>
  )
}