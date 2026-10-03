/**
 * Kahade — rute publik `/v/<code>` untuk berbagi voucher/promo.
 *
 * Tautan https://kahade.id/v/<code> (dibentuk `voucherUrl()`) mendarat di
 * sini. Belum ada layar detail voucher terpisah, jadi diteruskan ke daftar
 * `/vouchers` dengan kode sebagai query — layar daftar mengabaikan param
 * yang tidak dikenal (aman), dan siap dipakai bila detail voucher
 * ditambahkan nanti.
 */
import { Redirect, useLocalSearchParams } from "expo-router"

import NotFoundScreen from "../+not-found"

export default function PublicVoucherRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const voucherCode = Array.isArray(code) ? code[0] : code

  if (!voucherCode) {
    return <NotFoundScreen />
  }

  return (
    <Redirect
      href={{ pathname: "/vouchers", params: { code: voucherCode } }}
    />
  )
}
