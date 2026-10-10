/**
 * Kahade — bubble VIDEO chat: thumbnail + tombol putar + durasi.
 *
 * Keadaan:
 *   1. Collapsed (default) — thumbnail (atau kotak gelap bila belum ada
 *      `thumbnailUrl`), tombol putar di tengah, lencana durasi kiri-bawah
 *      (kanan-bawah milik meta bubble), ukuran berkas bila ada. Ketuk tombol
 *      putar/area mana pun → (2). Ketuk tombol "layar penuh" (pojok kanan
 *      atas) → halaman media viewer langsung.
 *   2. Inline — <FeedVideo> BISU + `userInitiatedPlay` (pengguna eksplisit
 *      mengetuk, jadi gate Wi-Fi dilewati — bunyi tetap mati sampai pengguna
 *      menyalakan). Ketuk video = jeda/lanjut. Overlay pojok: bisu/suara +
 *      layar penuh (→ viewer `type=video`, posisi tonton TIDAK dibawa —
 *      batasan yang didokumentasikan, bukan bug).
 *
 * Catatan thumbnail: backend tidak selalu mengisi `thumbnailUrl` untuk video.
 * Tanpa itu bubble tetap informatif (ikon + durasi + ukuran), bukan kotak
 * kosong. Membuat thumbnail lokal dari berkas remote butuh unduh penuh —
 * boros kuota; lihat rekomendasi backend di
 * `docs/rekomendasi-backend-media.md` (P0).
 */
import { memo, useCallback, useRef, useState } from "react"
import { View } from "react-native"
import { ArrowClockwise, ArrowsOut, FilmStrip, Play, SpeakerHigh, SpeakerX } from "phosphor-react-native"

import type { ChatAttachmentDto } from "@/lib/api/types"
import { FeedVideo } from "@/components/ui/feed-video"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { formatBytes, formatMediaClock } from "@/lib/media-viewer"
import { summarize } from "@/lib/a11y"
import { translate, useLanguage } from "@/lib/i18n"
import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"

export type ChatVideoBubbleProps = {
  attachment: ChatAttachmentDto
  messageId: string
  /** Durasi detik dari pesan (`durationSeconds`) — badge, bukan dari berkas. */
  durationSeconds?: number | null
  sendStatus?: "queued" | "sending" | "failed"
  /** Buka pemutar layar penuh (/media-viewer?type=video). */
  onOpenFullscreen: () => void
  onRetry?: () => void
  onRefreshUrl?: (attachment: ChatAttachmentDto) => Promise<ChatAttachmentDto>
  /** Bug #7 (2026-10-10): lebar media = lebar kolom bubble (lihat chat-message-row). */
  width?: number
}

