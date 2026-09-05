/**
 * Screen — Favorit (GET /v1/users/favorites).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Heart } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { UserListItem } from "@/components/ui/user-list-item"

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets()

  const [items, setItems] = useState<Array<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getFavorites()
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat favorit.")
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

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Favorit" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Heart} title="Memuat favorit…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : items.length === 0 ? (
          <EmptyState icon={Heart} title="Belum ada favorit" description="Simpan pengguna favorit dari profil mereka." />
        ) : (
          <View className="gap-1" style={{ paddingTop: tokens.space[3] }}>
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
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
