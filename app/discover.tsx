/**
 * Screen — Discover (GET /v1/users/discover).
 * List UserDiscoverResultItem + FollowButton toggle (follow/unfollow).
 *
 * Audit: state async → `useApiQuery`; kerangka → <DataScreen>; kegagalan
 * follow/unfollow menyertakan pesan backend dan MENGEMBALIKAN state tombol
 * (sebelumnya optimistic update tidak pernah di-rollback saat request gagal,
 * sehingga tombol menampilkan "Mengikuti" untuk relasi yang tidak terbentuk).
 */
import { useCallback, useState } from "react"
import { Compass } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { DiscoveredUser } from "@/lib/api/users"
import { userMessage } from "@/lib/api/errors"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { SectionHeader } from "@/components/ui/section"
import { UserDiscoverResultItem } from "@/components/ui/user-discover-result-item"
import { useToast } from "@/components/ui/toast"

const PAGE_LIMIT = 50

export default function DiscoverScreen() {
  const toast = useToast()
  const query = useApiQuery("discover", () =>
    api.users.discoverUsers({ page: 1, limit: PAGE_LIMIT }),
  )
  const items = query.data ?? []
  const { setData } = query
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleFollowToggle = useCallback(
    async (user: DiscoveredUser, following: boolean) => {
      setPendingId(user.id)
      const apply = (value: boolean) =>
        setData((prev) =>
          (prev ?? []).map((u) => (u.id === user.id ? { ...u, following: value } : u)),
        )
      apply(following)
      try {
        if (following) await api.users.followUser(user.username)
        else await api.users.unfollowUser(user.username)
      } catch (err) {
        apply(!following)
        toast.show({
          title: "Gagal memperbarui status ikuti",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setPendingId(null)
      }
    },
    [setData, toast.show],
  )

  return (
    <DataScreen
      title="Discover"
      state={query}
      loadingMessage="Memuat pengguna…"
      empty={
        items.length === 0 && {
          icon: Compass,
          title: "Belum ada rekomendasi",
          description: "Pengguna yang disarankan untuk Anda akan muncul di sini.",
        }
      }
      contentClassName="gap-1"
    >
      <SectionHeader title="Pengguna untuk Anda" />
      {items.map((u, i) => (
        <UserDiscoverResultItem
          key={u.id}
          name={u.fullName ?? u.username}
          handle={`@${u.username}`}
          avatar={u.avatarUrl ?? undefined}
          verified={u.verified}
          transactionCount={u.transactionCount}
          rating={u.rating}
          onPress={() => router.push(ROUTES.userProfile(u.username))}
          follow={{
            following: !!u.following,
            loading: pendingId === u.id,
            onToggle: (next) => void handleFollowToggle(u, next),
          }}
          divider={i < items.length - 1}
        />
      ))}
    </DataScreen>
  )
}
