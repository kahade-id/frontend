/**
 * Screen — Showcase Publik (GET /v1/users/{username}/showcase).
 * Galeri foto produk/hasil kerja milik profil user lain.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Images } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { ShowcaseItem } from "@/lib/api/users"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { ShowcaseGalleryGrid } from "@/components/ui/showcase-gallery-grid"

export default function PublicShowcaseScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()

  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getPublicShowcase(username)
      setItems(res ?? [])
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [username])

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
      <Header title="Portofolio" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ShowcaseGalleryGrid items={[]} loading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View style={{ paddingTop: tokens.space[3] }}>
            <ShowcaseGalleryGrid
              items={items.map((it) => ({
                id: it.id,
                source: it.imageUrl ?? it.fileKey ?? "",
                alt: it.caption ?? "Portofolio",
              }))}
              empty={
                <EmptyState
                  icon={Images}
                  title="Belum ada showcase"
                  description="Foto produk atau hasil kerja belum diunggah."
                />
              }
            />
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
