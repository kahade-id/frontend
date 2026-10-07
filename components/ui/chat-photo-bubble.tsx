/**
 * Kahade — bubble FOTO chat: pratinjau BESAR langsung di bubble.
 *
 * Menggantikan tile 72px lama (<ChatAttachmentItem layout="tile">) yang hanya
 * ikon bila `thumbnailUrl` kosong. Foto selalu dimuat (`thumbnailUrl` bila
 * ada, kalau tidak berkas aslinya — expo-image men-cache-nya) dengan aspek
 * 4:3, ketuk → halaman media viewer (`type=photo`, album per pesan).
 *
 * Status kirim digambar DI ATAS foto (meta bubble memakai `overlayMeta` —
 * jam menempel di sudut foto ala WhatsApp):
 *   - sending/queued → scrim + spinner + "Mengirim…"/"Menunggu koneksi".
 *   - failed → scrim + tombol "Coba lagi" (di samping tautan meta).
 *
 * Long-press TIDAK ditangani di sini — milik baris (mode pilih + popover
 * reaksi); menu Lihat/Simpan/Teruskan/Hapus foto ada di SelectionBar saat
 * pesan foto dipilih (lihat chat-room-screen `selectionActions`). Ini
 * disengaja: long-press bersarang (anak + baris) memicu DUA menu sekaligus.
 */
import { memo, useCallback, useRef, useState } from "react"
import { View } from "react-native"
import { ArrowClockwise } from "phosphor-react-native"

import type { ChatAttachmentDto } from "@/lib/api/types"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { translate, useLanguage } from "@/lib/i18n"
import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"

export type ChatPhotoBubbleProps = {
  attachment: ChatAttachmentDto
  messageId: string
  /** Status kirim pesan pemilik (optimistis); undefined = dari server. */
  sendStatus?: "queued" | "sending" | "failed"
  onPress: () => void
  onRetry?: () => void
  /**
   * Refresh signed URL kedaluwarsa (TTL 5 mnt) — pola thumbnail lama:
   * `Picture` onError → refresh sekali → retry.
   */
  onRefreshUrl?: (attachment: ChatAttachmentDto) => Promise<ChatAttachmentDto>
}

export const ChatPhotoBubble = memo(function ChatPhotoBubble({
  attachment,
  messageId,
  sendStatus,
  onPress,
  onRetry,
  onRefreshUrl,
}: ChatPhotoBubbleProps) {
  useLanguage()
  const { mode } = useTheme()
  const iconColor = tokens.colors[mode].textPrimary
  // thumbnailUrl dulu (kecil); fallback berkas asli (expo-image cache).
  const [src, setSrc] = useState(() => attachment.thumbnailUrl || attachment.fileUrl)
  const [failed, setFailed] = useState(false)
  const refreshTried = useRef(false)

  const srcKey = attachment.thumbnailUrl || attachment.fileUrl
  const [lastKey, setLastKey] = useState(srcKey)
  if (srcKey !== lastKey) {
    setLastKey(srcKey)
    setSrc(srcKey)
    setFailed(false)
    refreshTried.current = false
  }

  const handleError = useCallback(() => {
    if (refreshTried.current || !onRefreshUrl) {
      setFailed(true)
      return
    }
    refreshTried.current = true
    onRefreshUrl(attachment)
      .then((fresh) => {
        const next = fresh.thumbnailUrl || fresh.fileUrl
        if (next && next !== src) setSrc(next)
        else setFailed(true)
      })
      .catch(() => setFailed(true))
  }, [attachment, onRefreshUrl, src])

  const sending = sendStatus === "sending" || sendStatus === "queued"
  const sendFailed = sendStatus === "failed"

  return (
    <PressableScale
      scaleOnPress={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={summarize([
        translate("Foto: {x}", { x: attachment.fileName }),
        translate("Ketuk untuk melihat foto"),
        sending ? translate("Mengirim") : sendFailed ? translate("Belum terkirim") : undefined,
      ])}
      accessibilityHint={translate("Membuka foto layar penuh")}
      containerClassName="rounded-sm"
      className="relative w-52 overflow-hidden rounded-sm"
    >
      {failed ? (
        <View className="aspect-[4/3] w-full items-center justify-center gap-1 bg-surface px-4">
          <Text variant="caption" tone="secondary" className="text-center">
            Foto gagal dimuat
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1} className="text-center">
            {attachment.fileName}
          </Text>
        </View>
      ) : (
        <Picture
          source={src}
          alt=""
          aspectRatio={4 / 3}
          radius="none"
          bordered={false}
          resizeMode="cover"
          recyclingKey={`${messageId}:${src}`}
          onError={handleError}
          className="w-full"
        />
      )}

      {/* Status kirim menutup foto (pill mode-aware — tanpa class literal). */}
      {sending ? (
        <View className="absolute inset-0 items-center justify-center bg-overlay">
          <View className="flex-row items-center gap-2 rounded-full bg-surface-elevated px-3 py-1.5">
            <Spinner size="sm" />
            <Text variant="caption" weight={600}>
              {sendStatus === "queued" ? "Menunggu koneksi" : "Mengirim…"}
            </Text>
          </View>
        </View>
      ) : null}
      {sendFailed ? (
        <View className="absolute inset-0 items-center justify-center bg-overlay">
          {onRetry ? (
            <PressableScale
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={translate("Kirim ulang foto {x}", { x: attachment.fileName })}
              className="flex-row items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1.5"
            >
              <View className="flex-row items-center gap-1.5">
                <ArrowClockwise size={14} weight="bold" color={iconColor} />
                <Text variant="caption" weight={700}>
                  Coba lagi
                </Text>
              </View>
            </PressableScale>
          ) : (
            <View className="rounded-full bg-surface-elevated px-3 py-1.5">
              <Text variant="caption" weight={600}>
                Belum terkirim
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </PressableScale>
  )
})
