/**
 * Kahade — <TransactionProgressOverlay> (§6.2 layer modal, §8 signature motion).
 *
 * Full-screen portal yang menggantikan "tombol loading di sheet PIN" untuk
 * momen submit transaksi uang (transfer, withdraw, escrow, langganan). Tiga
 * state:
 *
 *   PROCESSING : ring berputar di sekitar ikon + logo berdenyut + pesan
 *                "sedang dikirim" — loop ambient, dipertahankan sampai
 *                promise API selesai (bukan fake-delay).
 *   SUCCESS    : ikon berubah centang (accent), spring pop sekali, pesan
 *                berubah. Overlay TIDAK menutup sendiri — parent yang
 *                memutuskan (biasanya setelah navigasi ke layar hasil).
 *   FAILURE    : ikon peringatan (danger), pesan error dari backend.
 *
 * Keputusan non-obvious:
 *   - Loop ambient memakai RN Animated (native driver) seperti AnimatedSplash/
 *     LoadingScreen, BUKAN reanimated: animasinya opacity/transform sederhana
 *     tanpa input gesture (pembagian kerja animasi di codebase ini).
 *   - Spinner = arc border yang berputar (border, bukan fill — §6 no-glow),
 *     didedikasikan untuk submit transaksi; <Spinner> generik tetap dipakai
 *     untuk loading inline. Loop 1200ms di luar rentang §8 karena ambient,
 *     preseden IncomingCallPrompt (1400ms).
 *   - Overlay TIDAK bisa ditutup (scrim tanpa onPress + pointerEvents none)
 *     — mutasi uang tidak boleh diinterupsi; hasil selalu tiba sebagai
 *     SUCCESS atau FAILURE, lalu parent yang menavigasi.
 *   - Modalitas SR (audit #3): useBlockingOverlay menyembunyikan layar di
 *     belakang; root accessible + live region polite sehingga perubahan
 *     "memproses → berhasil/gagal" dibacakan tanpa memindahkan fokus paksa.
 *   - Perubahan ikon proses→hasil: spring scale sekali (pop), warna ikon
 *     dari tokens langsung (bukan className) karena <Icon> memakai prop
 *     `color`, sama seperti pola IncomingCallPrompt/Icon.
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, View } from "react-native"

import { Backdrop, useOverlayPresence } from "@/components/ui/backdrop"
import { Portal, useBlockingOverlay } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { WarningCircle, CheckCircle } from "phosphor-react-native"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { useOverlayFocus } from "@/lib/use-overlay-focus"
import { useReducedMotion } from "@/lib/use-reduced-motion"

/** Satu putaran arc spinner — ambient loop, preseden IncomingCallPrompt. */
const SPIN_MS = 1200

export type TransactionProgressState = "PROCESSING" | "SUCCESS" | "FAILURE"

export type TransactionProgressOverlayProps = {
  visible: boolean
  state: TransactionProgressState
  /** Pesan saat memproses, mis. "Mengirim transfer ke @budi…" */
  processingMessage: string
  /** Pesan saat berhasil, mis. "Transfer berhasil" */
  successMessage?: string
  /** Pesan saat gagal — tampilkan userMessage(err) dari pemanggil */
  failureMessage?: string
  /** Ikon centang pengganti (default CheckCircle) */
  className?: string
  onHidden?: () => void
}

/**
 * Arc spinner: kontainer rounded-full dengan border transparan di 3 sisi dan
 * border warna di satu sisi, diputar loop. Diputar via useNativeDriver.
 */
