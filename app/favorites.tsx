/**
 * Screen — Favorit (GET /v1/users/favorites).
 *
 * Audit: sebelumnya layar ini mengelola sendiri `loading/error/refreshing`.
 * Akibatnya (a) tarik-untuk-refresh mengganti daftar dengan LoadingScreen,
 * (b) respons lama bisa menimpa respons baru karena tidak ada abort, dan
 * (c) pesan galat backend dibuang dan diganti string tetap. Ketiganya hilang
 * dengan `useApiQuery` + <DataScreen>.
 * Ditambahkan juga mutasi hapus favorit langsung dari daftar.
 */
import { useCallback, useState } from "react"
import { Heart } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { IconButton } from "@/components/ui/icon-button"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"
import { UserListItem } from "@/components/ui/user-list-item"

export default function FavoritesScreen() {
  const toast = useToast()
  const query = useApiQuery("favorites", (signal) => api.users.getFavorites(signal))
  const items = query.data ?? []
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemoveFavorite = useCallback(
    async (username: string, id: string) => {
      const prevItems = query.data ?? []
      query.setData(prevItems.filter((item) => item.id !== id))
      setRemovingId(id)
      try {
        await api.users.removeFavorite(username)
        toast.show({ title: "Dihapus dari favorit", tone: "neutral", duration: 2000 })
      } catch (err) {
        query.setData(prevItems)
        toast.show({
          title: "Gagal menghapus favorit",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setRemovingId(null)
      }
    },
    [query, toast],
  )

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
          divider={i < items.length - 1}
          onPress={() => router.push(ROUTES.userProfile(u.username))}
          action={
            <IconButton
              icon={Heart}
              variant="ghost"
              size="sm"
              accessibilityLabel={`Hapus ${u.fullName ?? u.username} dari favorit`}
              loading={removingId === u.id}
              disabled={removingId !== null}
              onPress={() => void handleRemoveFavorite(u.username, u.id)}
            />
          }
        />
      ))}
    </DataScreen>
  )
}
