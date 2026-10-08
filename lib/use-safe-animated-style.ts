/**
 * Kahade — `useSafeAnimatedStyle`: `useAnimatedStyle` dengan fallback (Bug 1, 2026-10-08).
 *
 * Kenapa ada (non-obvious):
 *   Updater `useAnimatedStyle` dijalankan di UI thread (runtime Worklets). Fungsi
 *   JS biasa yang dipanggil dari dalam updater TIDAK bisa dieksekusi di sana:
 *   Worklets mengubahnya menjadi remote function, dan pemanggilan sinkron
 *   melempar "[Worklets] Tried to synchronously call a Remote Function". Di build
 *   release, exception itu lepas ke scheduler native UI-thread — BUKAN ke error
 *   boundary React — sehingga app putih lalu macet (lihat chat-message-bubble).
 *
 *   Pertahanan berlapis:
 *     1. Updater harus menghitung dari NILAI (angka / konstanta yang sudah
 *        dihitung di JS thread), tidak memanggil helper JS. Itu perbaikan
 *        utamanya dan dikunci oleh tests/chat-bubble-worklet-closures.test.ts.
 *     2. Hook ini membungkus updater dengan try/catch di sisi UI thread. Bila
 *        updater tetap melempar, style jatuh ke `fallback` (keadaan diam yang
 *        tampil normal), dan galatnya dilaporkan ke JS — sekali per pesan galat,
 *        karena updater bisa berjalan tiap frame.
 *
 *   Updater WAJIB memakai direktif `"worklet"` (mis. `() => { "worklet"; ... }`)
 *   supaya bisa dibawa ke UI thread lewat pembungkus ini.
 */
import type { ViewStyle } from "react-native"
import { useAnimatedStyle, runOnJS } from "react-native-reanimated"

import { captureError } from "@/lib/telemetry"

/** Pesan galat yang sudah dilaporkan — dedupe (maks. 20 entri per sesi). */
const reportedFallbacks = new Set<string>()
const MAX_REPORTED_FALLBACKS = 20

/** Dipanggil di JS thread lewat runOnJS. */
function reportWorkletFallback(message: string): void {
  if (reportedFallbacks.has(message) || reportedFallbacks.size >= MAX_REPORTED_FALLBACKS) return
  reportedFallbacks.add(message)
  captureError("reanimated:worklet-fallback", new Error(message))
}

export function useSafeAnimatedStyle<Style extends ViewStyle>(
  updater: () => Style,
  fallback: Style,
) {
  return useAnimatedStyle(() => {
    "worklet"
    try {
      return updater()
    } catch (err) {
      runOnJS(reportWorkletFallback)(err instanceof Error ? err.message : String(err))
      return fallback
    }
  })
}
