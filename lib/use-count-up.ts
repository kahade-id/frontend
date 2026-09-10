/**
 * Kahade — `useCountUp()` (v2 signature moment).
 *
 * Angka yang menganimasikan nilai LAMA → nilai BARU (kurva enter, durasi
 * `moment` 800ms) setiap `value` berubah — untuk saldo/nominal yang harus
 * terasa "bergerak", bukan melompat. Mount pertama TIDAK animasi (nilai awal
 * langsung tampil): count-up adalah respons atas PERUBAHAN, bukan reveal.
 *
 * Reduced motion / `enabled=false` → nilai final langsung, tanpa frame
 * perantara. NaN/non-finite tidak pernah dianimasikan (langsung tampil agar
 * tidak meracuni Animated.Value).
 *
 * Satu-satunya pemakaian animasi angka di app — jangan bikin count-up manual
 * di layar (variasikan `enabled`, bukan implementasi).
 */
import { useEffect, useRef, useState } from "react"
import { Animated, Easing } from "react-native"

import { tokens } from "./tokens"
import { useReducedMotion } from "./use-reduced-motion"

export function useCountUp(value: number, enabled = true): number {
  const reducedMotion = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (!enabled || reducedMotion || !Number.isFinite(value) || !Number.isFinite(from.current)) {
      from.current = value
      setDisplay(value)
      return
    }
    if (from.current === value) return
    const v = new Animated.Value(from.current)
    const id = v.addListener(({ value: current }) => setDisplay(Math.round(current)))
    const enter = tokens.motion.easing.enter
    const anim = Animated.timing(v, {
      toValue: value,
      duration: tokens.motion.duration.moment,
      easing: Easing.bezier(enter[0], enter[1], enter[2], enter[3]),
      useNativeDriver: false,
    })
    anim.start(({ finished }) => {
      v.removeListener(id)
      if (finished) {
        from.current = value
        setDisplay(value)
      }
    })
    return () => {
      v.removeListener(id)
      anim.stop()
      from.current = value
    }
  }, [value, enabled, reducedMotion])

  return display
}
