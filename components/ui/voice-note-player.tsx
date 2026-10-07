/**
 * Kahade — pemutar PESAN SUARA (voice note) di bubble chat.
 *
 * Satu audio per layar — eksklusi lewat registry terpusat di dalam
 * `useAudioPlayback` (dipakai bersama <AudioViewer>). Refresh signed URL
 * kedaluwarsa juga milik hook (maksimal sekali per URI).
 *
 * Fitur bubble (spesifikasi Bagian 2):
 *   - waveform 32 bar + playhead (bar terlewati memakai warna "aktif"),
 *   - ketuk waveform = seek (diukur dari `locationX`),
 *   - play/pause + label "M:SS / M:SS · sisa −M:SS",
 *   - kecepatan 1x → 1,5x → 2x (pilihan WhatsApp; milik hook),
 *   - status "Mengirim…" saat pesan masih optimistis.
 *
 * `seekEnabled=false` dipakai saat baris dalam mode pilih: ketukan memilih
 * pesan, bukan putar/seek.
 */
import { memo, useCallback, useRef, useState } from "react"
import { View } from "react-native"
import { Pause, Play } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { formatMediaClock } from "@/lib/media-viewer"
import { summarize } from "@/lib/a11y"
import { translate, useLanguage } from "@/lib/i18n"
import { useAudioPlayback } from "@/lib/use-audio-playback"

const BARS = 32

function barsFor(messageId: string): number[] {
  let seed = 7
  for (const ch of messageId) seed = (seed * 31 + ch.codePointAt(0)!) & 0xffff
  return Array.from({ length: BARS }, (_, i) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const wave = Math.sin(i * 0.55) * 0.28 + 0.5
    return Math.min(1, Math.max(0.12, wave + ((seed % 100) / 100) * 0.35))
  })
}

export type VoiceNotePlayerProps = {
  uri: string
  messageId: string
  /** "in" | "out" — warna waveform mengikuti sisi bubble. */
  direction: "in" | "out"
  /** Durasi detik dari server (fallback label sebelum metadata siap). */
  durationSeconds?: number | null
  /** false saat baris mode pilih (ketukan = pilih pesan). */
  seekEnabled?: boolean
  /** true saat pesan masih optimistis (queued/sending). */
  sending?: boolean
  onRefreshUrl?: (uri: string) => Promise<string | null>
}

