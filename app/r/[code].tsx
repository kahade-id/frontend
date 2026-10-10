/**
 * Kahade — rute publik `/r/<code>` untuk undangan referral pendek.
 *
 * Tautan https://kahade.id/r/<code> (dibentuk `referralUrl()`) mendarat di
 * sini, lalu diteruskan ke layar `/referral` dengan kode terisi otomatis di
 * kolom "pakai kode" (layar membaca param `code`).
 *
 * Audit 2026-10-10 (F02): kode DISIMPAN dulu (`lib/pending-referral`) sebelum
 * redirect — `/referral` rute protected; tamu dilempar ke login/registrasi
 * dan param `code` hanya hidup di `pendingNext` (memori). Tanpa simpanan ini
 * registrasi tidak pernah mengirim `referralCode` dan undangan hilang.
 */
import { useEffect } from "react"
import { Redirect, useLocalSearchParams } from "expo-router"

import { savePendingReferralCode } from "@/lib/pending-referral"

import NotFoundScreen from "../+not-found"

export default function PublicReferralRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const referralCode = Array.isArray(code) ? code[0] : code

  useEffect(() => {
    if (referralCode) void savePendingReferralCode(referralCode)
  }, [referralCode])

  if (!referralCode) {
    return <NotFoundScreen />
  }

  return (
    <Redirect
      href={{ pathname: "/referral", params: { code: referralCode } }}
    />
  )
}
