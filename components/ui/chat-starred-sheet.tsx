/**
 * Kahade — sheet pesan berbintang (batch 43 FE-CHAT, 2026-09-28).
 *
 * GET /v1/chat/rooms/{id}/starred — daftar pesan yang saya bintangi di
 * ruang ini. Tiap baris: cuplikan pesan, pengirim, waktu, tombol buka di
 * thread (opsional) + hapus bintang.
 */
import { useCallback, useEffect, useState } from "react"
import { Pressable, View } from "react-native"

import { listStarredMessages, unstarChatMessage, type ChatMessage } from "@/lib/api/chat"
import { isApiError, userMessage } from "@/lib/api"
import { logWarn } from "@/lib/telemetry"
import { formatTime } from "@/lib/format"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { EmptyState } from "@/components/ui/empty-state"
import { Icon } from "@/components/ui/icon"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { Star } from "phosphor-react-native"

export type ChatStarredSheetProps = {
  visible: boolean
  roomId: string | null
  onRequestClose: () => void
  /** Bintang dihapus — layar menambal `isStarred` di thread. */
  onUnstarred?: (messageId: string) => void
  /** Lompat ke pesan di thread (opsional). */
  onJumpToMessage?: (messageId: string) => void
}

function starredPreview(message: ChatMessage): string {
  if (message.isDeleted) return "Pesan ini telah dihapus"
  return message.text?.trim() || "(lampiran)"
}

export function ChatStarredSheet({
  visible,
  roomId,
  onRequestClose,
  onUnstarred,
  onJumpToMessage,
}: ChatStarredSheetProps) {
  const toast = useToast()
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!roomId) return
    try {
      setMessages(await listStarredMessages(roomId))
    } catch (err) {
      logWarn("chat:starred-load", err)
      toast.show({
        title: "Gagal memuat pesan berbintang",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
      setMessages([])
    }
  }, [roomId, toast])

  useEffect(() => {
    if (visible) {
      setMessages(null)
      void load()
    }
  }, [visible, load])

  const handleUnstar = async (message: ChatMessage) => {
    if (!roomId) return
    setBusyId(message.id)
    try {
      await unstarChatMessage(roomId, message.id)
      setMessages((prev) => (prev ? prev.filter((m) => m.id !== message.id) : prev))
      onUnstarred?.(message.id)
    } catch (err) {
      logWarn("chat:unstar", err)
      toast.show({
        title: "Gagal menghapus bintang",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title="Pesan berbintang"
      description="Pesan penting yang Anda tandai di ruang ini."
    >
      {messages === null ? (
        <View className="items-center py-8">
          <Spinner />
        </View>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Belum ada pesan berbintang"
          description="Tekan lama sebuah pesan lalu pilih Bintang untuk menandainya."
        />
      ) : (
        <View className="gap-2">
          {messages.map((m) => (
            <Pressable
              key={m.id}
              onPress={onJumpToMessage ? () => onJumpToMessage(m.id) : undefined}
              accessibilityRole={onJumpToMessage ? "button" : undefined}
              accessibilityLabel={`Pesan berbintang: ${starredPreview(m)}`}
              className="gap-1 rounded-md border border-border bg-surface p-3"
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text
                  variant="body"
                  tone="primary"
                  numberOfLines={3}
                  ellipsizeMode="tail"
                  className="flex-1"
                >
                  {starredPreview(m)}
                </Text>
                <Pressable
                  onPress={() => void handleUnstar(m)}
                  disabled={busyId === m.id}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus bintang"
                  className="p-1"
                >
                  <Icon icon={Star} size={18} tone="warning" weight="fill" />
                </Pressable>
              </View>
              <Text variant="caption" tone="secondary" className="tabular-nums">
                {m.fromUser ? "Anda" : "Lawan bicara"} • {formatTime(m.createdAt)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  )
}