function SpinningArc({ color }: { color: string }) {
  const rotate = useRef(new Animated.Value(0)).current
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion) {
      // Tanpa putaran: arc statis (indikator tetap terlihat, tidak berputar).
      rotate.setValue(0.35)
      return
    }
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [rotate, reducedMotion])

  return (
    <Animated.View
      style={{ transform: [{ rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}
      className="h-16 w-16 items-center justify-center rounded-full border-4 border-transparent"
    >
      {/* Sisi "aktif" arc dibentuk ring luar tipis berwarna accent */}
      <View className="absolute inset-0 rounded-full border-4" style={{ borderTopColor: color }} />
    </Animated.View>
  )
}

export function TransactionProgressOverlay({
  visible,
  state,
  processingMessage,
  successMessage = "Transaksi berhasil",
  failureMessage,
  className,
  onHidden,
}: TransactionProgressOverlayProps) {
  const { mounted, progress } = useOverlayPresence(visible, { onHidden })
  const { mode } = useTheme()
  const reducedMotion = useReducedMotion()
  const boxRef = useRef<View>(null)
  useBlockingOverlay(visible)
  useOverlayFocus(visible, boxRef)

  // Pop ikon sekali setiap kali masuk ke state hasil (false→true transisi
  // PROCESSING → SUCCESS/FAILURE). Reduced motion: tanpa pop, hanya ganti ikon.
  const pop = useRef(new Animated.Value(1)).current
  const prevState = useRef<TransactionProgressState>("PROCESSING")
  useEffect(() => {
    const justSettled = state !== "PROCESSING" && prevState.current === "PROCESSING"
    prevState.current = state
    if (!justSettled || reducedMotion) return
    pop.setValue(0.8)
    const anim = Animated.spring(pop, {
      toValue: 1,
      ...tokens.motion.springPlayful,
      useNativeDriver: true,
    })
    anim.start()
    return () => anim.stop()
  }, [state, pop, reducedMotion])

  if (!mounted) return null

  const failed = state === "FAILURE"
  const message =
    state === "SUCCESS" ? successMessage : state === "FAILURE" ? (failureMessage ?? "Transaksi gagal") : processingMessage

  // Warna ikon dari token langsung (Icon Phosphor menerima `color` prop,
  // bukan className) — pola yang sama dengan icon.tsx.
  const resultColor = failed
    ? mode === "dark"
      ? tokens.colors.semantic.danger.dark.fill
      : tokens.colors.semantic.danger.light.fill
    : mode === "dark"
      ? tokens.colors.accent.dark.fill
      : tokens.colors.accent.light.fill

  return (
    <Portal>
      <View className={cn("absolute inset-0 z-modal", className)}>
        {/* Tanpa onPress: scrim tidak bisa di-tap — mutasi tidak boleh diinterupsi */}
        <Backdrop progress={progress} />
        <View
          style={{ pointerEvents: "none", zIndex: 1 }}
          className="flex-1 items-center justify-center px-5"
        >
          <Animated.View style={{ opacity: progress }}>
            <View
              ref={boxRef}
              accessible
              accessibilityViewIsModal
              accessibilityLiveRegion="polite"
              accessibilityLabel={message}
              className="w-72 items-center gap-5 rounded-md border border-border bg-surface-elevated px-8 py-8"
            >
              <View className="h-16 w-16 items-center justify-center">
                {state === "PROCESSING" ? (
                  <SpinningArc color={resultColor} />
                ) : (
                  <Animated.View style={{ transform: [{ scale: pop }] }}>
                    <View
                      className={cn(
                        "h-16 w-16 items-center justify-center rounded-full",
                        failed ? "bg-danger-soft" : "bg-accent-soft",
                      )}
                    >
                      {failed ? (
                        <WarningCircle size={40} color={resultColor} weight="fill" />
                      ) : (
                        <CheckCircle size={40} color={resultColor} weight="fill" />
                      )}
                    </View>
                  </Animated.View>
                )}
              </View>

              <Text
                variant="body"
                weight={600}
                tone={state === "PROCESSING" ? "primary" : failed ? "danger" : "accent"}
                className="text-center"
              >
                {message}
              </Text>
              {state === "PROCESSING" ? (
                <Text variant="caption" tone="secondary" className="text-center text-pretty">
                  Jangan tutup aplikasi sampai proses selesai.
                </Text>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </View>
    </Portal>
  )
}
