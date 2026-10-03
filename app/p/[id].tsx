/**
 * Kahade — rute publik `/p/<id>` (gaya Instagram, keputusan 1 Okt 2026).
 *
 * Tautan https://kahade.id/p/<id> (dibagikan dari tombol share etalase via
 * `showcaseUrl()`) mendarat di sini, lalu diteruskan ke rute internal
 * `/showcase/[id]`.
 */
import { Redirect, useLocalSearchParams } from "expo-router"

import NotFoundScreen from "../+not-found"

export default function PublicPostRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const postId = Array.isArray(id) ? id[0] : id

  if (!postId) {
    return <NotFoundScreen />
  }

  return (
    <Redirect href={{ pathname: "/showcase/[id]", params: { id: postId } }} />
  )
}
