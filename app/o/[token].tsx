/**
 * Kahade — rute publik `/o/<token>` (tautan order pendek, 3 Okt 2026).
 *
 * Tautan https://kahade.id/o/<token> (dibagikan via `orderShortUrl()`)
 * mendarat di sini, lalu diteruskan ke rute internal `/order-link/[token]`.
 * Format lama https://kahade.id/order-link/<token> tetap berfungsi.
 */
import { Redirect, useLocalSearchParams } from "expo-router"

import NotFoundScreen from "../+not-found"

export default function PublicOrderRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const orderToken = Array.isArray(token) ? token[0] : token

  if (!orderToken) {
    return <NotFoundScreen />
  }

  return (
    <Redirect href={{ pathname: "/order-link/[token]", params: { token: orderToken } }} />
  )
}
