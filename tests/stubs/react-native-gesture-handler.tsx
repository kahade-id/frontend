/**
 * Stub `react-native-gesture-handler` untuk Vitest (config komponen).
 *
 * RNGH asli memuat TurboModule native (TurboModuleRegistry.getEnforcing)
 * saat import — tidak ada di jsdom. Di web app nyata pun RNGH tidak
 * dirender (useTransformAwarePressable memilih Pressable react-native-web),
 * jadi stub ini sekadar memenuhi impor level-modul: Pressable/ScrollView
 * diteruskan ke react-native(-web), GestureHandlerRootView = View.
 */
import { Pressable, ScrollView, View } from "react-native"

export { Pressable, ScrollView }
export const GestureHandlerRootView = View
export default { Pressable, ScrollView, GestureHandlerRootView }
