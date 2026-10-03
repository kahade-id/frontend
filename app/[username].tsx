/**
 * Kahade — rute publik `/<username>` (gaya Instagram, keputusan 1 Okt 2026).
 *
 * Tautan https://kahade.id/<username> yang dibuka di perangkat terverifikasi
 * (App Links / Universal Links) mendarat di sini, lalu diteruskan ke rute
 * internal `/user/[username]` (satu sumber tampilan profil).
 *
 * Keputusan non-obvious:
 *   - Rute statis (mis. `/transfer`, `/vouchers`, `/help`) menang atas rute
 *     dinamis ini di expo-router — jadi tidak perlu dikecualikan manual.
 *     Daftar `RESERVED` di bawah hanya untuk kata yang BUKAN rute (mis.
 *     `/admin`, `/api`, `/p`, `/v`, `/r`) agar tidak dicoba sebagai username.
 *     Validasi reserved words saat pembuatan username adalah ranah backend +
 *     web landing; di sini hanya pengaman tampilan.
 *   - Tanpa import berat (thin shell): UserProfileScreen dimuat via rute
 *     internal, bukan di sini.
 */
import { Redirect, useLocalSearchParams } from "expo-router"

import NotFoundScreen from "./+not-found"

/**
 * Kata yang tidak boleh diperlakukan sebagai username pada tautan publik.
 * (Daftar kanonis untuk web ada di landing; di sini hanya pengaman agar
 * tautan seperti kahade.id/admin tidak membuka pencarian user "admin".)
 */
const RESERVED = new Set([
  "p",
  "v",
  "r",
  "payment",
  "transfer",
  "register",
  "help",
  "download",
  "terms",
  "privacy",
  "about",
  "contact",
  "support",
  "api",
  "admin",
  "static",
  "images",
  "order-link",
])

export default function PublicProfileRoute() {
  const { username } = useLocalSearchParams<{ username?: string }>()
  const name = Array.isArray(username) ? username[0] : username

  if (!name || RESERVED.has(name.toLowerCase())) {
    return <NotFoundScreen />
  }

  return (
    <Redirect
      href={{ pathname: "/user/[username]", params: { username: name } }}
    />
  )
}
