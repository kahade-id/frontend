/**
 * Kahade — <LoadingScreen> + <LoadingOverlay> (§8 "Loading full-screen").
 *
 * Dua momen loading yang memakai LOGO BRAND (bukan Spinner):
 *   - <LoadingScreen>  : pengganti isi layar saat fetch masuk halaman.
 *                        Logo mengambang di tengah dengan animasi loop halus.
 *                        Dipakai sebagai satu-satunya anak <Screen>.
 *   - <LoadingOverlay> : memblokir seluruh layar saat proses kritikal yang
 *                        tidak boleh diinterupsi (submit transaksi, verifikasi
 *                        PIN ke server). Portal + backdrop yang TIDAK bisa
 *                        di-tap, `z-modal`.
 *
 * Kapan TIDAK memakai ini: loading inline / pagination / dalam Button →
 * <Spinner> (§8: logo hanya untuk momen full-screen/signature agar tidak
 * terasa ramai).
 *
 * Animasi "loop halus" (non-obvious): scale 1 → 1.04 → 1 dan opacity
 * 1 → 0.7 → 1, bolak-balik dengan durasi `slow` (350ms) x2 per siklus dan
 * easing standar. Tidak ada rotasi/bounce — §1 "tenang". Transform & opacity
 * adalah hal yang tidak bisa di-className, jadi memakai RN Animated (native
 * driver) dengan className di View pembungkus, mengikuti pola PressableScale.
 */
import { useEffect, useRef, type ReactNode } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { Backdrop, useOverlayPresence } from "@/components/ui/backdrop"
import { Logo, type LogoSize } from "@/components/ui/logo"
import { Portal } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

const PULSE_SCALE = 1.04
const PULSE_OPACITY = 0.7

function usePulse(active = true) {
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!active) return
    const half = tokens.motion.duration.slow * 2
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: half,
          easing: Easing.bezier(...tokens.motion.easing.standard),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: half,
          easing: Easing.bezier(...tokens.motion.easing.standard),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [active, progress])

  return {
    scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, PULSE_SCALE] }),
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, PULSE_OPACITY] }),
  }
}

export type PulsingLogoProps = { size?: LogoSize; tone?: "default" | "inverse" }

/** Logo dengan animasi loop halus — dipakai LoadingScreen, LoadingOverlay, dan pull-to-refresh */
export function PulsingLogo({ size = "lg", tone = "default" }: PulsingLogoProps) {
  const { scale, opacity } = usePulse()
  return (
    <Animated.View style={{ opacity, transform: [{ scale }] }}>
      <Logo variant="mark" size={size} tone={tone} />
    </Animated.View>
  )
}

export type LoadingScreenProps = Omit<ViewProps, "children"> & {
  /** Teks pendek di bawah logo, mis. "Memuat transaksi" */
  message?: string
  className?: string
}

export function LoadingScreen({ message, className, ...rest }: LoadingScreenProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? "Memuat"}
      accessibilityLiveRegion="polite"
      className={cn("flex-1 items-center justify-center gap-6 py-16", className)}
      {...rest}
    >
      <PulsingLogo size="lg" />
      {message ? (
        <Text variant="body" tone="secondary" className="text-center">
          {message}
        </Text>
      ) : null}
    </View>
  )
}

export type LoadingOverlayProps = {
  visible: boolean
  message?: string
  /** Konten tambahan di bawah pesan (mis. "Jangan tutup aplikasi") */
  children?: ReactNode
  onHidden?: () => void
}

export function LoadingOverlay({ visible, message, children, onHidden }: LoadingOverlayProps) {
  const { mounted, progress } = useOverlayPresence(visible, { onHidden })
  if (!mounted) return null

  return (
    <Portal>
      <View className="absolute inset-0 z-modal">
        {/* Tanpa onPress: scrim tidak bisa di-tap — proses tidak boleh diinterupsi */}
        <Backdrop progress={progress} />
        <View pointerEvents="none" className="flex-1 items-center justify-center px-6">
          <Animated.View style={{ opacity: progress }}>
            <View
              accessibilityViewIsModal
              accessibilityRole="progressbar"
              accessibilityLabel={message ?? "Memproses"}
              className="items-center gap-5 rounded-md border border-border bg-surface-elevated px-8 py-6"
            >
              <PulsingLogo size="md" />
              {message ? (
                <Text variant="body" weight={600} className="text-center">
                  {message}
                </Text>
              ) : null}
              {children}
            </View>
          </Animated.View>
        </View>
      </View>
    </Portal>
  )
}
