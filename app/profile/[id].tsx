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
 * UX-NAV-008: `id` di tautan lama bisa berupa id numerik/userId, BUKAN
 * username — redirect buta ke `/user/<id>` lalu mendarat di "Profil tidak
 * ditemukan". Resolusi id → username butuh endpoint backend yang hari ini
 * TIDAK ADA (endpoint `deeplinks` hanya mengembalikan halaman share HTML,
 * bukan JSON) — jadi yang bisa dilakukan di frontend: id yang jelas-jelas
 * BUKAN username (gagal regex username kanonis backend) langsung ditolak
 * dengan ErrorState yang jelas, bukan redirect yang pasti gagal. Id numerik
 * tetap diteruskan buta (bisa jadi username numerik yang valid — regex
 * backend mengizinkannya); `/user/[username]` sudah menampilkan "Profil
 * tidak ditemukan" dengan rapi bila memang tak ada.
 *
 * UX-NAV-016: `/profile` tanpa id — jangan redirect diam-diam ke `/discover`
 * (tujuan arbitrer); tampilkan ErrorState eksplisit + tombol kembali.
 *
 * `<Redirect>` dipakai, bukan `router.replace` di effect — deklaratif dan
 * aman dari race dengan mount navigator, konsisten dengan `app/index.tsx`.
 */
import { Redirect, useLocalSearchParams } from "expo-router"
import { View } from "react-native"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { translate } from "@/lib/i18n/translate"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"

/**
 * Bentuk username kanonis — disalin dari backend (`USERNAME_RE` di
 * `deep-links.controller.ts` / `parse-username.pipe.ts`). Id yang gagal
 * regex ini PASTI bukan username, jadi redirect buta ke `/user/<id>` pasti
 * 404 — tolak langsung dengan pesan yang jelas.
 */
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]|\.(?=[a-zA-Z0-9])){2,29}$/

function AliasError() {
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Profil")} />
      <View className="gap-4 px-5 pt-6">
        <ErrorState title={translate("Profil tidak ditemukan")} />
        <Button variant="secondary" onPress={() => goBackOrNavigate(ROUTES.home)}>
          {translate("Kembali")}
        </Button>
      </View>
    </Screen>
  )
}

export default function ProfileAliasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const trimmed = typeof id === "string" ? id.trim() : ""
  if (!trimmed || !USERNAME_RE.test(trimmed)) return <AliasError />
  return <Redirect href={ROUTES.userProfile(trimmed)} />
}
