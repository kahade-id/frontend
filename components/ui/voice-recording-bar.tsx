/**
 * Kahade — <VoiceRecordingBar> bar rekaman yang MENGGANTIKAN kolom ketik
 * composer selama voice note direkam (audit chat C7).
 *
 *   menahan   [● 0:07]            ‹ Geser untuk batal      (mic di kanan)
 *   terkunci  [🗑] [● 0:23]  Rekaman terkunci               (mic → Kirim)
 *
 * Petunjuk batal bergeser/memudar mengikuti `cancelProgress` (shared value
 * milik hook — tidak ada render per piksel) dan berubah merah ("Lepas untuk
 * membatalkan") begitu jari melewati ambang, supaya rekaman tidak terbuang
 * tanpa peringatan.
 *
 * Keputusan non-obvious:
 *   - Timer + titik sebagai SATU elemen `timer` dengan label di-quantize 5
 *     detik (pola UX-A11Y-007 lembar perekam): live region "polite" tidak
 *     membacakan tiap 250 ms.
 *   - Titik berdenyut statis bila Reduce Motion aktif.
 *   - Warna titik dari token semantic.danger (bukan className bg-*).
 */
import { CaretLeft, Trash } from "phosphor-react-native"
import { useEffect } from "react"
import { View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

import { useTheme } from "@/components/theme-provider"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { translate, useLanguage } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { formatVoiceNoteDuration } from "@/lib/voice-note"

/** Pengumuman durasi di-quantize supaya pembaca layar tidak spam. */
const SPOKEN_QUANTUM_MS = 5_000
/** Jarak (px) petunjuk batal ikut bergeser ke kiri saat jari digeser. */
const HINT_SLIDE_PX = 28

export type VoiceRecordingBarProps = {
  phase: "holding" | "locked"
  durationMs: number
  cancelProgress: SharedValue<number>
  /** Ambang batal terlewati — dilepas sekarang = dibuang. */
  cancelArmed: boolean
  onDiscard: () => void
}

export function VoiceRecordingBar({
  phase,
  durationMs,
  cancelProgress,
  cancelArmed,
  onDiscard,
}: VoiceRecordingBarProps) {
  useLanguage()
  const { mode } = useTheme()
  const reducedMotion = useReducedMotion()
  const dangerFill = tokens.colors.semantic.danger[mode].fill
  const locked = phase === "locked"

  const pulse = useSharedValue(1)
  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 1
      return
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: tokens.motion.duration.slow * 2 }),
        withTiming(1, { duration: tokens.motion.duration.slow * 2 }),
      ),
      -1,
      false,
    )
    return () => {
      pulse.value = 1
    }
  }, [pulse, reducedMotion])
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  const hintStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.5 * cancelProgress.value,
    transform: [{ translateX: reducedMotion ? 0 : -HINT_SLIDE_PX * cancelProgress.value }],
  }))

  const spokenMs = Math.floor(durationMs / SPOKEN_QUANTUM_MS) * SPOKEN_QUANTUM_MS

  return (
    <View className="min-h-12 flex-1 flex-row items-center gap-2 pl-1">
      {locked ? (
        <IconButton
          icon={Trash}
          variant="ghost"
          size="md"
          shape="pill"
          accessibilityLabel={translate("Buang rekaman")}
          onPress={onDiscard}
        />
      ) : null}
      <View
        className="flex-row items-center gap-2 pl-2"
        accessible
        accessibilityRole="timer"
        accessibilityLiveRegion="polite"
        accessibilityLabel={translate("Merekam {x}", { x: formatVoiceNoteDuration(spokenMs) })}
      >
        <Animated.View
          style={[dotStyle, { backgroundColor: dangerFill }]}
          className="h-3 w-3 rounded-full"
        />
        <Text variant="bodyLarge" weight={600} tone="primary" className="tabular-nums">
          {formatVoiceNoteDuration(durationMs)}
        </Text>
      </View>
      {locked ? (
        <Text variant="caption" tone="secondary" className="min-w-0 flex-1" numberOfLines={1}>
          {translate("Rekaman terkunci")}
        </Text>
      ) : (
        <Animated.View style={hintStyle} className="min-w-0 flex-1 flex-row items-center justify-end gap-1">
          <Icon icon={CaretLeft} size="xs" tone={cancelArmed ? "danger" : "default"} />
          <Text
            variant="caption"
            tone={cancelArmed ? "danger" : "secondary"}
            weight={cancelArmed ? 600 : 400}
            numberOfLines={1}
            className="shrink"
          >
            {cancelArmed ? translate("Lepas untuk membatalkan") : translate("Geser untuk batal")}
          </Text>
        </Animated.View>
      )}
    </View>
  )
}
