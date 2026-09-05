import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Discover (GET /v1/users/discover).
 * List UserDiscoverResultItem + FollowButton toggle (follow/unfollow).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Compass } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { DiscoveredUser } from "@/lib/api/users"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { UserDiscoverResultItem } from "@/components/ui/user-discover-result-item"
import { useToast } from "@/components/ui/toast"

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<DiscoveredUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.discoverUsers({ page: 1, limit: 50 })
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat daftar pengguna.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleFollowToggle = useCallback(
    async (user: DiscoveredUser, following: boolean) => {
      setPendingId(user.id)
      try {
        if (following) await api.users.followUser(user.username)
        else await api.users.unfollowUser(user.username)
        setItems((prev) => prev.map((u) => (u.id === user.id ? { ...u, following } : u)))
      } catch {
        toast.show({ title: "Gagal memperbarui status ikuti", tone: "danger" })
      } finally {
        setPendingId(null)
      }
    },
    [toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Discover" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <LoadingScreen message="Memuat pengguna…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Compass} title="Belum ada rekomendasi" />
        ) : (
          <View className="gap-1" style={{ paddingTop: tokens.space[3] }}>
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
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
