/**
 * Kahade — gate rute awal (`/`).
 *
 * Memutuskan ke mana user diarahkan saat app dibuka:
 *   - WEB: selalu ke tab pertama (Etalase — Beranda dihapus). Pengunjung boleh
 *     menelusuri aplikasi tanpa login (guest mode); layar yang butuh akun
 *     menampilkan ajakan login (<LoginRequiredScreen>, digerakkan dari root
 *     layout). Splash/onboarding seperti aplikasi native juga tidak dipakai
 *     di web.
 *   - NATIVE, masih punya access token → ROUTES.home (= /showcase, sesi
 *     lanjut; bila token kedaluwarsa, client akan refresh atau memancarkan
 *     `sessionExpired` yang di root layout mengarahkan ke /login)
 *   - NATIVE, belum pernah melihat intro → /onboarding
 *   - NATIVE, sudah → /login
 *
 * Keputusan non-obvious:
 *   - Pembacaan flag async (SecureStore). Selama menunggu, TIDAK dirender
 *     apa pun: <AnimatedSplash> di root layout masih menutupi layar pada
 *     boot pertama native, dan pembacaan Keychain hanya beberapa ms —
 *     spinner di sini justru memunculkan kedipan.
 *   - <Redirect>, bukan `router.replace` di effect: deklaratif dan aman dari
 *     race dengan mount navigator (rekomendasi Expo Router).
 *   - Cek sesi dan flag onboarding dibaca PARALEL (keduanya SecureStore)
 *     supaya boot tidak menunggu dua round-trip Keychain berurutan.
 */
import { useCallback, useEffect, useState } from "react"
import { Platform } from "react-native"
import { Redirect } from "expo-router"

import { getAccessToken } from "@/lib/api"
import { hasSeenOnboarding } from "@/lib/onboarding"
import { logWarn } from "@/lib/telemetry"
import { ROUTES } from "@/lib/routes"

import { ErrorState } from "@/components/ui/error-state"
import { Screen } from "@/components/ui/screen"

type Gate = "home" | "login" | "onboarding"

export default function Index() {
  const [gate, setGate] = useState<Gate | null>(null)
  /**
   * B-09 (audit): kegagalan BACA Keychain/Keystore (reject) sebelumnya
   * disamakan dengan "tidak ada token" (null) — error transien OS melempar
   * pengguna yang MASIH LOGIN ke layar login. Kini dibedakan: reject → layar
   * retry, bukan keputusan gate.
   */
  const [storageError, setStorageError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    // Web: guest mode — langsung beranda tanpa splash/onboarding/login.
    if (Platform.OS === "web") {
      setGate("home")
      return
    }
    let alive = true
    setStorageError(false)
    Promise.all([
      getAccessToken().catch((err) => {
        logWarn("boot-gate:read-token", err)
        throw err
      }),
      hasSeenOnboarding().catch(() => false),
    ])
      .then(([token, seen]) => {
        if (!alive) return
        setGate(token ? "home" : seen ? "login" : "onboarding")
      })
      .catch(() => {
        if (alive) setStorageError(true)
      })
    return () => {
      alive = false
    }
  }, [attempt])

  if (storageError) {
    return (
      <Screen edges={["top"]}>
        <ErrorState
          title="Sesi belum dapat diperiksa"
          description="Penyimpanan aman perangkat sedang tidak dapat dibaca. Coba lagi — data login Anda tidak hilang."
          onRetry={retry}
        />
      </Screen>
    )
  }
  if (gate === null) return null
  return (
    <Redirect
      href={gate === "home" ? ROUTES.home : gate === "login" ? ROUTES.login : ROUTES.onboarding}
    />
  )
}
