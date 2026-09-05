/**
 * Screen — Favorit (GET /v1/users/favorites).
 *
 * Audit: sebelumnya layar ini mengelola sendiri `loading/error/refreshing`.
 * Akibatnya (a) tarik-untuk-refresh mengganti daftar dengan LoadingScreen,
 * (b) respons lama bisa menimpa respons baru karena tidak ada abort, dan
 * (c) pesan galat backend dibuang dan diganti string tetap. Ketiganya hilang
 * dengan `useApiQuery` + <DataScreen>.
 */
import { Heart } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { SectionHeader } from "@/components/ui/section"
import { UserListItem } from "@/components/ui/user-list-item"

export default function FavoritesScreen() {
  const query = useApiQuery("favorites", () => api.users.getFavorites())
  const items = query.data ?? []

  return (
    <DataScreen
      title="Favorit"
      state={query}
      loadingMessage="Memuat favorit…"
      empty={
        items.length === 0 && {
          icon: Heart,
          title: "Belum ada favorit",
          description: "Simpan pengguna favorit dari profil mereka.",
        }
      }
      contentClassName="gap-1"
    >
      <SectionHeader title="Pengguna favorit" />
      {items.map((u, i) => (
        <UserListItem
          key={u.id}
          name={u.fullName ?? u.username}
          username={u.username}
          avatar={{ source: u.avatarUrl ?? undefined }}
          chevron
          divider={i < items.length - 1}
          onPress={() => router.push(ROUTES.userProfile(u.username))}
        />
      ))}
    </DataScreen>
  )
}
