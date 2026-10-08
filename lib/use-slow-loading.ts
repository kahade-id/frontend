/**
 * Kahade — penanda "memuat terlalu lama" (audit chat I23).
 *
 * Shimmer tanpa penjelasan yang berlangsung belasan detik terbaca sebagai
 * layar yang macet. Hook ini menyala `delayMs` setelah `active` menjadi true
 * dan padam begitu `active` false; layar memakainya untuk menambahkan
 * penjelasan + tombol "Coba lagi" di bawah shimmer.
 */
import { useEffect, useState } from "react"

export function useSlowLoading(active: boolean, delayMs: number): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setSlow(true), delayMs)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [active, delayMs])
  return slow
}
