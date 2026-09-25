/**
 * Kahade — footer ruang chat: tombol "gulir ke pesan terbaru" + salah satu
 * dari dua keadaan dasar ruang (composer, atau panel "transaksi selesai").
 *
 * Dipecah dari `app/chat/[roomId].tsx` (2026-09-26) karena layar itu
 * menyentuh plafon G-11 (god component): blok ini hanya menyusun tiga
 * komponen yang sudah ada dan tidak memakai state layar sedikit pun selain
 * yang dilewatkan sebagai prop.
 *
 * Kenapa composer dan panel selesai bercabang DI SINI (bukan di layar):
 * keduanya menempati slot yang sama di dasar layar dan saling eksklusif —
 * ruang yang sudah selesai tidak boleh punya kotak tulis. Menjaga cabang
 * ini di dalam footer membuat layar cukup berkata "apa keadaan ruangnya".
 */
import { CheckCircle } from "phosphor-react-native"
import { View } from "react-native"

import { Button } from "@/components/ui/button"
import { ChatComposer, type ChatComposerPayload, type ComposerAttachment } from "@/components/ui/chat-composer"
import { Icon } from "@/components/ui/icon"
import { ScrollToEndButton } from "@/components/ui/scroll-to-end-button"
import { Text } from "@/components/ui/text"

export type ChatRoomFooterProps = {
  /** Tombol lompat ke bawah hanya berguna saat pembaca sudah meninggalkan dasar. */
  showJumpToLatest: boolean
  onJumpToLatest: () => void
  /** Ruang sudah selesai → composer diganti panel informasi. */
  completed: boolean
  /** Kalimat penutup ruang (lihat `chatRoomClosedNotice`). */
  closedNotice: string
  /** Ada pesanan terkait → tampilkan jalan pintas detail transaksi. */
  orderId?: string | null | undefined
  onOpenOrder: (orderId: string) => void
  // ── Composer (diabaikan bila `completed`) ──
  draft: string
  onDraftChange: (value: string) => void
  onSend: (payload: ChatComposerPayload) => void
  attachments: ComposerAttachment[]
  onAttach: () => void
  onRemoveAttachment: (localId: string) => void
  onRetryAttachment: (localId: string) => void
  sending: boolean
  disabled: boolean
}

export function ChatRoomFooter({
  showJumpToLatest,
  onJumpToLatest,
  completed,
  closedNotice,
  orderId,
  onOpenOrder,
  draft,
  onDraftChange,
  onSend,
  attachments,
  onAttach,
  onRemoveAttachment,
  onRetryAttachment,
  sending,
  disabled,
}: ChatRoomFooterProps) {
  return (
    <View>
      {/* Kembali ke dasar thread — muncul hanya saat pembaca
          meninggalkan bawah (deteksi di onScroll). */}
      <ScrollToEndButton
        visible={showJumpToLatest}
        onPress={onJumpToLatest}
        label="Gulir ke pesan terbaru"
        className="px-5 pb-2"
      />

      {completed ? (
        <View className="border-t border-border bg-surface px-4 py-3">
          <View className="items-center justify-center gap-1.5 rounded-lg bg-surface-raised px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Icon icon={CheckCircle} size="sm" tone="default" />
              <Text variant="caption" tone="secondary" className="text-center font-medium">
                {closedNotice}
              </Text>
            </View>
            {orderId ? (
              <Button variant="ghost" size="sm" onPress={() => onOpenOrder(orderId)}>
                Lihat detail transaksi
              </Button>
            ) : null}
          </View>
        </View>
      ) : (
        <ChatComposer
          value={draft}
          onChangeText={onDraftChange}
          onSend={onSend}
          attachments={attachments}
          onAttach={onAttach}
          onRemoveAttachment={onRemoveAttachment}
          onRetryAttachment={onRetryAttachment}
          sending={sending}
          disabled={disabled}
        />
      )}
    </View>
  )
}
