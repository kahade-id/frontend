/**
 * Kahade — <MessagesSection>: daftar gelembung chat sederhana dengan
 * status kosong (dipakai detail sengketa; diekstrak R2 #95).
 */
import { formatDateTime } from "@/lib/format"

import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export type MessageRow = {
  id: string
  fromUser: boolean
  text: string
  createdAt: string
}

export function DisputeMessagesSection({ messages }: { messages: MessageRow[] }) {
  return (
    <>
      <SectionHeader title="Pesan" />
      {messages.length === 0 ? (
        <Text variant="body" tone="secondary">
          Belum ada pesan. Tulis di kolom bawah untuk mediator dan lawan transaksi.
        </Text>
      ) : (
        messages.map((m, i) => (
          <ChatMessageBubble
            key={m.id}
            direction={m.fromUser ? "outgoing" : "incoming"}
            text={m.text}
            time={formatDateTime(m.createdAt)}
            grouped={messages[i - 1]?.fromUser === m.fromUser}
          />
        ))
      )}
    </>
  )
}
