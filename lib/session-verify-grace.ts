/**
 * Kahade — jendela toleransi verifikasi sesi (P0-2, audit perf/UX 2026-10-03).
 *
 * MASALAH: restorasi sesi optimistis (ST-002) merender aplikasi SEBELUM
 * verifikasi background selesai — `token` masih null sementara `verifying`
 * true. Guard `Boolean(session.token)` membuat `Stack.Protected` mencabut
 * seluruh layar ber-auth pada frame itu; begitu verifikasi selesai, stack
 * ter-mount ulang dari nol. Pengguna "terlempar" dari layar yang sedang
 * dibuka (mis. deep link ke /dispute/123) padahal sesinya masih sah.
 *
 * SOLUSI: guard menganggap sesi hidup selama `verifying` — TAPI dibatasi
 * jendela 10 detik. Verifikasi yang tidak selesai dalam jendela itu bukan lagi
 * "sebentar lagi siap": perlakukan sebagai sesi kedaluwarsa dan jalankan alur
 * P0-1 (`emitSessionExpired()` → handler root layout memutuskan pemulihan
 * lembut vs alur lama). Tanpa batas ini, promise verifikasi yang menggantung
 * menahan seluruh stack tanpa token selamanya — layar hidup, tetapi setiap
 * request 401.
 *
 * Modul ini sengaja tanpa `react-native`: kontrak waktu murninya
 * (`isVerificationWithinGrace`) bisa diuji langsung di konfigurasi node.
 */
import { useEffect, useRef, useState } from "react"

/** Lama jendela toleransi (audit: 10 detik). */
export const SESSION_VERIFY_GRACE_MS = 10_000

/**
 * Apakah toleransi verifikasi masih terbuka? Murni supaya batasnya eksplisit
 * dan bisa diuji — tepat pada 10.000 ms jendela SUDAH TUTUP.
 */
export function isVerificationWithinGrace(input: {
  verifying: boolean
  elapsedMs: number
}): boolean {
  if (!input.verifying) return false
  return input.elapsedMs < SESSION_VERIFY_GRACE_MS
}

/**
 * Hook: true selama `verifying` berjalan tanpa token DAN masih di dalam
 * jendela 10 detik. Saat jendela habis, `onExpired` dipanggil SEKALI (bukan
 * berulang tiap render) dan nilai kembali false.
 *
 * `onExpired` disimpan di ref supaya identitas callback pemanggil tidak
 * me-restart timer — jendela dihitung dari saat `verifying` menyala, bukan
 * dari render terakhir.
 */
export function useSessionVerifyGrace(input: {
  verifying: boolean
  token: string | null
  onExpired: () => void
}): boolean {
  const { verifying, token, onExpired } = input
  const [withinGrace, setWithinGrace] = useState(() => isVerificationWithinGrace({ verifying, elapsedMs: 0 }))
  const onExpiredRef = useRef(onExpired)

  useEffect(() => {
    onExpiredRef.current = onExpired
  }, [onExpired])

  useEffect(() => {
    if (!verifying || token) {
      setWithinGrace(false)
      return
    }
    setWithinGrace(true)
    const timer = setTimeout(() => {
      setWithinGrace(false)
      onExpiredRef.current()
    }, SESSION_VERIFY_GRACE_MS)
    return () => clearTimeout(timer)
  }, [verifying, token])

  return withinGrace
}
