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
import { PressableScale } from "@/components/ui/pressable-scale"
import { SensitiveConfirmDialog } from "@/components/ui/sensitive-confirm"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"
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
  // UX-TCH-005: hapus bintang = aksi destruktif → minta konfirmasi dulu.
  const [confirmUnstar, setConfirmUnstar] = useState<ChatMessage | null>(null)

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
    <>
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
              accessibilityLabel={translate("Pesan berbintang: {x}", { x: starredPreview(m) })}
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
                {/*
                  UX-TCH-005: target 44pt (min-h-11/min-w-11) + feedback scale;
                  sebelumnya Pressable polos 26px. Ketuk → dialog konfirmasi
                  (aksi destruktif), bukan hapus langsung.
                  P1d (2026-10-03): stopPropagation — tanpa ini, tap "Hapus
                  bintang" juga memicu onPress "lompat ke pesan" di Pressable
                  induk (keduanya fire).
                  Audit Pesan 2026-10-10 (room #1, KRITIS): komentar ini dulu
                  ditulis `//` di antara anak JSX → dirender sebagai STRING di
                  dalam <View> → "Text strings must be rendered within a <Text>"
                  → crash setiap kali sheet berisi ≥1 pesan berbintang.
                */}
                <PressableScale
                  onPress={(e) => {
                    e.stopPropagation()
                    setConfirmUnstar(m)
                  }}
                  disabled={busyId === m.id}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus bintang"
                  accessibilityHint="Minta konfirmasi sebelum menghapus"
                  containerClassName="min-h-11 min-w-11 items-center justify-center rounded-full"
                  hitSlop={8}
                >
                  <Icon icon={Star} size={18} tone="warning" weight="fill" />
                </PressableScale>
              </View>
              <Text variant="caption" tone="secondary" className="tabular-nums">
                {m.fromUser ? translate("Anda") : translate("Lawan bicara")} • {formatTime(m.createdAt)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      </BottomSheet>
      {/* UX-TCH-005: konfirmasi sebelum hapus bintang (aksi destruktif).
          Dirender sebagai sibling BottomSheet, bukan anak — Dialog adalah
          Modal kustom via Portal (z-modal 60), di atas BottomSheet (z 50);
          urutan tutup LIFO via useOverlayDismissKeys. BUKAN RN Modal native. */}
      <SensitiveConfirmDialog
        visible={confirmUnstar !== null}
        title="Hapus bintang?"
        description="Pesan ini tidak lagi ditandai sebagai pesan berbintang di ruang ini."
        consequences={[
          "Anda bisa menandai ulang pesan ini kapan saja dari thread chat.",
        ]}
        confirmLabel="Ya, hapus"
        onConfirm={() => {
          const target = confirmUnstar
          setConfirmUnstar(null)
          if (target) void handleUnstar(target)
        }}
        onCancel={() => setConfirmUnstar(null)}
        loading={busyId !== null && busyId === confirmUnstar?.id}
      />
    </>
  )
}
