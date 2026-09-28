/**
 * Kahade — sheet laporkan & dialog blokir lawan bicara (batch 43 FE-CHAT, 2026-09-28).
 *
 *   - Laporkan: POST /v1/chat/rooms/{id}/report — kategori + deskripsi
 *     (min 20 char, validasi backend) + pesan terkait opsional.
 *   - Blokir: POST /v1/chat/rooms/{id}/block — Dialog konfirmasi (aksi
 *     destruktif, tidak bisa dibatalkan diam-diam).
 *
 * Keduanya disembunyikan untuk self-chat oleh parent (backend 400/404).
 */
import { useState } from "react"
import { Pressable, View } from "react-native"

import {
  blockCounterpartFromRoom,
  reportCounterpartFromRoom,
  CHAT_REPORT_CATEGORIES,
  type ChatReportCategory,
} from "@/lib/api/chat"
import { isApiError, userMessage } from "@/lib/api"
import { logWarn } from "@/lib/telemetry"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { Dialog } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"
import { CheckCircle } from "phosphor-react-native"

export type ChatReportSheetProps = {
  visible: boolean
  roomId: string | null
  /** Pesan yang sedang dipilih saat laporan dibuka (bukti terkait). */
  relatedMessageId?: string | null
  onRequestClose: () => void
  /** Laporan terkirim. */
  onReported?: () => void
  /** Buka dialog blokir (dirender parent via ChatBlockDialog). */
  onOpenBlock?: () => void
}

export function ChatReportSheet({
  visible,
  roomId,
  relatedMessageId,
  onRequestClose,
  onReported,
  onOpenBlock,
}: ChatReportSheetProps) {
  const toast = useToast()
  const [category, setCategory] = useState<ChatReportCategory | null>(null)
  const [description, setDescription] = useState("")
  const [sending, setSending] = useState(false)

  const descLen = description.trim().length
  const canSend = !!roomId && !!category && descLen >= 20 && descLen <= 500 && !sending

  const send = async () => {
    if (!canSend || !roomId || !category) return
    setSending(true)
    try {
      await reportCounterpartFromRoom(roomId, {
        category,
        description: description.trim(),
        ...(relatedMessageId ? { relatedMessageId } : {}),
      })
      toast.show({
        title: "Laporan terkirim",
        description: "Terima kasih — tim kami akan meninjau laporan ini.",
        tone: "success",
      })
      setCategory(null)
      setDescription("")
      onReported?.()
      onRequestClose()
    } catch (err) {
      logWarn("chat:report", err)
      toast.show({
        title: "Gagal mengirim laporan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title="Laporkan percakapan"
      description="Laporan Anda bersifat rahasia. Deskripsi minimal 20 karakter."
      avoidKeyboard
    >
      <View className="gap-3">
        <View className="gap-1.5">
          <Text variant="caption" weight={600} tone="secondary">
            Kategori pelanggaran
          </Text>
          {CHAT_REPORT_CATEGORIES.map((c) => {
            const active = category === c.value
            return (
              <Pressable
                key={c.value}
                onPress={() => setCategory(c.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                className={`flex-row items-center gap-3 rounded-md border px-3 py-2.5 ${
                  active ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <Text
                  variant="body"
                  weight={active ? 700 : 400}
                  tone="primary"
                  className="flex-1"
                >
                  {c.label}
                </Text>
                {active ? <Icon icon={CheckCircle} size={18} tone="active" weight="fill" /> : null}
              </Pressable>
            )
          })}
        </View>
        <TextArea
          label={`Kronologi (${descLen}/500)`}
          value={description}
          onChangeText={setDescription}
          placeholder="Ceritakan apa yang terjadi — minimal 20 karakter…"
          maxLength={500}
          numberOfLines={4}
        />
        <Button onPress={() => void send()} disabled={!canSend} loading={sending}>
          Kirim laporan
        </Button>
        {onOpenBlock ? (
          <Button
            variant="destructive"
            onPress={onOpenBlock}
            accessibilityLabel="Blokir pengguna ini"
          >
            Blokir pengguna ini
          </Button>
        ) : null}
      </View>
    </BottomSheet>
  )
}

export type ChatBlockDialogProps = {
  visible: boolean
  roomId: string | null
  counterpartName?: string | null
  onDismiss: () => void
  /** Blokir berhasil — parent menutup/menonaktifkan ruang. */
  onBlocked?: () => void
}

export function ChatBlockDialog({
  visible,
  roomId,
  counterpartName,
  onDismiss,
  onBlocked,
}: ChatBlockDialogProps) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!roomId || busy) return
    setBusy(true)
    try {
      await blockCounterpartFromRoom(roomId)
      toast.show({
        title: "Pengguna diblokir",
        description: "Mereka tidak bisa lagi mengirimi Anda pesan dari ruang ini.",
        tone: "success",
      })
      onBlocked?.()
      onDismiss()
    } catch (err) {
      logWarn("chat:block", err)
      toast.show({
        title: "Gagal memblokir",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      visible={visible}
      onRequestClose={onDismiss}
      title="Blokir pengguna ini?"
      description={
        counterpartName
          ? `${counterpartName} tidak akan bisa mengirimi Anda pesan lagi dari percakapan ini.`
          : "Pengguna ini tidak akan bisa mengirimi Anda pesan lagi dari percakapan ini."
      }
      tone="danger"
      destructive
      confirmLabel="Blokir"
      cancelLabel="Batal"
      loading={busy}
      onConfirm={() => void confirm()}
      onCancel={onDismiss}
    />
  )
}
