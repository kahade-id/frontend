/**
 * Kahade — timer hasil transaksi dengan cleanup (A-14/G-06 audit 2026-09-20).
 *
 * Tiga wizard uang (transfer/withdraw/topup) + detail order + subscriptions
 * memakai pola identik: tampilkan overlay hasil RESULT_HOLD_MS lalu navigasi/
 * reset. Sebelumnya tiap `setTimeout(..., RESULT_HOLD_MS)` ditulis telanjang —
 * 8 tempat tanpa `clearTimeout` di unmount. Akibatnya: pengguna menekan back
 * dalam jendela 1,4 detik → setState setelah unmount dan NAVIGASI PAKSA dari
 * layar lain ke layar "done".
 *
 * Hook ini menyimpan id timer di ref dan membersihkannya saat unmount (pola
 * yang sudah dipakai create-transaction.tsx / edit-profile.tsx), sekaligus
 * membatalkan timer sebelumnya bila dijadwalkan ulang (anti tumpang-tindih).
 */
import { useCallback, useEffect, useRef } from "react"

/** Seberapa lama pesan sukses/gagal di overlay terlihat sebelum lanjut (ms). */
export const RESULT_HOLD_MS = 1400

export function useResultTimer() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  /** Jadwalkan `action` setelah RESULT_HOLD_MS; timer sebelumnya dibatalkan. */
  return useCallback((action: () => void) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      action()
    }, RESULT_HOLD_MS)
  }, [])
}
