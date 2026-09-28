/**
 * Kahade — helper validasi form (Batch 139, A04).
 */

import type { RefObject } from "react"

export type FocusableRef = { focus?: () => void } | null | undefined

/**
 * Fokuskan field pertama yang salah dari daftar ref berurutan.
 * Melewati ref yang belum terpasang (null) — aman dipanggil dengan ref
 * opsional.
 */
export function focusFirstInvalid(refs: RefObject<FocusableRef>[]): void {
  for (const ref of refs) {
    const target = ref?.current
    if (target && typeof target.focus === "function") {
      target.focus()
      return
    }
  }
}
