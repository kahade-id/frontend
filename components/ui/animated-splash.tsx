/**
 * Kahade — <AnimatedSplash> overlay boot (§8 motion, §6 no-shadow, §6.2 z-index).
 *
 * Native splash (expo-splash-screen) hanya bisa menampilkan gambar statis.
 * Untuk animasi loop, pola yang direkomendasikan Expo (contoh
 * `with-splash-screen`) adalah: sembunyikan native splash SEGERA setelah
 * React mount, dan tampilkan overlay JS ini di atasnya dengan background +
 * logo yang identik, sehingga transisi native -> JS tidak terlihat.
 *
 * Overlay ini:
 *   - loop pulse halus (opacity 1 -> 0.55 -> 1) selama `ready === false`
 *   - saat `ready` berubah true: fade-out lalu unmount (onFinish)
 *
 * Keputusan non-obvious:
 *   - Tetap RN `Animated` (native driver), BUKAN reanimated — walaupun
 *     reanimated kini sudah dipakai Slider/BottomSheet/PullToRefresh.
 *     Pembagian kerja di codebase: reanimated untuk animasi yang DIKENDALIKAN
 *     GESTURE (butuh shared value di UI thread yang dibaca worklet), RN
 *     Animated untuk opacity/transform sederhana tanpa input (FadeIn,
 *     PressableScale, splash ini). Native driver sudah menjalankan loop ini
 *     di UI thread; memakai reanimated tidak menambah kehalusan, hanya
 *     menambah satu bahasa animasi lagi di file yang harus tetap kecil.
 *   - Warna diambil dari tokens (light.background / primary), bukan CSS var
 *     / className, karena overlay ini render SEBELUM ThemeProvider & font
 *     siap — belum ada `vars()` di tree. Konsekuensinya splash selalu light;
 *     ini disengaja: harus identik dengan `backgroundColor` splash di
 *     app.json, yang juga statis.
 *   - Tidak ada shadow (§6). Logo placeholder = kotak radius.md dengan
 *     border; ganti <View> tersebut dengan <Image source={logo}> nanti.
 *   - Tidak pakai <Text> sama sekali di sini — font belum ada, menampilkan
 *     teks berarti FOUT yang justru ingin kita hindari.
 *   - Berada di components/ui/ (bukan components/) karena ia komponen
 *     visual biasa yang mengikuti tokens; hanya ThemeProvider yang tetap
 *     di luar ui/ karena ia infrastruktur, bukan UI.
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"

import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type AnimatedSplashProps = {
  /** true = resource siap, mulai fade-out */
  ready: boolean
  /** dipanggil setelah fade-out selesai; parent harus unmount komponen ini */
  onFinish: () => void
}

const LOGO_SIZE = 72

export function AnimatedSplash({ ready, onFinish }: AnimatedSplashProps) {
  const pulse = useRef(new Animated.Value(1)).current
  const overlay = useRef(new Animated.Value(1)).current
  const loopRef = useRef<Animated.CompositeAnimation | null>(null)
  // Reduce Motion (audit #2): tanpa pulse berulang; fade-out tetap ada
  // (perlu untuk handoff native->JS tanpa kedip) tetapi instan.
  const reducedMotion = useReducedMotion()

  // Loop pulse — durasi "slow" dari tokens agar konsisten dengan motion system.
  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(1)
      return
    }
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: tokens.motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: tokens.motion.duration.slow * 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loopRef.current.start()
    return () => loopRef.current?.stop()
  }, [pulse, reducedMotion])

  // Fade-out saat ready
  useEffect(() => {
    if (!ready) return
    loopRef.current?.stop()
    Animated.timing(overlay, {
      toValue: 0,
      duration: motionDuration(reducedMotion, tokens.motion.duration.base),
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish()
    })
    // `reducedMotion` sengaja tidak di deps: dibaca sekali saat ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, overlay, onFinish])

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity: overlay }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={{ opacity: pulse }}>
        {/* PLACEHOLDER LOGO — ganti dengan:
            <Image source={require("../../assets/images/logo-kahade.png")}
                   style={{ width: LOGO_SIZE, height: LOGO_SIZE }} /> */}
        <View style={styles.logoPlaceholder} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Harus SAMA dengan `backgroundColor` plugin expo-splash-screen di
    // app.json supaya handoff native -> JS mulus. Kesamaan ini dijaga
    // mesin oleh `pnpm check:tokens` (audit #9), bukan hanya komentar.
    backgroundColor: tokens.colors.light.background,
    alignItems: "center",
    justifyContent: "center",
    // Tidak ada `zIndex.toast` (§9.11: Toast ditiadakan, semua lewat Banner=70).
    // Splash harus di atas Banner sekalipun, hanya saat boot.
    zIndex: tokens.zIndex.banner + 1,
  },
  logoPlaceholder: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: tokens.radius.md, // 8px — maksimum non-pill (§5)
    borderWidth: tokens.borderWidth.default,
    borderColor: tokens.colors.light.primary,
    backgroundColor: tokens.colors.light.surface,
  },
})
