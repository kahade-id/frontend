/**
 * Kahade — rute publik `/r/<code>` untuk undangan referral pendek.
 *
 * Tautan https://kahade.id/r/<code> (dibentuk `referralUrl()`) mendarat di
 * sini, lalu diteruskan ke layar `/referral` dengan kode terisi otomatis di
 * kolom "pakai kode" (layar membaca param `code`).
 */
import { Redirect, useLocalSearchParams } from "expo-router"

import NotFoundScreen from "../+not-found"

export default function PublicReferralRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const referralCode = Array.isArray(code) ? code[0] : code

  if (!referralCode) {
    return <NotFoundScreen />
  }

  return (
    <Redirect
      href={{ pathname: "/referral", params: { code: referralCode } }}
    />
  )
}
