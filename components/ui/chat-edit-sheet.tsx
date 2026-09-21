/**
 * Kahade — sheet "Edit pesan" untuk pesan teks milik sendiri.
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
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

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
    if (!roomId || !message || !content || content === message.text) {
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
        title: "Gagal menyimpan perubahan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSaving(false)
    }
  }

  const unchanged = !draft.trim() || draft.trim() === message?.text

  return (
    <BottomSheet
      avoidKeyboard
      visible={message != null}
      onRequestClose={onClose}
      title="Edit pesan"
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
          placeholder="Tulis ulang pesan Anda"
          accessibilityLabel="Isi pesan yang diedit"
        />
      </View>
    </BottomSheet>
  )
}
