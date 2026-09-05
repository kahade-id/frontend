import { mergeBadges } from "@/lib/badges"
import { readPage } from "@/lib/api/response"
import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Lencana.
 *
 *   GET /v1/badges/my?page&limit  → lencana yang sudah diraih
 *   GET /v1/badges?page&limit     → katalog semua lencana (yang belum diraih
 *                                   tampil terkunci + progres bila ada)
 *
 * Kedua daftar digabung per `id`/`code`: katalog sebagai dasar, data "my"
 * menimpa `earnedAt`/`progress`. Bila katalog gagal dimuat, tetap tampilkan
 * lencana yang diraih (tidak memblokir halaman). Spec: limit max 100 —
 * katalog lencana kecil, satu halaman 100 cukup; bila `meta.totalPages` > 1
 * halaman berikutnya diambil berurutan (jarang).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Medal } from "phosphor-react-native"

import { api } from "@/lib/api"
import { readBadgeList, type Badge } from "@/lib/api/badges"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { AchievementBadgeGrid } from "@/components/ui/achievement-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

/** Spec: `limit` maximum 100 */
const CATALOG_LIMIT = 100
/** Pengaman bila backend tidak mengirim meta.totalPages */
const CATALOG_MAX_PAGES = 5

/** Bounded pagination with explicit completeness, not a false total/ownership claim. */
async function fetchBadgePages(kind: "mine" | "catalog") {
  const items = new Map<string, Badge>()
  for (let page = 1; page <= CATALOG_MAX_PAGES; page++) {
    const raw = await (kind === "mine" ? api.badges.listMyBadges : api.badges.listAllBadges)({
      page,
      limit: CATALOG_LIMIT,
    })
    const result = readPage<Badge>(raw, { page, limit: CATALOG_LIMIT }, ["badges"])
    const before = items.size
    for (const badge of result.data) items.set(badge.id || badge.code, badge)
    if (result.data.length === 0 || page >= result.meta.totalPages)
      return { items: [...items.values()], complete: true }
    if (before === items.size) break
  }
  return { items: [...items.values()], complete: false }
}

export default function BadgesScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBadges = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mineRes, allRes] = await Promise.allSettled([
        fetchBadgePages("mine"),
        fetchBadgePages("catalog"),
      ])
      if (mineRes.status === "rejected") {
        throw mineRes.reason
      }
      const mine = mineRes.value
      const all = allRes.status === "fulfilled" ? allRes.value.items : []
      setItems(mergeBadges(all, mine.items, mine.complete))
    } catch {
      setError("Gagal memuat lencana.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBadges()
  }, [fetchBadges])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchBadges()
    setRefreshing(false)
  }, [fetchBadges])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Lencana" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <LoadingScreen message="Memuat lencana…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchBadges()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Medal}
            title="Belum ada lencana"
            description="Selesaikan transaksi untuk membuka lencana."
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title="Lencana"
              subtitle={`${items.filter((b) => b.earned === true).length} lencana diraih ditampilkan`}
            />
            <AchievementBadgeGrid
              items={items.map((b) => ({
                id: b.id,
                name: b.name,
                description: b.description,
                earned: b.earned,
                earnedAt: b.earnedAt ? formatDateTime(b.earnedAt) : undefined,
                progress: b.progress
                  ? Math.round((b.progress.current / Math.max(1, b.progress.target)) * 100)
                  : undefined,
              }))}
              onPressItem={(item) =>
                toast.show({ title: item.name, description: item.description, tone: "info" })
              }
            />
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
