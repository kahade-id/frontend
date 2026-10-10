/**
 * Kahade — Rute ajakan login (web guest mode).
 *
 * Root layout umumnya menampilkan <GuestLoginPrompt> sebagai lapisan tanpa
 * pindah rute, tetapi ROUTES.loginRequired juga bisa dibuka langsung
 * (mis. tautan eksternal / deep link web); keduanya memakai komponen yang
 * sama. Layar ini publik dan tidak masuk AUTHENTICATED_SCREENS. Di native
 * gate pembuka tetap onboarding/login sehingga layar ini praktis tak
 * terpakai, tetapi aman dirender.
 */
import { useLocalSearchParams } from "expo-router"

import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { sanitizeNextPath } from "@/lib/login-redirect"

export default function LoginRequiredScreen() {
  const params = useLocalSearchParams<{ next?: string }>()
  // #FE-N1: sanitasi terpusat — `//host` / skema tidak boleh menjadi tujuan.
  const next = sanitizeNextPath(params.next) ?? ""
  return <GuestLoginPrompt next={next} />
}
