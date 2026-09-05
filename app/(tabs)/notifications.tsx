/**
 * Tab #4 — Notifikasi
 *
 * Menampilkan list notifikasi user (read + unread) dengan:
 *  - Filter kategori via Chip scrollable: Semua | Transaksi | Promosi | Informasi
 *  - Tap otomatis mark-as-read (optimistic update)
 *  - Tombol "Tandai semua dibaca" di header (muncul bila ada yang unread)
 *  - Infinite scroll (load-more)
 *  - Pull-to-refresh
 *  - Skeleton loading rows saat fetch pertama (K2)
 *  - EmptyState saat tidak ada notifikasi
 *  - Error state bila fetch gagal (N5 — sebelumnya silent)
 *
 * Audit fix (round 2):
 *  N1/N4: FilterValue pakai NotificationCategory langsung — sebelumnya pakai
 *         "order"/"promo"/"system" (lowercase informal) yang tidak cocok dengan
 *         tipe API "TRANSAKSI"|"PROMOSI"|"INFORMASI". Ini bug runtime: category
 *         yang dikirim ke API tidak pernah cocok enum yang diharapkan.
 *  N2:    Skeleton key pakai string "skeleton-{i}", bukan bare index.
 *  N3:    ON_END_THRESHOLD konstanta bernama, bukan magic number 0.3.
 *  N5:    fetchNotifs set errorMsg bila catch; screen tampilkan ErrorState.
 */
import { useCallback, useEffect, useState } from "react"
import { FlatList, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications"
import type { AppNotification, NotificationCategory } from "@/lib/api/notifications"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { NotificationListItem } from "@/components/ui/notification-list-item"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { tokens } from "@/lib/tokens"

// N1/N4: FilterValue sekarang "ALL" | NotificationCategory — persis yang dikirim ke API
type FilterValue = "ALL" | NotificationCategory

// N1: label tetap bahasa Indonesia, value = enum API yang benar
const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "Semua", value: "ALL" },
  { label: "Transaksi", value: "TRANSAKSI" },
  { label: "Promosi", value: "PROMOSI" },
  { label: "Informasi", value: "INFORMASI" },
]

const PAGE_SIZE = 20

/** Jumlah skeleton rows yang ditampilkan saat loading pertama kali */
const SKELETON_COUNT = 5

/** Threshold scroll untuk memicu load-more (0–1, persentase dari akhir list) */
const ON_END_THRESHOLD = 0.3

// ------------------------------------------------------------------
// Skeleton placeholder: satu baris notifikasi
// ------------------------------------------------------------------

function NotifSkeletonRow() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: tokens.space[3],
        paddingHorizontal: tokens.layout.screenPaddingX,
        paddingVertical: tokens.space[3],
      }}
    >
      {/* dot unread placeholder */}
      <Skeleton shape="circle" width={8} height={8} style={{ marginTop: tokens.space[1] }} />
      <View style={{ flex: 1, gap: tokens.space[1] }}>
        <Skeleton height={14} style={{ width: "60%" }} />
        <Skeleton height={12} style={{ width: "80%" }} />
        <Skeleton height={12} style={{ width: "40%" }} />
      </View>
    </View>
  )
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets()

  const [filter, setFilter] = useState<FilterValue>("ALL")
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  // N5: error state — sebelumnya fetch error diabaikan diam-diam
  const [fetchError, setFetchError] = useState<string | null>(null)

  const hasUnread = notifs.some((n) => !n.isRead)

  // ── Fetch ──────────────────────────────────────────────────
  const fetchNotifs = useCallback(
    async (nextPage: number, isRefresh = false) => {
      try {
        if (nextPage === 1 && !isRefresh) setLoading(true)
        else if (nextPage > 1) setLoadingMore(true)
        setFetchError(null)

        const res = await getNotifications({
          // N1/N4: filter === "ALL" → undefined; selain itu langsung NotificationCategory
          category: filter === "ALL" ? undefined : filter,
          page: nextPage,
          limit: PAGE_SIZE,
        })

        setNotifs((prev) => (isRefresh || nextPage === 1 ? res.data : [...prev, ...res.data]))
        setPage(nextPage)
        setHasMore(nextPage < res.meta.totalPages)
      } catch {
        // N5: tampilkan error state, bukan biarkan layar kosong tak bergerak
        if (nextPage === 1) setFetchError("Gagal memuat notifikasi. Coba lagi.")
        // load-more gagal: biarkan list yang ada, tidak perlu error state besar
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filter],
  )

  useEffect(() => {
    void fetchNotifs(1)
  }, [fetchNotifs])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchNotifs(1, true)
    setRefreshing(false)
  }, [fetchNotifs])

  // ── Mark single as read ────────────────────────────────────────
  const handleRead = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    markNotificationRead(id).catch(() => {
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)))
    })
  }, [])

  // ── Mark all as read ─────────────────────────────────────────
  const handleMarkAll = useCallback(async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {
      // gagal: biarkan state tidak berubah
    } finally {
      setMarkingAll(false)
    }
  }, [])

  return (
    <Screen edges={["top"]}>
      <Header
        title="Notifikasi"
        right={
          hasUnread ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleMarkAll}
              loading={markingAll}
            >
              Tandai dibaca
            </Button>
          ) : undefined
        }
      />

      {/* Filter kategori */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            selected={filter === f.value}
            onPress={() => setFilter(f.value)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <SkeletonGroup>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            // N2: key string bernama, bukan bare index
            <NotifSkeletonRow key={`skeleton-${i}`} />
          ))}
        </SkeletonGroup>
      ) : fetchError ? (
        // N5: error state eksplisit dengan tombol retry
        <ErrorState message={fetchError} onRetry={() => fetchNotifs(1)} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <NotificationListItem
              title={item.title}
              body={item.body}
              category={item.category}
              timestamp={item.createdAt}
              unread={!item.isRead}
              onPress={() => {
                if (!item.isRead) handleRead(item.id)
              }}
              divider={index < notifs.length - 1}
            />
          )}
          contentContainerStyle={[
            notifs.length === 0 && styles.listEmpty,
            { paddingBottom: insets.bottom + tokens.space[4] },
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={() => {
            if (hasMore && !loadingMore) fetchNotifs(page + 1)
          }}
          // N3: konstanta bernama, bukan magic number
          onEndReachedThreshold={ON_END_THRESHOLD}
          ListFooterComponent={hasMore ? <LoadMore loading={loadingMore} /> : null}
          ListEmptyComponent={
            <EmptyState
              title="Tidak ada notifikasi"
              description="Notifikasi untukmu akan muncul di sini."
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.screenPaddingX,
    paddingVertical: tokens.space[2],
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
})
