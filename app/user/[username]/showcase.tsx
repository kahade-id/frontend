/**
 * Screen — Showcase Publik (GET /v1/users/{username}/showcase).
 * Galeri foto produk/hasil kerja milik profil user lain.
 */
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Images } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { ShowcaseItem } from "@/lib/api/users"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { ShowcaseGalleryGrid } from "@/components/ui/showcase-gallery-grid"

export default function PublicShowcaseScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect. Tiga hal yang sebelumnya
   * hilang dan sekarang ditangani hook: request dibatalkan saat layar
   * di-unmount (respons lambat tidak bisa menimpa layar berikutnya),
   * `refreshing` terpisah dari `loading` sehingga tarik-untuk-menyegarkan
   * tidak lagi mengganti galeri dengan skeleton, dan error lewat
   * `userMessage(err)`. `enabled` menggantikan guard `if (!username) return`.
   */
  const showcase = useApiQuery<ShowcaseItem[]>(
    `public-showcase:${username}`,
    (signal) => api.users.getPublicShowcase(username, signal),
    Boolean(username),
  )
  const items = showcase.data ?? []

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Portofolio" />
      <PullToRefresh
        onRefresh={showcase.refresh}
        refreshing={showcase.refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {showcase.loading ? (
          <ShowcaseGalleryGrid items={[]} loading />
        ) : showcase.error ? (
          <ErrorState
            title="Gagal memuat"
            description={showcase.error}
            onRetry={() => void showcase.reload()}
          />
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
