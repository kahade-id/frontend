/**
 * Kahade — gate rute awal (`/`).
 *
 * Memutuskan ke mana user diarahkan saat app dibuka:
 *   - masih punya access token     → /home (sesi lanjut; bila token sudah
 *     kedaluwarsa, client akan refresh atau memancarkan `sessionExpired`
 *     yang di root layout mengarahkan ke /login)
 *   - belum pernah melihat intro   → /onboarding
 *   - sudah                        → /login (screen #7)
 *
 * Keputusan non-obvious:
 *   - Pembacaan flag async (SecureStore). Selama menunggu, TIDAK dirender
 *     apa pun: <AnimatedSplash> di root layout masih menutupi layar pada
 *     boot pertama, dan pembacaan Keychain hanya beberapa ms — spinner di
 *     sini justru memunculkan kedipan.
 *   - <Redirect>, bukan `router.replace` di effect: deklaratif dan aman dari
 *     race dengan mount navigator (rekomendasi Expo Router).
 *   - Cek sesi dan flag onboarding dibaca PARALEL (keduanya SecureStore)
 *     supaya boot tidak menunggu dua round-trip Keychain berurutan.
 */
import { useEffect, useState } from "react"
import { Redirect } from "expo-router"

import { getAccessToken } from "@/lib/api"
import { hasSeenOnboarding } from "@/lib/onboarding"
import { ROUTES } from "@/lib/routes"

type Gate = "home" | "login" | "onboarding"

export default function Index() {
  const [gate, setGate] = useState<Gate | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      getAccessToken().catch(() => null),
      hasSeenOnboarding().catch(() => false),
    ]).then(([token, seen]) => {
      if (!alive) return
      setGate(token ? "home" : seen ? "login" : "onboarding")
    })
    return () => {
      alive = false
    }
  }, [])

  if (gate === null) return null
  return (
    <Redirect
      href={gate === "home" ? ROUTES.home : gate === "login" ? ROUTES.login : ROUTES.onboarding}
    />
  )
}