export const VoiceNotePlayer = memo(function VoiceNotePlayer({
  uri,
  messageId,
  direction,
  durationSeconds,
  seekEnabled = true,
  sending = false,
  onRefreshUrl,
}: VoiceNotePlayerProps) {
  useLanguage()
  const { mode } = useTheme()
  const p = tokens.colors[mode]
  const refresh = useCallback(
    () => (onRefreshUrl ? onRefreshUrl(uri) : Promise.resolve(null)),
    [onRefreshUrl, uri],
  )
  const playback = useAudioPlayback({ uri, onRefreshUrl: onRefreshUrl ? refresh : undefined })
  const {
    positionMs,
    durationMs,
    remainingMs,
    progress,
    playing,
    loading,
    failed,
    rate,
    toggle,
    seekToFraction,
    cycleRate,
    retry,
  } = playback
  const [barHeights] = useState(() => barsFor(messageId))
  const waveWidth = useRef(0)

  const positionSec = positionMs / 1000
  const duration = durationMs > 0 ? durationMs / 1000 : (durationSeconds ?? null)
  const playedBars = Math.floor(progress * BARS)
  const remaining = durationMs > 0 ? remainingMs / 1000 : duration != null ? Math.max(0, duration - positionSec) : null

  // Warna waveform mengikuti sisi bubble: keluar = bg-primary → terang;
  // masuk = bg-surface → gelap. Mode-aware lewat primary/primaryForeground.
  const activeColor = direction === "out" ? p.primaryForeground : p.primary

  const handlePlayPause = useCallback(() => {
    if (!seekEnabled) return
    // Eksklusi antar-player sudah di dalam toggle (claimActive).
    if (failed) retry()
    else toggle()
  }, [failed, retry, seekEnabled, toggle])

  const handleSeek = useCallback(
    (locationX: number) => {
      if (!seekEnabled || waveWidth.current <= 0) return
      seekToFraction(Math.min(1, Math.max(0, locationX / waveWidth.current)))
    },
    [seekEnabled, seekToFraction],
  )

  const handleSpeed = useCallback(() => {
    if (!seekEnabled) return
    cycleRate()
  }, [cycleRate, seekEnabled])
  const speedLabel = rate === 1 ? "1x" : rate === 1.5 ? "1,5x" : "2x"

  const label = summarize([
    translate("Pesan suara {x}", { x: duration != null ? formatMediaClock(duration) : "–" }),
    loading
      ? translate("Memuat")
      : failed
        ? translate("Gagal dimuat")
        : playing
          ? translate("Diputar {x}", { x: formatMediaClock(positionSec) })
          : positionSec > 0
            ? translate("Jeda {x}", { x: formatMediaClock(positionSec) })
            : translate("Belum diputar"),
  ])

  // TANPA wrapper `accessible`: parent accessible menelan anak fokusable
  // (temuan gate F-08) — status lengkap justru ditempel di tombol putar.
  return (
    <View className="w-56">
      <View className="flex-row items-center gap-2">
        <PressableScale
          onPress={handlePlayPause}
          disabled={!seekEnabled}
          accessibilityRole="button"
          accessibilityLabel={summarize([playing ? translate("Jeda") : translate("Putar"), label])}
          accessibilityState={{ disabled: !seekEnabled }}
          className="rounded-full p-1"
        >
          {loading ? (
            <Spinner size="sm" />
          ) : playing ? (
            <Pause size={22} weight="fill" color={activeColor} />
          ) : (
            <Play size={22} weight="fill" color={activeColor} />
          )}
        </PressableScale>

        {/* Waveform ketuk-untuk-seek (visual dekoratif + label tombol). */}
        <PressableScale
          scaleOnPress={false}
          onPress={(e) => handleSeek(e.nativeEvent.locationX)}
          disabled={!seekEnabled}
          accessibilityRole="button"
          accessibilityLabel={translate("Ketuk waveform untuk melompat ke posisi")}
          className="h-9 flex-1 flex-row items-center gap-[2px]"
          onLayout={(e) => {
            waveWidth.current = e.nativeEvent.layout.width
          }}
        >
          {barHeights.map((h, i) => (
            <View
              key={i}
              style={{
                height: Math.max(4, h * 32),
                backgroundColor: activeColor,
                opacity: i < playedBars ? 1 : 0.35,
              }}
              className="w-[3px] shrink-0 rounded-[2px]"
            />
          ))}
        </PressableScale>

        <PressableScale
          onPress={handleSpeed}
          disabled={!seekEnabled}
          accessibilityRole="button"
          accessibilityLabel={translate("Kecepatan {x} — ketuk untuk mengubah", { x: speedLabel })}
          className="rounded-full px-1.5 py-1"
        >
          <Text variant="caption" weight={700} tone={direction === "out" ? "inverse" : "primary"}>
            {speedLabel}
          </Text>
        </PressableScale>
      </View>

      <Text variant="caption" tone={direction === "out" ? "inverse" : "secondary"} className="mt-0.5">
        {failed
          ? translate("Audio gagal dimuat — ketuk putar untuk coba lagi")
          : sending
            ? translate("Mengirim…")
            : `${formatMediaClock(positionSec)} / ${duration != null ? formatMediaClock(duration) : "–"}${
                remaining != null && duration != null && duration > 0
                  ? ` · ${translate("sisa {x}", { x: `−${formatMediaClock(remaining)}` })}`
                  : ""
              }`}
      </Text>
    </View>
  )
})
