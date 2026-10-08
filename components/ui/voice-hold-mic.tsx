/**
 * Kahade — <VoiceHoldMic> tombol mic "tahan untuk merekam, geser untuk
 * mengunci" ala WhatsApp (audit chat C7).
 *
 *   - TAP        → `onTap` (fallback: membuka lembar perekam lama — satu-satunya
 *                  jalan bagi pengguna TalkBack/Switch Access yang tidak bisa
 *                  menahan dan menggeser).
 *   - TAHAN      → mulai merekam (≥ VOICE_HOLD_MS); lepas = kirim.
 *   - GESER ATAS → kunci: jari boleh diangkat, tombol berubah jadi "Kirim".
 *   - GESER KIRI → lepas = batal (UI bar rekaman mengikuti).
 *
 * Komponen ini hanya GESTUR + tampilan tombol/kapsul kunci. Semua keputusan
 * ada di `useVoiceHold`; bar rekaman (timer, petunjuk batal) milik composer
 * (<VoiceRecordingBar>) karena menggantikan kolom ketik.
 *
 * Keputusan non-obvious:
 *   - Gestur `Pan().activateAfterLongPress()` + `Tap()` dalam `Exclusive`: tap
 *     cepat (< waktu tahan) membuat Pan gagal lalu Tap menang; tahan membuat
 *     Pan menang dan Tap tidak pernah menembak. Callback berjalan di thread JS
 *     (`runOnJS(true)`) — semua handler hook stabil, jadi gestur dibuat SEKALI
 *     (membuat ulang di tengah tahan memutus rekaman).
 *   - `minDistance` dinaikkan: selama jeda tahan, jari yang bergeser lebih dari
 *     ambang membuat Pan GAGAL — jari wajar bergetar beberapa piksel.
 *   - Tombol bukan <Pressable>: gestur RNGH + Pressable pada node yang sama
 *     saling berebut responder di Android. Aksesibilitas dipasang manual
 *     (role button + aksi "activate" → tap).
 *   - Warna dari token + `useTheme` (ikon/latar dinamis), animasi lewat
 *     Reanimated; Reduce Motion mematikan skala/kenaikan kapsul (fungsi tetap).
 */
import { LockSimple, Microphone, PaperPlaneRight } from "phosphor-react-native"
import { useEffect, useMemo, useRef } from "react"
import { View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

import { useTheme } from "@/components/theme-provider"
import { Icon } from "@/components/ui/icon"
import { translate, useLanguage } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"
import type { VoiceHoldController } from "@/lib/use-voice-hold"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { VOICE_HOLD_MS } from "@/lib/voice-note-gesture"

/** Jarak (px) kapsul kunci naik mengikuti jari. */
const LOCK_CAPSULE_RISE_PX = 28
/** Toleransi (px) getar jari selama jeda tahan sebelum gestur dianggap gagal. */
const HOLD_JITTER_PX = 24
/** Skala tombol saat menahan (umpan balik "sedang merekam"). */
const HOLD_SCALE = 1.35

export type VoiceHoldMicProps = {
  voice: VoiceHoldController
  /** Ketuk saat tidak merekam (membuka lembar perekam). */
  onTap?: () => void
  /** Label aksesibilitas mode awal (mis. "Rekam pesan suara"). */
  label: string
  disabled?: boolean
}

export function VoiceHoldMic({ voice, onTap, label, disabled = false }: VoiceHoldMicProps) {
  useLanguage()
  const { mode } = useTheme()
  const reducedMotion = useReducedMotion()
  const palette = tokens.colors[mode]
  const dangerFill = tokens.colors.semantic.danger[mode].fill

  const { phase, lockProgress } = voice
  const recording = phase === "holding"
  const locked = phase === "locked"

  // Ketukan: terkunci → kirim; idle → buka lembar perekam. Dibaca lewat ref
  // supaya gestur tidak dibuat ulang tiap render.
  const tapRef = useRef<() => void>(() => undefined)
  tapRef.current = () => {
    if (disabled) return
    if (locked) voice.send()
    else if (phase === "idle") onTap?.()
  }

  const { handleBegin, handleHoldStart, handleDrag, handleRelease } = voice
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(VOICE_HOLD_MS)
      .minDistance(HOLD_JITTER_PX)
      .onBegin(() => handleBegin())
      .onStart(() => handleHoldStart())
      .onUpdate((e) => handleDrag(e.translationX, e.translationY))
      .onFinalize(() => handleRelease())
    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd((_e, success) => {
        if (success) tapRef.current()
      })
    return Gesture.Exclusive(pan, tap)
  }, [handleBegin, handleHoldStart, handleDrag, handleRelease])

  // Skala tombol: membesar saat menahan, normal selain itu.
  const scale = useSharedValue(1)
  useEffect(() => {
    const target = recording ? HOLD_SCALE : 1
    scale.value = reducedMotion ? target : withTiming(target, { duration: tokens.motion.duration.press })
  }, [recording, reducedMotion, scale])
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  // Kapsul kunci naik mengikuti progres geser ke atas.
  const capsuleStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * lockProgress.value,
    transform: [{ translateY: reducedMotion ? 0 : -LOCK_CAPSULE_RISE_PX * lockProgress.value }],
  }))

  const a11yLabel = locked ? translate("Kirim pesan suara") : label
  const a11yHint = locked
    ? undefined
    : translate("Ketuk untuk membuka perekam. Tahan untuk merekam, geser ke atas untuk mengunci.")

  const background = recording ? dangerFill : locked ? palette.primary : "transparent"
  const iconTone = recording || locked ? "inverse" : "active"

  return (
    <View className="h-12 w-12 items-center justify-center">
      {recording ? (
        // Petunjuk visual semata — pembaca layar tidak perlu membacanya.
        <Animated.View
          style={capsuleStyle}
          className="absolute bottom-full mb-2"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <View className="items-center justify-center rounded-full border border-border bg-surface-elevated p-2">
            <Icon icon={LockSimple} size="sm" tone="active" />
          </View>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={buttonStyle}
          accessible
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint={a11yHint}
          accessibilityState={{ disabled }}
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={() => tapRef.current()}
          collapsable={false}
        >
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: background }}
          >
            <Icon
              icon={locked ? PaperPlaneRight : Microphone}
              size="md"
              weight={recording || locked ? "fill" : "regular"}
              tone={iconTone}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
