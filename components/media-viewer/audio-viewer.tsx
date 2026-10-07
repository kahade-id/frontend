/**
 * Kahade — audio viewer halaman media terpusat (`type=audio`).
 *
 * §spek (pengecualian DARK_ALLOWLIST): teks/ikon putih di atas hitam solid
 * kedua mode — preseden showcase-media-gallery (kontrol di atas media).
 *
 * Voice note / audio full-screen: waveform besar yang bisa diketuk untuk seek,
 * tombol putar/jeda besar, kecepatan 1x/1.5x/2x, durasi total + sisa, error
 * jujur + retry. Logika putar SAMA PERSIS dengan bubble (hook
 * `useAudioPlayback`) — satu suara dalam satu waktu di seluruh aplikasi.
 */
import { useMemo, useRef } from "react"
import { View } from "react-native"
import { Pause, Play } from "phosphor-react-native"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { tokens } from "@/lib/tokens"
import { hitSlopToReach } from "@/lib/hit-slop"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { useAudioPlayback } from "@/lib/use-audio-playback"
import { decorativeWaveform, formatVoiceNoteDuration } from "@/lib/voice-note"

const WAVEFORM_BARS = 56
const BAR_MAX_HEIGHT = 64
const CHROME_WHITE = tokens.colors.light.primaryForeground

export type AudioViewerProps = {
  url: string
  title?: string | null
  fileName?: string | null
  onRefreshUrl?: () => Promise<string | null>
}

export function AudioViewer({ url, title, fileName, onRefreshUrl }: AudioViewerProps) {
  useLanguage()
  const playback = useAudioPlayback({ uri: url, onRefreshUrl })
  const bars = useMemo(() => decorativeWaveform(url, WAVEFORM_BARS), [url])
  const playedBars = Math.floor(playback.progress * bars.length)
  const waveformWidth = useRef(0)

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-black px-8">
      {/* Judul berkas. */}
      <View className="items-center gap-1">
        <Text variant="body" weight={600} numberOfLines={2} ellipsizeMode="middle" className="text-center text-white">
          {title ?? fileName ?? translate("Pesan suara")}
        </Text>
        <Text variant="caption" className="text-white opacity-70 tabular-nums">
          {playback.failed
            ? translate("Tidak bisa diputar")
            : `${formatVoiceNoteDuration(playback.positionMs)} / ${formatVoiceNoteDuration(playback.durationMs)}`}
        </Text>
      </View>

      {/* Waveform besar — ketuk untuk seek (proporsional terhadap lebar). */}
      <PressableScale
        onPress={(event) => {
          // locationX relatif terhadap waveform → fraksi posisi.
          const x = (event.nativeEvent as { locationX?: number }).locationX ?? 0
          // Lebar diukur dari layout; 1 = fallback anti bagi-nol.
          const w = waveformWidth.current || 1
          playback.seekToFraction(x / w)
        }}
        onLayout={(event) => {
          waveformWidth.current = event.nativeEvent.layout.width
        }}
        disabled={playback.loading || playback.failed || playback.durationMs <= 0}
        accessibilityRole="adjustable"
        accessibilityLabel={translate("Posisi putar {x} dari {y}", {
          x: formatVoiceNoteDuration(playback.positionMs),
          y: formatVoiceNoteDuration(playback.durationMs),
        })}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          playback.seekByMs(event.nativeEvent.actionName === "increment" ? 10_000 : -10_000)
        }}
        className="w-full"
      >
        <View className="h-20 w-full flex-row items-center gap-[3px]">
          {bars.map((level, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: Math.max(4, Math.round(level * BAR_MAX_HEIGHT)),
                borderRadius: tokens.radius.full,
                backgroundColor: CHROME_WHITE,
              }}
              className={i < playedBars ? undefined : "opacity-30"}
            />
          ))}
        </View>
      </PressableScale>

      {/* Sisa waktu + kecepatan. */}
      <View className="flex-row items-center gap-4">
        <Text variant="body" className="text-white opacity-80 tabular-nums">
          −{formatVoiceNoteDuration(playback.remainingMs)}
        </Text>
        <PressableScale
          onPress={() => playback.cycleRate()}
          accessibilityRole="button"
          accessibilityLabel={translate("Kecepatan putar {x} — ketuk untuk mengubah", {
            x: `${playback.rate}x`,
          })}
          hitSlop={hitSlopToReach(44, 32)}
          className="rounded-full bg-white px-4 py-1.5"
        >
          <Text variant="body" weight={700} className="text-black tabular-nums">
            {`${playback.rate}x`}
          </Text>
        </PressableScale>
      </View>

      {/* Tombol putar besar / loading / retry. */}
      {playback.loading ? (
        <View className="items-center gap-2" accessible accessibilityRole="progressbar" accessibilityLabel={translate("Memuat audio…")}>
          <Spinner size="md" tone="inverse" />
          <Text variant="body" className="text-white">
            {translate("Memuat audio…")}
          </Text>
        </View>
      ) : playback.failed ? (
        <View className="items-center gap-2">
          <Text variant="body" className="px-4 text-center text-white opacity-80">
            Audio gagal dimuat. Periksa koneksi — jika dari pesan lama, tautannya mungkin sudah kedaluwarsa.
          </Text>
          <PressableScale
            onPress={() => playback.retry()}
            accessibilityRole="button"
            accessibilityLabel={translate("Coba putar ulang")}
            className="mt-1 rounded-full bg-white px-6 py-2.5"
          >
            <Text variant="body" weight={600} className="text-black">
              {translate("Coba lagi")}
            </Text>
          </PressableScale>
        </View>
      ) : (
        <PressableScale
          onPress={() => playback.toggle()}
          accessibilityRole="button"
          accessibilityLabel={playback.playing ? translate("Jeda") : translate("Putar")}
          hitSlop={tokens.space[3]}
          className="items-center justify-center rounded-full bg-white p-6"
        >
          <Icon
            icon={playback.playing ? Pause : Play}
            size="lg"
            weight="fill"
            color={tokens.colors.light.primary}
          />
        </PressableScale>
      )}
    </View>
  )
}
