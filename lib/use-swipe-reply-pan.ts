/**
 * Kahade — hook gesture "swipe kanan untuk balas" (2026-10-05).
 *
 * SATU sumber kebenaran pan swipe-reply, dipakai DUA pemilik area sentuh:
 *   - <ChatMessageBubble> (pemakaian langsung: layar bantuan, sengketa —
 *     gesture menempel di bubble), dan
 *   - <ChatMessageRow>  (thread ruang chat — gesture diperluas ke SELURUH
 *     baris, ala WhatsApp; bubble hanya menggambar translasi + hint).
 *
 * Keputusan non-obvious:
 *   - `activeOffsetX(12)` + `failOffsetY(8)`: pan hanya diklaim setelah
 *     gerakan horizontal jelas; gerakan vertikal kecil langsung menyerahkan
 *     gesture ke FlatList — scroll vertikal thread tidak boleh tersangkut
 *     (pola yang sama dengan <SwipeableListItem>). Konstanta di
 *     `@/lib/chat-bubble` supaya nilai ini ikut terkunci test.
 *   - Ambang balas & clamp (56px / 800px·s⁻¹ / maks 72px) DIBACA dari
 *     konstanta modul: ini nilai, bukan pemanggilan fungsi, sehingga aman
 *     di-capture worklet (sama seperti `tokens.motion.spring` yang sudah
 *     dipakai pan lama di bubble). JANGAN memanggil helper JS apa pun
 *     (mis. `clampSwipeReply`) dari dalam `onUpdate`/`onEnd` — itu penyebab
 *     force close bug #9 (2026-10-10); matematikanya ditulis inline.
 *   - 2026-10-08 (#11): gesture-nya DUA ARAH. `clampSwipeReply` menjepit ke
 *     -MAX..MAX (bukan 0..MAX) sehingga bubble benar-benar mengikuti jari ke
 *     kiri pun, dan ambangnya memakai nilai mutlak — geser kanan (WhatsApp)
 *     dan geser kiri (Telegram) dua-duanya membalas.
 *   - Callback pemicu disimpan di ref (`triggerRef`): handler pemanggil
 *     (mis. `setReplyTarget`) berubah identitas saat state layar berubah —
 *     tanpa ref, pan di-`useMemo` ulang dan gesture yang sedang berjalan
 *     kehilangan callback-nya.
 *   - `enabled=false` → `Gesture.Pan().enabled(false)` TANPA membuat closure
 *     worklet (perilaku sama dengan PERF-FIX lama di bubble): thread chat
 *     panjang tidak membayar 2 worklet per baris saat gesture memang mati
 *     (mode pilih / pesan terhapus / pesan sistem).
 *   - Reduce Motion: translasi mengikuti jari tetap ada (esensial untuk
 *     fungsi — pengecualian WCAG 2.3.3), hanya snap-back yang kehilangan
 *     spring.
 */
import { useCallback, useEffect, useMemo, useRef } from "react"
import { Gesture } from "react-native-gesture-handler"
import { runOnJS, withSpring, withTiming, type SharedValue } from "react-native-reanimated"

import {
  SWIPE_REPLY_ACTIVE_OFFSET_X,
  SWIPE_REPLY_FAIL_OFFSET_Y,
  SWIPE_REPLY_FLING_VELOCITY_PX_S,
  SWIPE_REPLY_MAX_PX,
  SWIPE_REPLY_THRESHOLD_PX,
} from "@/lib/chat-bubble"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type SwipeReplyPanOptions = {
  /** `false` = pan mati (mode pilih, pesan terhapus, pesan sistem, tanpa handler). */
  enabled: boolean
  /**
   * Nilai translasi yang digerakkan pan — dimiliki PEMILIK area sentuh, lalu
   * dibaca bubble untuk `translateX` + opacity/scale hint reply.
   */
  swipeX: SharedValue<number>
  /** Dipanggil (di JS thread) saat ambang balas terlewati. */
  onTrigger?: () => void
}

/** Pan swipe-reply siap dipasang ke <GestureDetector> milik baris atau bubble. */
export function useSwipeReplyPan({ enabled, swipeX, onTrigger }: SwipeReplyPanOptions) {
  const reduceMotion = useReducedMotion()
  const triggerRef = useRef(onTrigger)
  useEffect(() => {
    triggerRef.current = onTrigger
  }, [onTrigger])
  /**
   * Bug 1 (2026-10-08): worklet `onEnd` TIDAK boleh membaca `triggerRef.current`
   * langsung — Reanimated menyalin objek ref ke UI thread saat gesture dibuat,
   * jadi callback yang terpakai adalah snapshot pertama (stale). Gantinya,
   * worklet memanggil fungsi JS stabil ini lewat runOnJS, dan fungsi ini
   * membaca ref di JS thread (selalu nilai terbaru).
   */
  const fireTrigger = useCallback(() => {
    triggerRef.current?.()
  }, [])

  return useMemo(() => {
    if (!enabled) return Gesture.Pan().enabled(false)
    return (
      Gesture.Pan()
        .activeOffsetX(SWIPE_REPLY_ACTIVE_OFFSET_X)
        .failOffsetY(SWIPE_REPLY_FAIL_OFFSET_Y)
        .onUpdate((e) => {
          "worklet"
          // #11: ikuti jari ke DUA arah, dijepit ±MAX. Dulu `Math.max(0, …)`
          // membuat geser kiri tidak menggeser apa pun — gesture terasa mati.
          //
          // FORCE CLOSE (audit Pesan 2026-10-10, bug #9): penjepitan WAJIB
          // inline. Versi sebelumnya memanggil `clampSwipeReply(...)` — fungsi
          // JS biasa dari lib/chat-bubble — dari dalam worklet ini. Reanimated
          // menjalankan onUpdate di UI thread; fungsi non-worklet di sana
          // menjadi "remote function" dan pemanggilan sinkronnya melempar
          // ("Tried to synchronously call a non-worklet function on the UI
          // thread") → aplikasi tertutup paksa tepat saat jari mulai menggeser
          // bubble. Hanya KONSTANTA (nilai) yang boleh ditangkap di sini —
          // dikunci tests/chat-bubble-worklet-closures.test.ts.
          const x = e.translationX
          swipeX.value =
            x > SWIPE_REPLY_MAX_PX ? SWIPE_REPLY_MAX_PX : x < -SWIPE_REPLY_MAX_PX ? -SWIPE_REPLY_MAX_PX : x
        })
        .onEnd((e) => {
          "worklet"
          const triggered =
            Math.abs(swipeX.value) >= SWIPE_REPLY_THRESHOLD_PX ||
            Math.abs(e.velocityX) >= SWIPE_REPLY_FLING_VELOCITY_PX_S
          if (triggered) runOnJS(fireTrigger)()
          // Reduce Motion: snap-back INSTAN tanpa spring — yang dipertahankan
          // hanya translasi mengikuti jari (pengecualian WCAG 2.3.3).
          swipeX.value = reduceMotion
            ? withTiming(0, { duration: 0 })
            : withSpring(0, tokens.motion.spring)
        })
    )
  }, [enabled, reduceMotion, swipeX, fireTrigger])
}