export const ChatVideoBubble = memo(function ChatVideoBubble({
  attachment,
  messageId,
  durationSeconds,
  sendStatus,
  onOpenFullscreen,
  onRetry,
  onRefreshUrl,
  width,
}: ChatVideoBubbleProps) {
  useLanguage()
  const { mode } = useTheme()
  const onElevated = tokens.colors[mode].textPrimary
  const [inline, setInline] = useState(false)
  const [muted, setMuted] = useState(true)
  const [src, setSrc] = useState(() => attachment.fileUrl)
  // Audit Pesan 2026-10-10 (media #18): thumbnail punya URL bertanda tangan
  // SENDIRI — dulu yang di-refresh `fileUrl` (video) sementara <Picture>
  // tetap memuat `attachment.thumbnailUrl` lama → overlay "gagal" abadi.
  const [thumbSrc, setThumbSrc] = useState(() => attachment.thumbnailUrl ?? null)
  const [thumbFailed, setThumbFailed] = useState(false)
  const refreshTried = useRef(false)

  const fileKey = attachment.fileUrl
  const [lastKey, setLastKey] = useState(fileKey)
  if (fileKey !== lastKey) {
    setLastKey(fileKey)
    setSrc(fileKey)
    setThumbSrc(attachment.thumbnailUrl ?? null)
    setThumbFailed(false)
    setInline(false)
    refreshTried.current = false
  }

  const handleThumbError = useCallback(() => {
    if (refreshTried.current || !onRefreshUrl) {
      setThumbFailed(true)
      return
    }
    refreshTried.current = true
    onRefreshUrl(attachment)
      .then((fresh) => {
        if (fresh.fileUrl && fresh.fileUrl !== src) setSrc(fresh.fileUrl)
        const nextThumb = fresh.thumbnailUrl ?? null
        if (nextThumb && nextThumb !== thumbSrc) setThumbSrc(nextThumb)
        else setThumbFailed(true)
      })
      .catch(() => setThumbFailed(true))
  }, [attachment, onRefreshUrl, src, thumbSrc])

  const sending = sendStatus === "sending" || sendStatus === "queued"
  const sendFailed = sendStatus === "failed"
  const durationLabel =
    durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? formatMediaClock(durationSeconds)
      : null
  const sizeLabel = attachment.fileSize != null ? formatBytes(attachment.fileSize) : null

  return (
    <View
      className={cn("relative overflow-hidden rounded-sm", width == null && "w-52")}
      style={width != null ? { width } : undefined}
    >
      {inline && !sending && !sendFailed ? (
        <>
          <FeedVideo
            source={src}
            // Batch 3: poster = thumbnail yang SUDAH di-refresh (media #18),
            // bukan URL lama yang mungkin kedaluwarsa.
            poster={thumbSrc ?? undefined}
            alt={attachment.fileName}
            shouldPlay
            muted={muted}
            loop={false}
            allowTapToggle
            userInitiatedPlay
            aspectRatio={4 / 3}
            className="w-full"
          />
          {/* Overlay kontrol inline — pill mode-aware. */}
          <View className="absolute right-1.5 top-1.5 flex-row gap-1.5">
            <PressableScale
              onPress={() => setMuted((m) => !m)}
              accessibilityRole="button"
              accessibilityLabel={muted ? translate("Nyalakan suara") : translate("Bisukan")}
              className="rounded-full bg-surface-elevated p-1.5"
            >
              {muted ? (
                <SpeakerX size={16} weight="fill" color={onElevated} />
              ) : (
                <SpeakerHigh size={16} weight="fill" color={onElevated} />
              )}
            </PressableScale>
            <PressableScale
              // Audit Pesan 2026-10-10 (media #19): pemutar inline DIHENTIKAN
              // sebelum layar penuh dibuka — dulu dua pemutar bersuara sekaligus.
              onPress={() => {
                setInline(false)
                onOpenFullscreen()
              }}
              accessibilityRole="button"
              accessibilityLabel={translate("Buka layar penuh")}
              className="rounded-full bg-surface-elevated p-1.5"
            >
              <ArrowsOut size={16} weight="bold" color={onElevated} />
            </PressableScale>
          </View>
        </>
      ) : (
        <>
        <PressableScale
          scaleOnPress={false}
          onPress={() => setInline(true)}
          accessibilityRole="button"
          accessibilityLabel={summarize([
            translate("Video: {x}", { x: attachment.fileName }),
            durationLabel ? translate("Durasi {x}", { x: durationLabel }) : undefined,
            translate("Ketuk untuk memutar"),
            sending ? translate("Mengirim") : sendFailed ? translate("Belum terkirim") : undefined,
          ])}
          accessibilityHint={translate("Memutar video di dalam chat (bisu)")}
          className="relative w-full"
        >
          {thumbSrc && !thumbFailed ? (
            <Picture
              source={thumbSrc}
              alt=""
              aspectRatio={4 / 3}
              radius="none"
              bordered={false}
              resizeMode="cover"
              recyclingKey={`${messageId}:${thumbSrc}`}
              onError={handleThumbError}
              className="w-full"
            />
          ) : (
            <View className="aspect-[4/3] w-full items-center justify-center bg-surface">
              <FilmStrip size={32} color={tokens.colors[mode].textTertiary} />
            </View>
          )}
          {/* Scrim lembut agar tombol putar terbaca di thumbnail terang. */}
          <View style={{ pointerEvents: "none" }} className="absolute inset-0 bg-overlay-soft" />
          <View style={{ pointerEvents: "none" }} className="absolute inset-0 items-center justify-center">
            <View className="rounded-full bg-surface-elevated p-3">
              <Play size={22} weight="fill" color={onElevated} />
            </View>
          </View>
          {/* Badge durasi kiri-bawah (kanan-bawah = jam bubble). */}
          {durationLabel || sizeLabel ? (
            <View
              style={{ pointerEvents: "none" }}
              className="absolute bottom-1.5 left-1.5 rounded-full bg-surface-elevated px-2 py-0.5"
            >
              <Text variant="caption" weight={700}>
                {[durationLabel, sizeLabel].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ) : null}
        </PressableScale>
        {/* Tombol layar penuh — SEJAJAR (bukan anak) area putar: Pressable
            bersarang RN memicu dua-duanya saat ketuk. */}
        <PressableScale
          onPress={onOpenFullscreen}
          accessibilityRole="button"
          accessibilityLabel={translate("Buka video layar penuh")}
          className="absolute right-1.5 top-1.5 rounded-full bg-surface-elevated p-1.5"
        >
          <ArrowsOut size={16} weight="bold" color={onElevated} />
        </PressableScale>
        </>
      )}

      {sending ? (
        <View className="absolute inset-0 items-center justify-center bg-overlay">
          <View className="flex-row items-center gap-2 rounded-full bg-surface-elevated px-3 py-1.5">
            <Spinner size="sm" />
            <Text variant="caption" weight={600}>
              {sendStatus === "queued" ? translate("Menunggu koneksi") : translate("Mengirim…")}
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
              accessibilityLabel={translate("Kirim ulang video {x}", { x: attachment.fileName })}
              className="flex-row items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1.5"
            >
              <View className="flex-row items-center gap-1.5">
                <ArrowClockwise size={14} weight="bold" color={onElevated} />
                <Text variant="caption" weight={700}>
                  {translate("Coba lagi")}
                </Text>
              </View>
            </PressableScale>
          ) : (
            <View className="rounded-full bg-surface-elevated px-3 py-1.5">
              <Text variant="caption" weight={600}>
                {translate("Belum terkirim")}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  )
})
