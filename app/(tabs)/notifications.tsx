/**
 * Tab #4 — Notifikasi
 *
 * Menampilkan list notifikasi user (read + unread) dengan:
 *  - Filter kategori via Chip scrollable: Semua | Transaksi | Promosi | Informasi
 *  - Tap otomatis mark-as-read (optimistic update)
 *  - Tombol "Tandai semua dibaca" di header (muncul bila ada yang unread)
 *  - Infinite scroll (load-more)
 *  - Pull-to-refresh
 *  - EmptyState saat tidak ada notifikasi
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

type FilterValue = "ALL" | NotificationCategory

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "Semua", value: "ALL" },
  { label: "Transaksi", value: "order" },
  { label: "Promosi", value: "promo" },
  { label: "Informasi", value: "system" },
]

const PAGE_SIZE = 20

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

  useEffect(() => {
    setPage(1)
    fetchNotifs(1)
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
          { paddingBottom: insets.bottom + 16 },
        ]}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={() => {
          if (hasMore && !loadingMore) fetchNotifs(page + 1)
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={hasMore ? <LoadMore loading={loadingMore} /> : null}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="Tidak ada notifikasi"
              description="Notifikasi untukmu akan muncul di sini."
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
})
