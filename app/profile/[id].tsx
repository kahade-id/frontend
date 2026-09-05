/**
 * Kahade — alias deep link `/profile/[id]` → `/user/[username]`.
 *
 * Profil publik SUDAH punya screen di `app/user/[username].tsx`, dan
 * `routeForNotificationReference` memetakan `USER`/`PROFILE` ke sana. Membuat
 * screen kedua di `/profile/[id]` berarti dua URL kanonik untuk halaman yang
 * sama — buruk untuk SEO web dan membuat "path web dan app 1:1" jadi ambigu.
 *
 * Jadi rute ini sengaja bukan layar, melainkan pengalihan: link
 * `kahade.id/profile/budi` tetap bekerja (mis. dari materi lama atau tautan
 * pihak ketiga) tetapi selalu mendarat di URL kanonik `/user/budi`.
 *
 * `<Redirect>` dipakai, bukan `router.replace` di effect — deklaratif dan
 * aman dari race dengan mount navigator, konsisten dengan `app/index.tsx`.
 */
import { Redirect, useLocalSearchParams } from "expo-router"

import { ROUTES } from "@/lib/routes"

export default function ProfileAliasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  if (!id) return <Redirect href={ROUTES.discover} />
  return <Redirect href={ROUTES.userProfile(id)} />
}
