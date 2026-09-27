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
import { CheckCircle, Clock, EyeSlash, X } from "phosphor-react-native"
import { View } from "react-native"

import { Button } from "@/components/ui/button"
import { ChatComposer, type ChatComposerPayload, type ComposerAttachment, type ComposerReplyTarget } from "@/components/ui/chat-composer"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
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
  /** Mic ala WhatsApp di composer (opsional) — buka perekam voice note. */
  onMicPress?: () => void
  onRemoveAttachment: (localId: string) => void
  onRetryAttachment: (localId: string) => void
  sending: boolean
  disabled: boolean
  /** Target balasan — strip "Membalas …" di atas composer (permintaan produk 2026-09-28). */
  replyTo?: ComposerReplyTarget
  onCancelReply?: () => void
  // ── Batch 43 FE-CHAT ──────────────────────────────────────────────
  /** Label mode pesan sementara aktif (null = mati), mis. "1 hari". */
  ephemeralLabel?: string | null
  /** Mode sekali-lihat aktif untuk pesan berikutnya. */
  viewOnceActive?: boolean
  /** Buka sheet pengaturan pesan sementara/sekali-lihat. */
  onOpenEphemeral?: () => void
  /** Matikan kedua mode. */
  onClearEphemeral?: () => void
  /** Tampilkan toolbar format teks di atas composer. */
  formatBar?: boolean
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
  onMicPress,
  onRemoveAttachment,
  onRetryAttachment,
  sending,
  disabled,
  replyTo,
  onCancelReply,
  ephemeralLabel = null,
  viewOnceActive = false,
  onOpenEphemeral,
  onClearEphemeral,
  formatBar = false,
}: ChatRoomFooterProps) {
  const ephemeralActive = ephemeralLabel != null || viewOnceActive
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
        <View>
          {/* Batch 43: strip mode pesan sementara / sekali-lihat aktif. */}
          {ephemeralActive ? (
            <View className="flex-row items-center gap-2 border-t border-border bg-surface px-4 py-1.5">
              <Icon icon={ephemeralLabel != null ? Clock : EyeSlash} size="sm" tone="warning" />
              <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={1}>
                {ephemeralLabel != null
                  ? `Pesan sementara aktif (${ephemeralLabel})`
                  : "Sekali-lihat aktif untuk pesan berikutnya"}
                {viewOnceActive && ephemeralLabel != null ? " · sekali-lihat" : ""}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                accessibilityLabel="Ubah pengaturan pesan sementara"
                onPress={onOpenEphemeral}
              >
                Ubah
              </Button>
              <IconButton
                icon={X}
                size="sm"
                variant="ghost"
                accessibilityLabel="Matikan mode pesan sementara"
                onPress={() => onClearEphemeral?.()}
              />
            </View>
          ) : null}
          <ChatComposer
            value={draft}
            onChangeText={onDraftChange}
            onSend={onSend}
            attachments={attachments}
            onAttach={onAttach}
            onMicPress={onMicPress}
            onRemoveAttachment={onRemoveAttachment}
            onRetryAttachment={onRetryAttachment}
            replyTo={replyTo}
            onCancelReply={onCancelReply}
            sending={sending}
            disabled={disabled}
            formatBar={formatBar}
          />
        </View>
      )}
    </View>
  )
}
