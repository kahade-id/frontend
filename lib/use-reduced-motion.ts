import { useSyncExternalStore } from "react"
import { AccessibilityInfo, Platform } from "react-native"

// One platform subscription, shared by all controls, cards, charts and skeletons.
// Conservative native/SSR default avoids motion before the user's preference is known.
let reduced = true
const listeners = new Set<() => void>()
let dispose: (() => void) | undefined
function update(value: boolean) {
  if (value === reduced) return
  reduced = value
  for (const listener of listeners) listener()
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    let active = true
    if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia) {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)")
      update(media.matches)
      const change = () => update(media.matches)
      media.addEventListener?.("change", change)
      dispose = () => media.removeEventListener?.("change", change)
    } else {
      void AccessibilityInfo.isReduceMotionEnabled()
        .then((value) => {
          if (active) update(value)
        })
        .catch(() => undefined)
      const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", update)
      dispose = () => {
        active = false
        sub.remove()
      }
    }
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      dispose?.()
      dispose = undefined
    }
  }
}
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => reduced,
    () => true,
  )
}
export function motionDuration(reduced: boolean, ms: number): number {
  return reduced ? 0 : ms
}
