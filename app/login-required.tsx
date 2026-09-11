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

export default function LoginRequiredScreen() {
  const params = useLocalSearchParams<{ next?: string }>()
  const next = typeof params.next === "string" && params.next.startsWith("/")
    ? params.next
    : ""
  return <GuestLoginPrompt next={next} />
}
