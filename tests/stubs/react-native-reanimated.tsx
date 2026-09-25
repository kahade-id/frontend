/**
 * Stub `react-native-reanimated` untuk Vitest (config komponen).
 *
 * Kenapa ada: reanimated menarik `react-native-worklets`, yang memanggil
 * TurboModuleRegistry saat IMPORT (`NativeWorkletsModule.ts`) — tidak ada di
 * jsdom, sama persis dengan alasan stub `react-native-gesture-handler`. Tanpa
 * stub, komponen beranimasi (<Tabs>, <BottomSheet>, …) tidak bisa dirender di
 * test sama sekali.
 *
 * Yang di-emulasi (cukup untuk MENGAMATI hasil animasi di DOM):
 *   - `useSharedValue`: kotak `{ value }` yang menotifikasi pemakai saat diisi,
 *     sehingga perubahan nilai memicu render ulang seperti di runtime asli.
 *   - `useAnimatedStyle`: worklet dipanggil tiap render → style animasi
 *     terbaca sebagai objek biasa oleh react-native-web.
 *   - `Animated.View`: <View> biasa yang merender ulang saat shared value
 *     berubah (di app nyata ini pekerjaan layer native).
 *   - `withSpring`/`withTiming`/`withDelay`: LANGSUNG ke nilai target (snap).
 *     Test memeriksa TUJUAN animasi, bukan kurva waktunya.
 *   - `interpolate`/`interpolateColor`/`Extrapolation` (mode-switcher): nilai
 *     diskrit yang benar di titik-titik kontrol — angka diinterpolasi linear,
 *     warna mengambil titik kontrol terdekat (pembandingan warna persis di
 *     tengah interpolasi bukan objek test komponen).
 *
 * Yang TIDAK di-emulasi: worklet sungguhan, kurva spring/timing, entering/
 * exiting, layout animation, gesture. Test yang butuh itu milik e2e, bukan di
 * sini.
 */
import { useEffect, useMemo, useReducer } from "react"
import { Text, View, type TextProps, type ViewProps } from "react-native"

type Listener = () => void
const listeners = new Set<Listener>()

/** Mode ekstrapolasi — hanya CLAMP yang mengubah hasil stub (pembatasan ujung). */
export const Extrapolation = {
  CLAMP: "clamp",
  EXTEND: "extend",
  IDENTITY: "identity",
} as const

/**
 * Interpolasi linear pada titik-titik kontrol; di luar rentang mengikuti
 * mode (CLAMP = nilai ujung, EXTEND = melanjutkan kemiringan segmen terakhir).
 */
export function interpolate(
  value: number,
  input: readonly number[],
  output: readonly number[],
  extrapolate?: string | { extrapolateLeft?: string; extrapolateRight?: string },
): number {
  const mode = typeof extrapolate === "string" ? extrapolate : extrapolate?.extrapolateRight
  if (input.length === 0 || output.length === 0) return value
  if (value <= input[0]!) {
    if (mode === Extrapolation.CLAMP) return output[0]!
    const slope = input.length > 1 ? (output[1]! - output[0]!) / (input[1]! - input[0]!) : 0
    return output[0]! + slope * (value - input[0]!)
  }
  const last = input.length - 1
  if (value >= input[last]!) {
    if (mode === Extrapolation.CLAMP) return output[last]!
    const slope =
      input.length > 1 ? (output[last]! - output[last - 1]!) / (input[last]! - input[last - 1]!) : 0
    return output[last]! + slope * (value - input[last]!)
  }
  for (let i = 0; i < last; i++) {
    if (value >= input[i]! && value <= input[i + 1]!) {
      const t = (value - input[i]!) / (input[i + 1]! - input[i]!)
      return output[i]! + t * (output[i + 1]! - output[i]!)
    }
  }
  return output[last]!
}

/** Interpolasi warna — titik kontrol terdekat (lihat docblock atas). */
export function interpolateColor(
  value: number,
  input: readonly number[],
  output: readonly (string | number)[],
): string | number {
  for (let i = 0; i < input.length - 1; i++) {
    const mid = (input[i]! + input[i + 1]!) / 2
    if (value < mid) return output[i]!
  }
  return output[output.length - 1]!
}

function notify() {
  for (const listener of [...listeners]) listener()
}

/** Render ulang pemakai saat ada shared value yang diisi. */
function useValueSubscription() {
  const [, forceRender] = useReducer((count: number) => count + 1, 0)
  useEffect(() => {
    listeners.add(forceRender)
    return () => {
      listeners.delete(forceRender)
    }
  }, [forceRender])
}

/** Kotak nilai yang bisa ditulis; penulisannya membangunkan Animated.View. */
export function useSharedValue<T>(initial: T): { value: T } {
  return useMemo(() => {
    let current = initial
    return {
      get value() {
        return current
      },
      set value(next: T) {
        current = next
        notify()
      },
    }
  }, [])
}

/**
 * Dipanggil setiap render — nilai shared terbaca apa adanya. Komponen pemanggil
 * ikut berlangganan notifikasi: di runtime asli shared value memperbarui view
 * native langsung, di sini perubahan nilai memicu render ulang komponen yang
 * punya style-nya supaya props style yang turun ke <View> ikut segar.
 */
export function useAnimatedStyle<T extends object>(worklet: () => T): T {
  useValueSubscription()
  return worklet()
}

export function useDerivedValue<T>(worklet: () => T): { value: T } {
  return useMemo(() => ({ value: worklet() }), [])
}

/** Snap ke target: test memeriksa tujuan animasi, bukan kurva. */
export function withSpring<T>(to: T): T {
  return to
}
export function withTiming<T>(to: T): T {
  return to
}
export function withDelay<T>(_delayMs: number, animation: T): T {
  return animation
}
export function withRepeat<T>(animation: T): T {
  return animation
}
export function runOnJS<T>(fn: T): T {
  return fn
}
export function runOnUI<T>(fn: T): T {
  return fn
}
export const Easing = {
  bezier: () => () => 0,
  linear: () => 0,
  ease: () => 0,
  out: (fn: () => number) => fn,
}

function AnimatedView(props: ViewProps) {
  useValueSubscription()
  return <View {...props} />
}

function AnimatedText(props: TextProps) {
  useValueSubscription()
  return <Text {...props} />
}

export function createAnimatedComponent<T>(component: T): T {
  return component
}

const Animated = {
  View: AnimatedView,
  ScrollView: View,
  Text: AnimatedText,
  createAnimatedComponent,
}

export default Animated
