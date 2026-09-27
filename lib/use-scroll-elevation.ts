/**
 * Kahade — `useScrollElevation`: efek elevasi header saat daftar di-scroll.
 *
 * Mengembalikan `elevated` (boolean) untuk prop `<Header elevated>` dan
 * `onScrollWorklet` untuk `<PaginatedList onScrollWorklet>`. `onScrollWorklet`
 * dipanggil di JS thread (lihat pull-to-refresh.tsx), jadi `setState` aman.
 * State hanya berubah saat melewati ambang — tidak ada re-render per frame.
 *
 * Dipakai tab Transaksi, Pesan, dan Notifikasi (permintaan produk 2026-09-27).
 */
import { useCallback, useRef, useState } from "react"

export function useScrollElevation(threshold = 8) {
  const [elevated, setElevated] = useState(false)
  const ref = useRef(false)

  const onScrollWorklet = useCallback(
    (y: number) => {
      const next = y > threshold
      if (next !== ref.current) {
        ref.current = next
        setElevated(next)
      }
    },
    [threshold],
  )

  return { elevated, onScrollWorklet }
}
