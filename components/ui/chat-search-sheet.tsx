/**
 * Kahade — sheet "Cari pesan" untuk satu ruang percakapan (J-07).
 *
 * GET /v1/chat/rooms/{roomId}/search?q=…
 *
 * Kenapa dipisah dari layar ruang chat (G-11: layar itu hanya boleh menyusut):
 * pencarian adalah fitur yang berdiri sendiri — punya state kata kunci,
 * debounce, AbortController, dan daftar hasilnya sendiri. Layar cukup
 * mengendalikan `open` dan menerima `onJump(messageId)`.
 *
 * Keputusan non-obvious:
 *   - Debounce 400ms + abort request sebelumnya: endpoint ini mencari di
 *     SELURUH riwayat ruang, jadi setiap ketikan yang menembusnya adalah
 *     beban server dan hasil yang berkedip.
 *   - `open=false` mengosongkan kata kunci & hasil (bukan menyembunyikan
 *     state lama) supaya membuka sheet berikutnya selalu bersih.
 *   - Baris hasil memakai `accessibilityLabel` berisi teks pesan: pembaca
 *     layar tidak perlu menebak "Lompat ke pesan" yang mana.
 */
import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { translate } from "@/lib/i18n/translate"

import { searchRoomMessages, type ChatMessage } from "@/lib/api/chat"
import { userMessage } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { logWarn } from "@/lib/telemetry"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Input } from "@/components/ui/input"
import { ListLoading } from "@/components/ui/paginated-list"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export type ChatSearchSheetProps = {
  /** Sheet terbuka. Menutup mengosongkan kata kunci + hasil. */
  open: boolean
  /** Ruang yang dicari; tanpa id sheet tidak menembak request. */
  roomId?: string
  /** Nama lawan bicara untuk baris "waktu · pengirim". */
  counterpartName?: string
  onClose: () => void
  /** Pesan dipilih: layar melompat ke bubble-nya lalu menutup sheet. */
  onJump: (messageId: string) => void
}

/** Batas hasil satu kueri — cukup untuk dilompati, tidak untuk dibaca semua. */
const SEARCH_LIMIT = 20

export function ChatSearchSheet({
  open,
  roomId,
  counterpartName,
  onClose,
  onJump,
}: ChatSearchSheetProps) {
  const [query, setQuery] = useState("")
  const debounced = useDebouncedValue(query.trim(), 400)
  const [results, setResults] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)

  // Tutup → bersihkan. Efek (bukan di onClose) supaya reset juga terjadi saat
  // sheet ditutup oleh lapisan lain (tap backdrop, tombol kembali Android).
  useEffect(() => {
    if (open) return
    request.current?.abort()
    setQuery("")
    setResults([])
    setError(null)
    setLoading(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    request.current?.abort()
    if (!debounced || !roomId) {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    searchRoomMessages(roomId, debounced, { limit: SEARCH_LIMIT }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setResults(res.items)
        setError(null)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        logWarn("chat:search", err)
        setError(userMessage(err))
        setResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [open, debounced, roomId])

  const empty = !!debounced && results.length === 0

  return (
    <BottomSheet
      avoidKeyboard
      visible={open}
      onRequestClose={onClose}
      title="Cari pesan"
      description="Cari teks dalam percakapan ini."
      showHandle={false}
    >
      <View className="gap-3 px-5 pb-3">
        <Input
          variant="search"
          value={query}
          onChangeText={setQuery}
          placeholder="Ketik kata kunci…"
          accessibilityLabel="Kata kunci pencarian pesan"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          autoFocus
        />
        {loading ? (
          <ListLoading />
        ) : error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : empty ? (
          <Text variant="caption" tone="secondary">
            Tidak ada pesan yang cocok dengan kata kunci itu.
          </Text>
        ) : (
          results.map((r) => (
            <PressableScale
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={translate("Lompat ke pesan: {x}", { x: r.text ?? translate("(lampiran)") })}
              onPress={() => onJump(r.id)}
              containerClassName={cn("rounded-md px-2 py-2", focusRing)}
              // kelas baris/lebar ada di className (View isi) — lihat S8
              className="w-full gap-0.5"
            >
              <Text variant="body" numberOfLines={2}>
                {r.text || (r.attachments?.length ? "(lampiran)" : "(pesan tanpa teks)")}
              </Text>
              <Text variant="caption" tone="secondary">
                {formatDateTime(r.createdAt)} · {r.fromUser ? "Anda" : (counterpartName ?? "Lawan bicara")}
              </Text>
            </PressableScale>
          ))
        )}
      </View>
    </BottomSheet>
  )
}
