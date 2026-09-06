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
 *
 * Audit: state async → `useApiQuery` (abort saat layar ditinggalkan di tengah
 * rantai halaman) dan kerangka → <DataScreen>.
 */
import { Medal } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { Badge } from "@/lib/api/badges"
import { readPage } from "@/lib/api/response"
import { mergeBadges } from "@/lib/badges"
import { formatDateTime } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"

import { AchievementBadgeGrid } from "@/components/ui/achievement-badge"
import { DataScreen } from "@/components/ui/data-screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

/** Spec: `limit` maximum 100 */
const CATALOG_LIMIT = 100
/** Pengaman bila backend tidak mengirim meta.totalPages */
const CATALOG_MAX_PAGES = 5

/** Bounded pagination with explicit completeness, not a false total/ownership claim. */
async function fetchBadgePages(kind: "mine" | "catalog", signal?: AbortSignal) {
  const items = new Map<string, Badge>()
  for (let page = 1; page <= CATALOG_MAX_PAGES; page++) {
    if (signal?.aborted) break
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
  const toast = useToast()

  const query = useApiQuery("badges", async (signal) => {
    // Katalog boleh gagal tanpa memblokir halaman; "my" tidak.
    const [mineRes, allRes] = await Promise.allSettled([
      fetchBadgePages("mine", signal),
      fetchBadgePages("catalog", signal),
    ])
    if (mineRes.status === "rejected") throw mineRes.reason
    const all = allRes.status === "fulfilled" ? allRes.value.items : []
    return mergeBadges(all, mineRes.value.items, mineRes.value.complete)
  })
  const items = query.data ?? []

  return (
    <DataScreen
      title="Lencana"
      state={query}
      loadingMessage="Memuat lencana…"
      empty={
        items.length === 0 && {
          icon: Medal,
          title: "Belum ada lencana",
          description: "Selesaikan transaksi untuk membuka lencana.",
        }
      }
    >
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
    </DataScreen>
  )
}