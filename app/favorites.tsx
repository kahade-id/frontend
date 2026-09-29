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
import { memo, useCallback, useState } from "react"
import { Heart } from "phosphor-react-native"
import { router } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { api, userMessage } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { IconButton } from "@/components/ui/icon-button"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"
import { UserListItem } from "@/components/ui/user-list-item"

type FavoriteUser = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
}

type FavoriteRowProps = {
  user: FavoriteUser
  busy: boolean
  disabled: boolean
  divider: boolean
  onOpenProfile: (username: string) => void
  onRemove: (username: string, id: string) => void
}

// FE-065 (audit 2026-09-29): baris di-memo — `action` (IconButton hapus)
// dibuat di dalam render baris sendiri, bukan inline di `.map` induk.
// `useLanguage()` agar label aksesibilitas ikut berganti bahasa
// (pola ShowcaseFeedItem); UserListItem sendiri sudah di-memo (FE-014).
const FavoriteRow = memo(function FavoriteRow({
  user,
  busy,
  disabled,
  divider,
  onOpenProfile,
  onRemove,
}: FavoriteRowProps) {
  useLanguage()
  return (
    <UserListItem
      name={user.fullName ?? user.username}
      username={user.username}
      avatar={{ source: user.avatarUrl ?? undefined }}
      divider={divider}
      onPress={() => onOpenProfile(user.username)}
      action={
        <IconButton
          icon={Heart}
          variant="ghost"
          size="sm"
          accessibilityLabel={translate("Hapus {x} dari favorit", { x: user.fullName ?? user.username })}
          loading={busy}
          disabled={disabled}
          onPress={() => void onRemove(user.username, user.id)}
        />
      }
    />
  )
})

export default function FavoritesScreen() {
  const toast = useToast()
  const query = useApiQuery("favorites", (signal) => api.users.getFavorites(signal))
  const items = query.data ?? []
  const [removingId, setRemovingId] = useState<string | null>(null)
  // FE-065: destruktur agar useCallback di bawah tidak bergantung pada objek
  // `query` (identitasnya berubah saat data berubah — itu wajar; yang
  // dihindari adalah identitas baru tiap render tanpa perubahan data).
  const { data: favoritesData, setData: setFavoritesData } = query

  const handleRemoveFavorite = useCallback(
    async (username: string, id: string) => {
      const prevItems = favoritesData ?? []
      setFavoritesData(prevItems.filter((item) => item.id !== id))
      setRemovingId(id)
      try {
        await api.users.removeFavorite(username)
        toast.show({ title: "Dihapus dari favorit", tone: "neutral", duration: 2000 })
      } catch (err) {
        setFavoritesData(prevItems)
        toast.show({
          title: "Gagal menghapus favorit",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setRemovingId(null)
      }
    },
    [favoritesData, setFavoritesData, toast.show],
  )

  // FE-065: handler navigasi stabil per-id untuk baris yang di-memo.
  const openProfile = useCallback((username: string) => {
    router.push(ROUTES.userProfile(username))
  }, [])

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
        <FavoriteRow
          key={u.id}
          user={u}
          busy={removingId === u.id}
          disabled={removingId !== null}
          divider={i < items.length - 1}
          onOpenProfile={openProfile}
          onRemove={handleRemoveFavorite}
        />
      ))}
    </DataScreen>
  )
}
