/**
 * Kahade — debounce trailing yang bisa di-flush (audit perf/UX P2, 2026-10-03).
 *
 * Berbeda dari `useDebouncedValue` (menunda NILAI untuk render), helper ini
 * menunda EFEK (penulisan storage) dan menyediakan `flush()` supaya efek
 * terakhir tidak pernah hilang saat app masuk background — risiko khas
 * penulisan ber-debounce di SecureStore: OS bisa mematikan proses sebelum
 * timer sempat menyala.
 *
 * Kontrak:
 *   - Hanya nilai TERAKHIR dalam jendela yang dikirim (trailing), sekali.
 *   - `flush()` mengirim segera (bila ada yang tertunda) dan membatalkan timer.
 *   - `cancel()` membuang yang tertunda tanpa mengirim.
 *   - Tidak ada timer yang menggantung setelah `flush()`/`cancel()`.
 */
export type TrailingDebounce<T> = {
  call: (value: T) => void
  flush: () => void
  cancel: () => void
  readonly pending: boolean
}

export function createTrailingDebounce<T>(
  run: (value: T) => void,
  delayMs: number,
): TrailingDebounce<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingValue: T | undefined
  let hasPending = false

  const clearTimer = () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  const fire = () => {
    clearTimer()
    if (!hasPending) return
    hasPending = false
    const value = pendingValue as T
    pendingValue = undefined
    run(value)
  }

  return {
    call(value: T) {
      pendingValue = value
      hasPending = true
      clearTimer()
      timer = setTimeout(fire, delayMs)
    },
    flush: fire,
    cancel() {
      clearTimer()
      hasPending = false
      pendingValue = undefined
    },
    get pending() {
      return hasPending
    },
  }
}
