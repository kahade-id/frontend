/**
 * Screen — Followers / Following (GET /v1/users/{username}/followers|following).
 * SegmentedControl antara dua daftar.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Users } from "phosphor-react-native"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { UserListItem } from "@/components/ui/user-list-item"

type TabKey = "followers" | "following"

export default function FollowersScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()

  const [tab, setTab] = useState<TabKey>("followers")
  const [items, setItems] = useState<Array<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res =
        tab === "followers"
          ? await api.users.getFollowers(username)
          : await api.users.getFollowing(username)
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat daftar pengguna.")
    } finally {
      setLoading(false)
    }
  }, [username, tab])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchList()
    setRefreshing(false)
  }, [fetchList])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={tab === "followers" ? "Followers" : "Following"} />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SegmentedControl
            items={[
              { value: "followers", label: "Followers" },
              { value: "following", label: "Following" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as TabKey)}
          />
          {loading ? (
            <EmptyState icon={Users} title="Memuat daftar…" />
          ) : error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchList()} />
          ) : items.length === 0 ? (
            <EmptyState icon={Users} title={`Belum ada ${tab}`} />
          ) : (
            <>
              <SectionHeader title={`@${username}`} />
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
            </>
          )}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
