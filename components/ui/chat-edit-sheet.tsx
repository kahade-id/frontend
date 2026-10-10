/**
 * Kahade — sheet "Ubah pesan" untuk pesan teks milik sendiri.
 *
 * PUT /v1/chat/rooms/{roomId}/messages/{messageId}
 *
 * Kenapa dipisah dari layar ruang chat (G-11: layar itu hanya boleh menyusut):
 * editor kecil ini punya state draft + state simpan + panggilan API sendiri.
 * Layar hanya menyerahkan pesan yang diedit dan menerima hasilnya lewat
 * `onSaved` untuk menambal thread.
 *
 * Keputusan non-obvious:
 *   - Draft di-sync dari pesan saat sheet dibuka (bukan saat mount): layar
 *     bisa membuka sheet untuk pesan berbeda tanpa me-remount komponen.
 *   - Tombol Simpan mati bila draft kosong ATAU identik dengan teks asli —
 *     menyimpan teks yang sama tetap menaikkan `isEdited` di server dan
 *     memberi cap "diedit" yang menyesatkan.
 *   - `avoidKeyboard`: sheet ini isinya TextArea, tanpa itu keyboard menutupi
 *     tombol Simpan di layar kecil.
 */
import { useEffect, useState } from "react"
import { View } from "react-native"

import { isApiError, userMessage } from "@/lib/api"
import { editChatMessage, type ChatMessage } from "@/lib/api/chat"
import { logWarn } from "@/lib/telemetry"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { CHAT_MESSAGE_MAX } from "@/components/ui/chat-composer"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"

export type ChatEditSheetProps = {
  /** Pesan yang diedit; `null` menutup sheet. */
  message: ChatMessage | null
  roomId?: string
  onClose: () => void
  /** Simpan berhasil — layar menambal bubble di thread. */
  onSaved: (messageId: string, text: string, editedAt: string) => void
}

export function ChatEditSheet({ message, roomId, onClose, onSaved }: ChatEditSheetProps) {
  const toast = useToast()
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(message?.text ?? "")
    if (!message) setSaving(false)
  }, [message])

  const save = async () => {
    const content = draft.trim()
    // Audit Pesan 2026-10-10 (room #36): bandingkan dengan teks asli yang
    // juga di-trim — spasi ekor di pesan asli dulu membuat "Simpan" aktif
    // tanpa perubahan nyata dan pesan diberi tanda "diedit".
    if (!roomId || !message || !content || content === (message.text ?? "").trim()) {
      onClose()
      return
    }
    setSaving(true)
    try {
      const updated = await editChatMessage(roomId, message.id, content)
      onSaved(
        message.id,
        updated.text ?? content,
        (updated as { editedAt?: string }).editedAt ?? new Date().toISOString(),
      )
      onClose()
    } catch (err) {
      logWarn("chat:edit", err)
      toast.show({
        title: translate("Gagal menyimpan perubahan"),
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSaving(false)
    }
  }

  const unchanged = !draft.trim() || draft.trim() === (message?.text ?? "").trim()

  return (
    <BottomSheet
      avoidKeyboard
      visible={message != null}
      onRequestClose={onClose}
      title="Ubah pesan"
      footer={
        <View className="gap-2">
          <Button fullWidth loading={saving} disabled={unchanged} onPress={() => void save()}>
            Simpan
          </Button>
          <Button variant="ghost" fullWidth onPress={onClose}>
            Batal
          </Button>
        </View>
      }
    >
      <View className="px-5 pb-2">
        <TextArea
          value={draft}
          onChangeText={setDraft}
          rows={4}
          // UI-C011: samakan dengan batas composer (2000) — tanpa ini user
          // bisa mengetik lebih lalu ditolak server saat menyimpan.
          maxLength={CHAT_MESSAGE_MAX}
          placeholder="Tulis ulang pesan Anda"
          accessibilityLabel="Isi pesan yang diedit"
        />
      </View>
    </BottomSheet>
  )
}
