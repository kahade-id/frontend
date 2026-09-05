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
 *
 * Fix audit:
 *  - K2: skeleton rows selama loading=true, bukan layar kosong
 *  - P2: hapus setPage(1) duplikat dari useEffect — fetchNotifs(1) sudah
 *        memanggil setPage(nextPage) di dalam fungsinya
 *  - M2: StyleSheet hardcode gap/padding diganti tokens.space
 */
import { useCallback, useEffect, useState } from "react"
import { FlatList, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications"
import type { AppNotification } from "@/lib/api/notifications"
import type { NotificationCategory } from "@/components/ui/notification-list-item"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import { NotificationListItem } from "@/components/ui/notification-list-item"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { tokens } from "@/lib/tokens"

type FilterValue = "ALL" | NotificationCategory

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "Semua", value: "ALL" },
  { label: "Transaksi", value: "order" },
  { label: "Promosi", value: "promo" },
  { label: "Informasi", value: "system" },
]

const PAGE_SIZE = 20

/** Jumlah skeleton rows yang ditampilkan saat loading pertama kali */
const SKELETON_COUNT = 5

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

  const hasUnread = notifs.some((n) => !n.isRead)

  // ── Fetch ──────────────────────────────────────────────────
  const fetchNotifs = useCallback(
    async (nextPage: number, isRefresh = false) => {
      try {
        if (nextPage === 1 && !isRefresh) setLoading(true)
        else if (nextPage > 1) setLoadingMore(true)

        const res = await getNotifications({
          category: filter === "ALL" ? undefined : filter,
          page: nextPage,
          limit: PAGE_SIZE,
        })

        setNotifs((prev) => (isRefresh || nextPage === 1 ? res.data : [...prev, ...res.data]))
        setPage(nextPage)
        setHasMore(nextPage < res.meta.totalPages)
      } catch {
        // fetch gagal: biarkan list yang ada
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filter],
  )

  // P2: hapus setPage(1) duplikat — fetchNotifs(1) sudah handle setPage di dalam
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
    // Optimistic update
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    markNotificationRead(id).catch(() => {
      // rollback bila gagal
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
      // gagal: biarkan state tidak berubah, user bisa retry
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

      {/* Filter kategori — horizontal scroll Chip */}
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

      {/* K2: skeleton rows selama loading=true pertama kali */}
      {loading ? (
        <SkeletonGroup>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <NotifSkeletonRow key={i} />
          ))}
        </SkeletonGroup>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <NotificationListItem
              title={item.title}
              body={item.body}
              category={item.category as NotificationCategory}
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
          onEndReachedThreshold={0.3}
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

// M2: semua magic number diganti tokens.space
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
