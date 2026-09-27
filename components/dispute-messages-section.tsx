/**
 * Kahade — <MessagesSection>: daftar gelembung chat sederhana dengan
 * status kosong (dipakai detail sengketa; diekstrak R2 #95).
 *
 * DP-006 (audit 2026-09-26): pesan khusus-lampiran dirender sebagai bubble
 * lampiran (ikon + nama file + ukuran + tipe).
 *
 * GAP-B3 (G136–G142): lampiran pesan dirender dari DTO backend (fileKey,
 * fileName, fileType, fileSize + signed URL opsional) — dapat diketuk untuk
 * dibuka di <DisputeAttachmentViewer> (zoom + navigasi untuk gambar, buka via
 * OS untuk berkas lain). Signed URL kedaluwarsa diminta ulang otomatis (G139);
 * setiap lampiran berlabel pihak (G141: Bukti Anda/Pembeli/Penjual/Moderator)
 * + metadata nama/tipe/ukuran/waktu (G142). Status buka: memuat / tidak
 * tersedia (G140). Hak akses mengandalkan guard backend — endpoint signed-URL
 * hanya untuk peserta sengketa (G148).
 */
import { useCallback, useState } from "react"
import { Pressable, View } from "react-native"

import { formatDateTime, formatFileSize } from "@/lib/format"
import { attachmentIcon, isImageAttachment } from "@/components/ui/chat-attachment-item"
import type { DisputeMessageAttachment } from "@/lib/api/disputes"
import {
  attachmentTypeLabel,
  DISPUTE_ATTACHMENT_PARTY_LABELS,
  type AttachmentParty,
} from "@/lib/dispute-attachments"

import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Icon } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { Picture } from "@/components/ui/picture"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import {
  DisputeAttachmentViewer,
  type ViewerAttachment,
} from "@/components/dispute-attachment-viewer"
import { useToast } from "@/components/ui/toast"

export type MessageRow = {
  id: string
  fromUser: boolean
  text: string
  createdAt: string
  senderId?: string
  adminId?: string
  /** Label pihak pengirim untuk lampiran (G141) — dihitung layar dari order. */
  party?: AttachmentParty
  attachments?: DisputeMessageAttachment[]
}

function MessageAttachments({
  attachments,
  party,
  onOpen,
}: {
  attachments: DisputeMessageAttachment[]
  party?: AttachmentParty
  onOpen: (index: number) => void
}) {
  const partyLabel = party ? DISPUTE_ATTACHMENT_PARTY_LABELS[party] : undefined
  return (
    <View className="gap-2">
      {attachments.map((a, i) => {
        const image = isImageAttachment({ mimeType: a.fileType })
        const meta = [
          attachmentTypeLabel(a.fileType),
          typeof a.fileSize === "number" ? formatFileSize(a.fileSize) : null,
        ]
          .filter(Boolean)
          .join(" · ")
        return (
          <Pressable
            key={`${a.fileKey || a.fileName}-${i}`}
            onPress={() => onOpen(i)}
            accessibilityRole="button"
            accessibilityLabel={`Buka lampiran: ${a.fileName}, ${attachmentTypeLabel(a.fileType)}${typeof a.fileSize === "number" ? `, ${formatFileSize(a.fileSize)}` : ""}${partyLabel ? `, ${partyLabel}` : ""}`}
            className="flex-row items-center gap-2 rounded-xs p-1"
          >
            {image && a.url ? (
              <Picture source={a.url} alt="" width={40} height={40} radius="xs" bordered />
            ) : (
              <IconBox icon={attachmentIcon(a.fileType)} size="sm" />
            )}
            <View className="flex-1">
              <Text variant="body" numberOfLines={1}>
                {a.fileName}
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {[partyLabel, meta].filter(Boolean).join(" · ") || "Lampiran"}
              </Text>
            </View>
            <Icon icon={attachmentIcon(a.fileType)} size="xs" tone="default" />
          </Pressable>
        )
      })}
    </View>
  )
}

export function DisputeMessagesSection({
  messages,
  sending,
  disputeId,
}: {
  messages: MessageRow[]
  /** SEC-DSP-FE-04: tampilkan "Mengirim" pada pesan sendiri yang sedang dikirim. */
  sending?: boolean
  /** Id sengketa — untuk refresh signed URL lampiran (G139). */
  disputeId: string
}) {
  const toast = useToast()
  const lastOutgoingIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].fromUser) return i
    }
    return -1
  })()

  // Viewer lampiran: indeks pesan + indeks lampiran di pesan itu (G137).
  const [viewer, setViewer] = useState<{ messageIndex: number; attachmentIndex: number } | null>(
    null,
  )
  const openAttachment = useCallback((messageIndex: number, attachmentIndex: number) => {
    setViewer({ messageIndex, attachmentIndex })
  }, [])
  const viewerMessage = viewer ? messages[viewer.messageIndex] : undefined
  const viewerItems: ViewerAttachment[] = (viewerMessage?.attachments ?? []).map((a) => ({
    ...a,
    messageCreatedAt: viewerMessage?.createdAt,
  }))

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
              {attachments.length > 0 ? (
                <MessageAttachments
                  attachments={attachments}
                  party={m.party}
                  onOpen={(attachmentIndex) => openAttachment(i, attachmentIndex)}
                />
              ) : null}
            </ChatMessageBubble>
          )
        })
      )}

      <DisputeAttachmentViewer
        visible={viewer != null}
        disputeId={disputeId}
        items={viewerItems}
        index={viewer?.attachmentIndex ?? 0}
        onIndexChange={(attachmentIndex) =>
          setViewer((v) => (v ? { ...v, attachmentIndex } : v))
        }
        onClose={() => setViewer(null)}
        party={viewerMessage?.party}
        messageCreatedAt={viewerMessage?.createdAt}
        onOpenError={(message) => toast.show({ title: message, tone: "danger" })}
      />
    </>
  )
}
