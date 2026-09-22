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
  /**
   * H-09 (audit 2026-09-22): dulu HANYA SATU timer. Kalau satu layar punya
   * dua alur yang menghasilkan hasil (mis. pembayaran DAN terima pesanan, atau
   * aksi pengguna DAN hasil polling yang tiba bersamaan), alur kedua diam-diam
   * MEMBATALKAN yang pertama — salah satu hasil tidak pernah tampil dan
   * overlay menggantung selamanya. Sekarang timer dipisah per `key`:
   * pengulangan dengan key yang sama tetap saling mengganti (yang terbaru
   * menang), tetapi antar-alur tidak lagi saling menghapus.
   */
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t)
      timers.current.clear()
    },
    [],
  )

  /**
   * Jadwalkan `action` setelah RESULT_HOLD_MS. `key` = nama alur (mis. "pay",
   * "accept"); default "default" untuk layar dengan satu alur.
   */
  return useCallback((action: () => void, key = "default") => {
    const existing = timers.current.get(key)
    if (existing) clearTimeout(existing)
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key)
        action()
      }, RESULT_HOLD_MS),
    )
  }, [])
}
