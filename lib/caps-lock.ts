/**
 * Kahade — deteksi Caps Lock untuk field kata sandi (Batch 139, A02) — [Web].
 *
 * Browser mengekspos status Caps Lock lewat
 * `KeyboardEvent.getModifierState("CapsLock")` pada keydown/keyup. React
 * Native tidak meneruskannya ke TextInput, jadi hook ini memasang listener
 * di level `document` dan hanya aktif saat field yang bersangkutan fokus.
 *
 * - Web saja: di native tidak ada konsep Caps Lock keyboard fisik yang
 *   relevan; hook selalu `false` di iOS/Android.
 * - Tidak mengungkap isi field: hanya boolean, tidak pernah membaca value.
 * - Peringatan direset saat field kehilangan fokus.
 */

import { useEffect, useRef, useState } from "react"
import { Platform } from "react-native"

type ModifierEvent = {
  getModifierState?: (key: string) => boolean
} | null | undefined

/** Pembaca murni status Caps Lock dari sebuah keyboard event (mudah diuji). */
export function isCapsLockOnEvent(event: ModifierEvent): boolean {
  try {
    return event?.getModifierState?.("CapsLock") === true
  } catch {
    return false
  }
}

/**
 * `true` bila Caps Lock terdeteksi aktif saat field fokus (web saja).
 * Pasang `isFocused=true` saat TextInput fokus, `false` saat blur.
 */
export function useCapsLockWarning(isFocused: boolean): boolean {
  const [capsOn, setCapsOn] = useState(false)
  const focusedRef = useRef(isFocused)
  focusedRef.current = isFocused

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return
    const update = (e: KeyboardEvent) => {
      if (!focusedRef.current) return
      setCapsOn(isCapsLockOnEvent(e))
    }
    document.addEventListener("keydown", update)
    document.addEventListener("keyup", update)
    return () => {
      document.removeEventListener("keydown", update)
      document.removeEventListener("keyup", update)
    }
  }, [])

  // Peringatan hanya relevan selama field fokus.
  useEffect(() => {
    if (!isFocused) setCapsOn(false)
  }, [isFocused])

  return capsOn
}
