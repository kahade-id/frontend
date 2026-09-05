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

/** Ambil seluruh katalog (halaman berurutan bila meta.totalPages > 1). */
async function fetchWholeCatalog(): Promise<Badge[]> {
  const out: Badge[] = []
  let page = 1
  let totalPages = 1
  do {
    const body = await api.badges.listAllBadges({ page, limit: CATALOG_LIMIT })
    out.push(...readBadgeList(body))
    totalPages = !Array.isArray(body) && body?.meta?.totalPages ? body.meta.totalPages : 1
    page += 1
  } while (page <= totalPages && page <= CATALOG_MAX_PAGES)
  return out
}

/** Katalog sebagai dasar; entri "my" menimpa (earnedAt/progress). Yang hanya ada di "my" ditambahkan. */
function mergeBadges(all: Badge[], mine: Badge[]): Badge[] {
  const keyOf = (b: Badge) => b.id || b.code
  const map = new Map<string, Badge>()
  for (const b of all) map.set(keyOf(b), b)
  for (const m of mine) {
    const k = keyOf(m)
    const base = map.get(k)
    map.set(k, base ? { ...base, ...m, earnedAt: m.earnedAt ?? base.earnedAt ?? new Date().toISOString() } : m)
  }
  // Diraih dulu (terbaru di atas), lalu terkunci berdasarkan progres tertinggi
  return Array.from(map.values()).sort((a, b) => {
    const ea = a.earnedAt ? 1 : 0
    const eb = b.earnedAt ? 1 : 0
    if (ea !== eb) return eb - ea
    if (a.earnedAt && b.earnedAt) return b.earnedAt.localeCompare(a.earnedAt)
    const pa = a.progress ? a.progress.current / Math.max(1, a.progress.target) : 0
    const pb = b.progress ? b.progress.current / Math.max(1, b.progress.target) : 0
    return pb - pa
  })
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
        api.badges.listMyBadges({ page: 1, limit: CATALOG_LIMIT }),
        fetchWholeCatalog(),
      ])
      if (mineRes.status === "rejected" && allRes.status === "rejected") {
        throw mineRes.reason
      }
      const mine = mineRes.status === "fulfilled" ? readBadgeList(mineRes.value) : []
      const all = allRes.status === "fulfilled" ? allRes.value : []
      setItems(mergeBadges(all, mine))
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
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={Medal} title="Memuat lencana…" />
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
              subtitle={`${items.filter((b) => !!b.earnedAt).length} dari ${items.length} diraih`}
            />
            <AchievementBadgeGrid
              items={items.map((b) => ({
                id: b.id,
                name: b.name,
                description: b.description,
                earned: !!b.earnedAt,
                earnedAt: b.earnedAt ? formatDateTime(b.earnedAt) : undefined,
                progress: b.progress
                  ? Math.round((b.progress.current / Math.max(1, b.progress.target)) * 100)
                  : undefined,
              }))}
              onPressItem={(item) => toast.show({ title: item.name, description: item.description, tone: "info" })}
            />
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
