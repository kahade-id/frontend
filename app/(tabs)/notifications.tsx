/**
 * Tab #4 — Notifikasi
 *
 * List notifikasi dari `GET /v1/notifications` (read + unread) dengan:
 *  - Filter kategori Chip (ScrollView horizontal) — nilai PERSIS enum API
 *    `TRANSAKSI | PROMOSI | INFORMASI` (query `category`).
 *  - Tap otomatis mark-as-read (`POST /v1/notifications/:id/read`, optimistic)
 *  - "Tandai semua dibaca" (`POST /v1/notifications/read-all`)
 *  - Infinite scroll (page/limit, spec: max 100, default 20) + pull-to-refresh
 *  - Skeleton loading pertama, EmptyState, ErrorState eksplisit
 *
 * Komponen sistem yang dipakai: Chip, NotificationListItem, LoadMore,
 * ErrorState, EmptyState, Skeleton — tidak ada baris custom.
 * Kategori UI komponen (ikon) dipetakan dari kategori API di `UI_CATEGORY`.
 */
import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Bell, Megaphone, Receipt } from "phosphor-react-native"

import { api, type AppNotification, type NotificationCategory } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadMore } from "@/components/ui/load-more"
import {
  NotificationListItem,
  type NotificationCategory as UiCategory,
} from "@/components/ui/notification-list-item"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

type FilterValue = "ALL" | NotificationCategory

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "Semua", value: "ALL" },
  { label: "Transaksi", value: "TRANSAKSI" },
  { label: "Promosi", value: "PROMOSI" },
  { label: "Informasi", value: "INFORMASI" },
]

/**
 * Peta kategori API (query enum) → kategori UI komponen (ikon).
 * TRANSAKSI → Receipt, PROMOSI → Megaphone, INFORMASI → Bell.
 * Nilai asing dari backend jatuh ke "system" (tidak crash).
 */
const UI_CATEGORY: Record<string, UiCategory> = {
  TRANSAKSI: "order",
  PROMOSI: "promo",
  INFORMASI: "system",
}

/** Ikon EmptyState per kategori filter (nilai enum API, bukan label). */
const EMPTY_ICON: Record<FilterValue, typeof Bell> = {
  ALL: Bell,
  TRANSAKSI: Receipt,
  PROMOSI: Megaphone,
  INFORMASI: Bell,
}

const PAGE_SIZE = 20
const SKELETON_COUNT = 5
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
      <Skeleton shape="circle" width={8} height={8} style={{ marginTop: tokens.space[1] }} />
      <View style={{ flex: 1, gap: tokens.space[1] }}>
        <Skeleton height={14} style={{ width: "60%" }} />
        <Skeleton height={12} style={{ width: "80%" }} />
        <Skeleton height={12} style={{ width: "40%" }} />
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

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
  const [fetchError, setFetchError] = useState<string | null>(null)

  const hasUnread = notifs.some((n) => !n.isRead)

  const fetchNotifs = useCallback(
    async (nextPage: number, isRefresh = false) => {
      try {
        if (nextPage === 1 && !isRefresh) setLoading(true)
        else if (nextPage > 1) setLoadingMore(true)
        setFetchError(null)

        const res = await api.notifications.getNotifications({
          category: filter === "ALL" ? undefined : filter,
          page: nextPage,
          limit: PAGE_SIZE,
        })

        setNotifs((prev) => (isRefresh || nextPage === 1 ? res.data : [...prev, ...res.data]))
        setPage(nextPage)
        setHasMore(nextPage < res.meta.totalPages)
      } catch {
        if (nextPage === 1) setFetchError("Gagal memuat notifikasi. Coba lagi.")
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

  const handleRead = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    api.notifications
      .markNotificationRead(id)
      .catch(() => setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))))
  }, [])

  const handleMarkAll = useCallback(async () => {
    setMarkingAll(true)
    try {
      await api.notifications.markAllNotificationsRead()
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {
      // gagal: state tidak berubah
    } finally {
      setMarkingAll(false)
    }
  }, [])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Notifikasi"
        right={
          hasUnread ? (
            <Button variant="ghost" size="sm" onPress={handleMarkAll} loading={markingAll}>
              Tandai dibaca
            </Button>
          ) : undefined
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onPress={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </ScrollView>

      {loading ? (
        <SkeletonGroup>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <NotifSkeletonRow key={`notif-skeleton-${i}`} />
          ))}
        </SkeletonGroup>
      ) : fetchError ? (
        <ErrorState
          title="Gagal memuat notifikasi"
          description="Periksa koneksi internet Anda, lalu coba lagi."
          onRetry={() => void fetchNotifs(1)}
        />
      ) : (
        <PullToRefresh
          onRefresh={handleRefresh}
          refreshing={refreshing}
          scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[4] } }}
        >
          {notifs.length === 0 ? (
            <EmptyState
              icon={EMPTY_ICON[filter]}
              title="Tidak ada notifikasi"
              description="Notifikasi untukmu akan muncul di sini."
            />
          ) : (
            <View className="gap-1">
              {notifs.map((item, index) => (
                <NotificationListItem
                  key={item.id}
                  title={item.title}
                  body={item.body || undefined}
                  category={UI_CATEGORY[item.category] ?? "system"}
                  timestamp={formatDateTime(item.createdAt)}
                  unread={!item.isRead}
                  onPress={() => {
                    if (!item.isRead) handleRead(item.id)
                  }}
                  divider={index < notifs.length - 1}
                />
              ))}
              {hasMore ? (
                <LoadMore
                  status={loadingMore ? "loading" : "idle"}
                  onLoadMore={() => void fetchNotifs(page + 1)}
                />
              ) : null}
            </View>
          )}
        </PullToRefresh>
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
})
