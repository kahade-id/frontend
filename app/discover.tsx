/**
 * Screen — Jelajahi (GET /v1/users/discover).
 * List UserDiscoverResultItem + FollowButton toggle (follow/unfollow).
 *
 * Paginasi page/limit lewat usePaginatedQuery + PaginatedList (sama pengikut).
 * Kegagalan follow/unfollow menyertakan pesan backend dan mengembalikan state tombol.
 */
import { useCallback, useState } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Compass } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { DiscoveredUser } from "@/lib/api/users"
import { userMessage } from "@/lib/api/errors"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { UserDiscoverResultItem } from "@/components/ui/user-discover-result-item"
import { useToast } from "@/components/ui/toast"

const PAGE_LIMIT = 20

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const query = usePaginatedQuery<DiscoveredUser>("discover", (page, signal) =>
    api.users.discoverUsers({ page, limit: PAGE_LIMIT }, signal),
  )
  const { setData } = query
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleFollowToggle = useCallback(
    async (user: DiscoveredUser, following: boolean) => {
      setPendingId(user.id)
      const apply = (value: boolean) =>
        setData((prev) => prev.map((u) => (u.id === user.id ? { ...u, following: value } : u)))
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
    <Screen edges={["top"]} padded={false}>
      <Header title="Jelajahi" />
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={0}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={
          <EmptyState
            icon={Compass}
            title="Belum ada rekomendasi"
            description="Pengguna yang disarankan untuk Anda akan muncul di sini."
          />
        }
        renderItem={({ item, index }) => (
          <UserDiscoverResultItem
            name={item.fullName ?? item.username}
            handle={`@${item.username}`}
            avatar={item.avatarUrl ?? undefined}
            verified={item.verified}
            transactionCount={item.transactionCount}
            rating={item.rating}
            onPress={() => router.push(ROUTES.userProfile(item.username))}
            follow={{
              following: !!item.following,
              loading: pendingId === item.id,
              onToggle: (next) => void handleFollowToggle(item, next),
            }}
            divider={index < query.data.length - 1}
          />
        )}
      />
    </Screen>
  )
}
