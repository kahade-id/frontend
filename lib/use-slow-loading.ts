/**
 * Kahade — penanda "memuat terlalu lama" (audit chat I23; Bug 2, 2026-10-08).
 *
 * Hook menyala `delayMs` setelah `active` menjadi true dan padam begitu `active`
 * false. Layar memakainya untuk mengubah shimmer tanpa akhir menjadi galat yang
 * bisa dicoba ulang.
 *
 * `token` = identitas SATU percobaan muat. Mengganti token (mis. "Coba lagi")
 * membatalkan penanda yang sudah menyala: percobaan baru mulai dengan shimmer,
 * bukan langsung dengan galat sisa percobaan sebelumnya. Penanda ditandai
 * dengan token yang menyalakannya, jadi tidak ada frame stale saat token
 * berganti (nilai lama tidak cocok dengan token baru).
 */
import { useEffect, useState } from "react"

export function useSlowLoading(active: boolean, delayMs: number, token: number = 0): boolean {
  const [expiredToken, setExpiredToken] = useState<number | null>(null)
  useEffect(() => {
    if (!active) {
      // Penanda padam saat tidak aktif: aktif lagi (token sama) harus mulai dari nol.
      setExpiredToken(null)
      return
    }
    const timer = setTimeout(() => setExpiredToken(token), delayMs)
    return () => clearTimeout(timer)
  }, [active, delayMs, token])
  return active && expiredToken === token
}
