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
 *   - Warna diambil langsung dari `tokens.colors.brand`, bukan CSS var /
 *     className: overlay ini render SEBELUM ThemeProvider & font siap, jadi
 *     belum ada `vars()` di tree.
 *   - Splash TIDAK mengikuti light/dark. Ia permukaan brand yang sama dengan
 *     app icon: `brand.black` dengan mark `brand.white`, konstan di kedua
 *     mode. Karena itu `useColorScheme()` tidak lagi dibaca di sini. Literal
 *     `backgroundColor` + `dark.backgroundColor` di app.json dijaga sama
 *     dengan `brand.black` oleh `pnpm check:tokens` #8 — kalau salah satu
 *     berubah, handoff native→JS berkedip dan skrip gagal.
 *   - Tidak ada shadow (§6); mark flat monokrom sesuai design system v1.1.
 *   - Tidak pakai <Text> sama sekali di sini — font belum ada, menampilkan
 *     teks berarti FOUT yang justru ingin kita hindari.
 *   - Berada di components/ui/ (bukan components/) karena ia komponen
 *     visual biasa yang mengikuti tokens; hanya ThemeProvider yang tetap
 *     di luar ui/ karena ia infrastruktur, bukan UI.
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, StyleSheet } from "react-native"

import { LogoMark } from "@/components/ui/logo"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

/** Lebar kotak mark, dp. */
const LOGO_SIZE = 72

/**
 * Kanvas splash native = LOGO_SIZE * SPLASH_CANVAS_SCALE.
 *
 * Android 12+ selalu menggambar ikon splash pada 288dp dan memasking apa pun
 * di luar lingkaran 192dp di tengah — `imageWidth` tidak mengubahnya (sudah
 * diuji lewat prebuild). Maka aset splash dibuat dengan logo hanya mengisi
 * 1/4 kanvas, dan `imageWidth` di app.json = LOGO_SIZE * 4 = 288. Hasilnya
 * tinta tampil pada dp yang sama di splash native maupun di overlay ini,
 * sehingga logo tidak melompat saat serah terima. Dijaga `check:tokens` #8.
 */
export const SPLASH_CANVAS_SCALE = 4

export type AnimatedSplashProps = {
  /** true = resource siap, mulai fade-out */
  ready: boolean
  /** dipanggil setelah fade-out selesai; parent harus unmount komponen ini */
  onFinish: () => void
}


export function AnimatedSplash({ ready, onFinish }: AnimatedSplashProps) {
  const pulse = useRef(new Animated.Value(1)).current
  const overlay = useRef(new Animated.Value(1)).current
  const loopRef = useRef<Animated.CompositeAnimation | null>(null)
  // Reduce Motion (audit #2): tanpa pulse berulang; fade-out tetap ada
  // (perlu untuk handoff native->JS tanpa kedip) tetapi instan.
  const reducedMotion = useReducedMotion()
  // Mode OS langsung dari react-native (bukan useTheme — belum ada provider).

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

  }, [ready, overlay, onFinish])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.overlay,
        // Harus SAMA dengan `backgroundColor` / `dark.backgroundColor` plugin
        // expo-splash-screen di app.json supaya handoff native -> JS mulus.
        // Dijaga mesin oleh `pnpm check:tokens` #8, bukan hanya komentar.
        //
        // brand.black KONSTAN di light & dark: splash adalah permukaan brand
        // yang sama dengan app icon, bukan permukaan aplikasi. Kalau di sini
        // dipakai palette.background (putih di light), layar akan berkedip
        // hitam -> putih tepat setelah splash native hitam menghilang.
        { backgroundColor: tokens.colors.brand.black, opacity: overlay },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={{ opacity: pulse }}>
        {/* <LogoMark>, bukan <Logo>: komponen ini hidup di LUAR ThemeProvider
            (lihat catatan di logo.tsx) sehingga useTheme() akan melempar.
            Vektor, bukan <Image> bitmap — tajam di densitas mana pun dan
            ukurannya sama persis dengan splash native, jadi logo tidak
            melompat saat serah terima. Warna dari token, bukan literal. */}
        <LogoMark size={LOGO_SIZE} fill={tokens.colors.brand.white} />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // backgroundColor di-set inline dari `tokens.colors.brand.black`.
    alignItems: "center",
    justifyContent: "center",
    // Tidak ada `zIndex.toast` (§9.11: Toast ditiadakan, semua lewat Banner=70).
    // Splash harus di atas Banner sekalipun, hanya saat boot.
    zIndex: tokens.zIndex.banner + 1,
  },
})
