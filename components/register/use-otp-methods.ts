/**
 * Kahade — useOtpMethods(): metode pengiriman OTP yang ditawarkan backend.
 *
 * Memanggil `GET /v1/auth/otp-methods` sekali saat screen Register mount.
 *
 * Keputusan non-obvious:
 *   - Tidak memakai SWR/React Query: keduanya belum ada di package.json dan
 *     aturan proyek melarang menambah dependency dari screen. Satu request
 *     kecil tanpa cache lintas layar cukup dengan useEffect + guard
 *     `cancelled` (mencegah setState setelah unmount / race saat refetch).
 *   - Fallback ke SEMUA metode spec (`OTP_METHODS`) bila request gagal atau
 *     backend mengembalikan daftar kosong/tidak dikenal. Alasan: layar
 *     Register tidak boleh buntu hanya karena endpoint pelengkap tumbang —
 *     `request-otp` tetap memvalidasi `method` di server, sehingga pilihan
 *     yang tidak didukung akan ditolak di sana dengan pesan yang jelas.
 *     `source` diekspos agar screen tahu ini daftar asli atau fallback
 *     (untuk logging; UI tidak membedakan supaya tidak "berteriak").
 *   - Selama `loading`, `methods` kosong — screen merender skeleton, bukan
 *     fallback, supaya pilihan tidak "melompat" saat data asli tiba.
 */
import { useCallback, useEffect, useState } from "react"

import { api, OTP_METHODS, type OtpMethod } from "@/lib/api"

export type OtpMethodsState = {
  methods: OtpMethod[]
  loading: boolean
  /** "server" = dari backend; "fallback" = daftar spec karena request gagal/kosong */
  source: "server" | "fallback" | null
  refetch: () => void
}

export function useOtpMethods(): OtpMethodsState {
  const [methods, setMethods] = useState<OtpMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<OtpMethodsState["source"]>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    api.auth
      .getOtpMethods()
      .then((res) => {
        if (cancelled) return
        if (res.methods.length > 0) {
          setMethods(res.methods)
          setSource("server")
        } else {
          if (__DEV__) console.warn("[kahade/otp-methods] daftar kosong/tidak dikenal; memakai fallback spec")
          setMethods([...OTP_METHODS])
          setSource("fallback")
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (__DEV__) console.warn("[kahade/otp-methods] gagal memuat; memakai fallback spec:", err)
        setMethods([...OTP_METHODS])
        setSource("fallback")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  return { methods, loading, source, refetch }
}
