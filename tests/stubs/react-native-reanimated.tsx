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
 *
 * Yang TIDAK di-emulasi: worklet sungguhan, kurva spring/timing, entering/
 * exiting, layout animation, gesture. Test yang butuh itu milik e2e, bukan di
 * sini.
 */
import { useEffect, useMemo, useReducer } from "react"
import { View, type ViewProps } from "react-native"

type Listener = () => void
const listeners = new Set<Listener>()

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

export function createAnimatedComponent<T>(component: T): T {
  return component
}

const Animated = {
  View: AnimatedView,
  ScrollView: View,
  Text: View,
  createAnimatedComponent,
}

export default Animated
