import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Platform } from "react-native"
import { getSecureItem, SecureKeys } from "@/lib/secure-storage"
import { refreshAccessToken } from "@/lib/api/client"
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getSessionSnapshot,
  subscribeSession,
} from "@/lib/api/session"
import { userMessage } from "@/lib/api/errors"
import { logWarn } from "@/lib/telemetry"

/** B-05 (audit): snapshot server = "belum ada sesi", sepadan dengan store. */
const serverSnapshot = () => null
export function useAuthSession() {
  const token = useSyncExternalStore(subscribeSession, getSessionSnapshot, serverSnapshot)
  const [restoring, setRestoring] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setRestoring(true)
    setError(null)
    async function restore() {
      try {
        if ((await getSecureItem(SecureKeys.sessionSignedOut)) === "1") {
          await clearSession()
          return
        }
        const access = await getAccessToken()
        if (access) return
        /**
         * B-04 (audit): refresh dicoba TANPA syarat "ada refreshToken di
         * storage".
         *
         * Desain sesi repo ini adalah cookie HttpOnly `kahade_refresh_token`
         * (lihat catatan di `lib/api/session.ts`), sedangkan slot
         * `SecureKeys.refreshToken` hanya terisi bila backend mengirim
         * `refreshToken` di body. Syarat lama
         * `Platform.OS === "web" || (await getRefreshToken())` karena itu
         * membuat perangkat native yang hanya mengandalkan cookie TIDAK
         * PERNAH mencoba memulihkan sesi saat boot — sesi tampak terputus
         * tiap app dibuka dingin. Refresh sekarang selalu dicoba; endpoint
         * yang menjawab 401/403 mengembalikan `null` (bukan throw, lihat
         * `refreshAccessToken`), jadi "tidak punya sesi" tetap terbedakan
         * dari kegagalan jaringan.
         */
        const hadStoredRefresh = Boolean(await getRefreshToken())
        try {
          await refreshAccessToken()
        } catch (error) {
          // B-12 (audit): kegagalan pemulihan sesi SELALU punya jejak log —
          // ini kelas kegagalan yang paling sering berubah di produksi dan
          // sebelumnya ditelan tanpa satu pun sinyal ke lib/telemetry.
          logWarn("auth:restore-refresh", error)
          // Web: kegagalan di sini BUKAN kondisi galat yang memblokir
          // aplikasi — pengunjung web boleh memakai mode tamu (lihat
          // app/index.tsx & guest gate di root layout), jadi tidak
          // dilaporkan sebagai error pemulihan sesi.
          //
          // Native: hanya ditampilkan sebagai error bila memang ada bukti
          // sesi lokal (refresh token tersimpan) — instalasi baru yang
          // offline harus tetap mendarat di mode tamu, bukan di layar
          // "sesi belum dapat dipulihkan" (perilaku lama melewatkan refresh
          // sepenuhnya justru mengandalkan ini).
          if (Platform.OS !== "web" && hadStoredRefresh) throw error
        }
      } catch (error) {
        if (alive) setError(userMessage(error))
      } finally {
        if (alive) setRestoring(false)
      }
    }
    void restore()
    return () => {
      alive = false
    }
  }, [attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { token, restoring, error, retry }
}
