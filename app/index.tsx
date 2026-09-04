/**
 * Kahade — gate rute awal (`/`).
 *
 * Memutuskan ke mana user diarahkan saat app dibuka:
 *   - belum pernah melihat intro  → /onboarding
 *   - sudah                       → /login (screen #7, dibuat di giliran berikut)
 *
 * Keputusan non-obvious:
 *   - Pembacaan flag async (SecureStore). Selama menunggu, TIDAK dirender
 *     apa pun: <AnimatedSplash> di root layout masih menutupi layar pada
 *     boot pertama, dan pembacaan Keychain hanya beberapa ms — spinner di
 *     sini justru memunculkan kedipan.
 *   - <Redirect>, bukan `router.replace` di effect: deklaratif dan aman dari
 *     race dengan mount navigator (rekomendasi Expo Router).
 *   - Cek sesi (access token → langsung ke Home) SENGAJA belum di sini;
 *     ditambahkan saat Home/Dashboard (screen #9) tersedia, agar gate ini
 *     tidak mengarahkan ke rute yang belum ada.
 */
import { useEffect, useState } from "react"
import { Redirect } from "expo-router"

import { hasSeenOnboarding } from "@/lib/onboarding"
import { ROUTES } from "@/lib/routes"

export default function Index() {
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    hasSeenOnboarding().then((v) => {
      if (alive) setSeen(v)
    })
    return () => {
      alive = false
    }
  }, [])

  if (seen === null) return null
  return <Redirect href={seen ? ROUTES.login : ROUTES.onboarding} />
}
