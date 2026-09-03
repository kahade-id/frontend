/**
 * Kahade — Animated splash overlay.
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
 * Keputusan:
 *   - Pakai RN `Animated`, bukan reanimated, agar tidak menambah dependensi
 *     hanya untuk splash. Ganti ke reanimated kalau nanti sudah ada di project.
 *   - Warna diambil dari tokens (light.background / primary), bukan CSS var,
 *     karena overlay ini render SEBELUM ThemeProvider & font siap.
 *   - Tidak ada shadow (§6). Logo placeholder = kotak radius.md dengan
 *     border; ganti <View> tersebut dengan <Image source={logo}> nanti.
 *   - Tidak pakai <Text> sama sekali di sini — font belum ada, menampilkan
 *     teks berarti FOUT yang justru ingin kita hindari.
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, StyleSheet, View } from "react-native"

import { tokens } from "@/lib/tokens"

type Props = {
  /** true = resource siap, mulai fade-out */
  ready: boolean
  /** dipanggil setelah fade-out selesai; parent harus unmount komponen ini */
  onFinish: () => void
}

const LOGO_SIZE = 72

export function AnimatedSplash({ ready, onFinish }: Props) {
  const pulse = useRef(new Animated.Value(1)).current
  const overlay = useRef(new Animated.Value(1)).current
  const loopRef = useRef<Animated.CompositeAnimation | null>(null)

  // Loop pulse — durasi "slow" dari tokens agar konsisten dengan motion system.
  useEffect(() => {
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
  }, [pulse])

  // Fade-out saat ready
  useEffect(() => {
    if (!ready) return
    loopRef.current?.stop()
    Animated.timing(overlay, {
      toValue: 0,
      duration: tokens.motion.duration.base,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish()
    })
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
            <Image source={require("../assets/images/logo-kahade.png")}
                   style={{ width: LOGO_SIZE, height: LOGO_SIZE }} /> */}
        <View style={styles.logoPlaceholder} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // Harus SAMA dengan `backgroundColor` splash di app.json supaya
    // handoff native -> JS mulus.
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
