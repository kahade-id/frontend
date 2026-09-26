/**
 * Kahade — <MessagesSection>: daftar gelembung chat sederhana dengan
 * status kosong (dipakai detail sengketa; diekstrak R2 #95).
 *
 * DP-006 (audit 2026-09-26): pesan khusus-lampiran dirender sebagai bubble
 * lampiran (ikon + nama file + ukuran + tipe). Backend TIDAK menyertakan
 * signed URL pada attachments pesan — unduhan adalah follow-up (butuh
 * endpoint signed-URL baru); di sini hanya metadata yang ditampilkan.
 */
import { View } from "react-native"
import { FileText } from "phosphor-react-native"

import { formatDateTime, formatFileSize } from "@/lib/format"
import type { DisputeMessageAttachment } from "@/lib/api/disputes"

import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { IconBox } from "@/components/ui/icon-box"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export type MessageRow = {
  id: string
  fromUser: boolean
  text: string
  createdAt: string
  attachments?: DisputeMessageAttachment[]
}

function MessageAttachments({ attachments }: { attachments: DisputeMessageAttachment[] }) {
  return (
    <View className="gap-2">
      {attachments.map((a, i) => (
        <View
          key={`${a.fileKey || a.fileName}-${i}`}
          className="flex-row items-center gap-2"
          accessibilityLabel={`Lampiran: ${a.fileName}`}
        >
          <IconBox icon={FileText} size="sm" />
          <View className="flex-1">
            <Text variant="body" numberOfLines={1}>
              {a.fileName}
            </Text>
            <Text variant="caption" tone="secondary">
              {[a.fileType, typeof a.fileSize === "number" ? formatFileSize(a.fileSize) : null]
                .filter(Boolean)
                .join(" · ") || "Lampiran"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

export function DisputeMessagesSection({
  messages,
  sending,
}: {
  messages: MessageRow[]
  /** SEC-DSP-FE-04: tampilkan "Mengirim" pada pesan sendiri yang sedang dikirim. */
  sending?: boolean
}) {
  const lastOutgoingIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].fromUser) return i
    }
    return -1
  })()
  return (
    <>
      <SectionHeader title="Pesan" />
      {messages.length === 0 ? (
        <Text variant="body" tone="secondary">
          Belum ada pesan. Tulis di kolom bawah untuk mediator dan lawan transaksi.
        </Text>
      ) : (
        messages.map((m, i) => {
          const attachments = m.attachments ?? []
          return (
            <ChatMessageBubble
              key={m.id}
              direction={m.fromUser ? "outgoing" : "incoming"}
              // DP-006: bubble khusus-lampiran — text boleh kosong, slot
              // children menampilkan daftar lampiran.
              text={m.text || undefined}
              time={formatDateTime(m.createdAt)}
              grouped={messages[i - 1]?.fromUser === m.fromUser}
              status={
                m.fromUser
                  ? sending && i === lastOutgoingIdx
                    ? "sending"
                    : "sent"
                  : undefined
              }
            >
              {attachments.length > 0 ? <MessageAttachments attachments={attachments} /> : null}
            </ChatMessageBubble>
          )
        })
      )}
    </>
  )
}
