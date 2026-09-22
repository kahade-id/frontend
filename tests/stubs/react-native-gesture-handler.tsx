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
 * Pembangun gesture yang RANTAI (chainable) — D-03.
 *
 * Sebelumnya setiap `Gesture.Pan()` mengembalikan `{}` sehingga rangkaian
 * `.enabled(...).activeOffsetX(...)` meledak dengan "is not a function" begitu
 * ada test yang merender komponen ber-gesture (mis. SwipeableListItem di
 * baseline S5). Di jsdom tidak ada gesture nyata: yang penting konfigurasi
 * rantai tetap bisa dijalankan sampai selesai, lalu hasilnya diteruskan apa
 * adanya oleh <GestureDetector>. Metodenya didaftarkan eksplisit — bukan Proxy —
 * supaya pemakaian API RNGH yang SALAH ketemu sebagai error jelas di test.
 */
const CHAINABLE_METHODS = [
  "enabled",
  "activeOffsetX",
  "activeOffsetY",
  "failOffsetX",
  "failOffsetY",
  "hitSlop",
  "minDistance",
  "minPointers",
  "maxPointers",
  "minDuration",
  "maxDuration",
  "maxDeltaX",
  "maxDeltaY",
  "numberOfTaps",
  "numberOfPointers",
  "activateAfterLongPress",
  "shouldCancelWhenOutside",
  "simultaneousWithExternalGesture",
  "requireExternalGestureToFail",
  "blocksExternalGesture",
  "withRef",
  // Callback: cukup dicatat supaya test bisa memanggil `gesture.handlers` bila perlu.
  "onBegin",
  "onStart",
  "onUpdate",
  "onChange",
  "onEnd",
  "onFinalize",
  "onTouchesDown",
  "onTouchesMove",
  "onTouchesUp",
  "onTouchesCancelled",
  "runOnJS",
] as const

type ChainableGesture = Record<string, unknown> & {
  /** Handler terakhir per nama — dipakai test yang ingin memicu gestur. */
  __handlers: Record<string, (...args: unknown[]) => unknown>
}

const HANDLER_METHODS = new Set<string>([
  "onBegin",
  "onStart",
  "onUpdate",
  "onEnd",
  "onFinalize",
  "onTouchesDown",
  "onTouchesMove",
  "onTouchesUp",
  "onTouchesCancelled",
])

function createGesture(kind: string): ChainableGesture {
  const gesture = { __kind: kind, __handlers: {} } as ChainableGesture
  for (const method of CHAINABLE_METHODS) {
    gesture[method] = (...args: unknown[]) => {
      if (HANDLER_METHODS.has(method) && typeof args[0] === "function") {
        gesture.__handlers[method] = args[0] as (...a: unknown[]) => unknown
      }
      return gesture
    }
  }
  return gesture
}

/**
 * `Gesture.Native()` dipakai <Tabs> untuk strip scrollable (agar geser
 * horizontal tidak dikunci PullToRefresh); `Pan`/`Tap`/`LongPress` dipakai
 * komponen interaktif. Semua mengembalikan pembangun rantai di atas.
 */
export const Gesture = {
  Native: () => createGesture("Native"),
  Pan: () => createGesture("Pan"),
  Tap: () => createGesture("Tap"),
  LongPress: () => createGesture("LongPress"),
  Pinch: () => createGesture("Pinch"),
  Race: (...gestures: unknown[]) => gestures,
  Simultaneous: (...gestures: unknown[]) => gestures,
  Exclusive: (...gestures: unknown[]) => gestures,
}

export function GestureDetector({ children }: PropsWithChildren) {
  return children
}

export default { Pressable, ScrollView, GestureHandlerRootView, Gesture, GestureDetector }
