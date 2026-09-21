/**
 * Stub `react-native-gesture-handler` untuk Vitest (config komponen).
 *
 * RNGH asli memuat TurboModule native (TurboModuleRegistry.getEnforcing)
 * saat import — tidak ada di jsdom. Di web app nyata pun RNGH tidak
 * dirender (useTransformAwarePressable memilih Pressable react-native-web),
 * jadi stub ini sekadar memenuhi impor level-modul: Pressable/ScrollView
 * diteruskan ke react-native(-web), GestureHandlerRootView = View.
 */
import type { PropsWithChildren } from "react"
import { Pressable, ScrollView, View } from "react-native"

export { Pressable, ScrollView }
export const GestureHandlerRootView = View

/**
 * `Gesture.Native()` dipakai <Tabs> untuk strip scrollable (agar geser
 * horizontal tidak dikunci PullToRefresh). Di jsdom tidak ada gesture — objek
 * kosong cukup karena <GestureDetector> di bawah meneruskan anaknya apa adanya.
 */
export const Gesture = {
  Native: () => ({}),
  Pan: () => ({}),
  Tap: () => ({}),
}

export function GestureDetector({ children }: PropsWithChildren) {
  return children
}

export default { Pressable, ScrollView, GestureHandlerRootView, Gesture, GestureDetector }
