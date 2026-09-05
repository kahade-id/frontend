/**
 * Tab #4 — Notifikasi
 *
 * List notifikasi dari `GET /v1/notifications` (read + unread) dengan:
 *  - Filter kategori Chip (ScrollView horizontal) — nilai PERSIS enum API
 *    `TRANSAKSI | PROMOSI | INFORMASI` (query `category`).
 *  - Tap otomatis mark-as-read (`POST /v1/notifications/:id/read`, optimistic)
 *    lalu buka entitas terkait via `routeForNotificationReference`
 *    (lib/notification-routing — referenceType/referenceId UNVERIFIED)
 *  - Badge tab diturunkan lewat store `lib/unread-count` (bukan poll ulang)
 *  - "Tandai semua dibaca" (`POST /v1/notifications/read-all`)
 *  - Filter "Belum dibaca" (query `isRead=false`)
 *  - Long-press → ActionSheet per item: tandai dibaca / pilih beberapa /
 *    hapus (`DELETE /v1/notifications/:id`, optimistic + rollback)
 *  - Mode pilih (maks 50 = BatchNotificationIdsDto): read-batch & delete-batch
 *  - Menu ⋮ → "Hapus yang sudah dibaca" (`POST /v1/notifications/delete-read`)
 *  - Infinite scroll (page/limit, spec: max 100, default 20) + pull-to-refresh
 *  - Skeleton loading pertama, EmptyState, ErrorState eksplisit
 *
 * Komponen sistem yang dipakai: Chip, NotificationListItem, LoadMore,
 * ErrorState, EmptyState, Skeleton — tidak ada baris custom.
 * Kategori UI komponen (ikon) dipetakan dari kategori API di `UI_CATEGORY`.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Bell, Broom, CheckSquare, Checks, DotsThreeVertical, Megaphone, Receipt, Trash, X } from "phosphor-react-native"

import { api, type AppNotification, type NotificationCategory } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { routeForNotificationReference } from "@/lib/notification-routing"
import { refreshUnreadCount, setUnreadCount } from "@/lib/unread-count"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Dialog } from "@/components/ui/modal"
import { IconButton } from "@/components/ui/icon-button"
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

/** Filter status baca (query `isRead`) — chip kedua, independen dari kategori */
type ReadFilter = "ALL" | "UNREAD"

const PAGE_SIZE = 20
/** BatchNotificationIdsDto: "max 50 per request" */
const BATCH_MAX = 50
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
  const [readFilter, setReadFilter] = useState<ReadFilter>("ALL")
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Menu "⋮" + mode pilih (batch read/delete) + konfirmasi hapus
  const [menuOpen, setMenuOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [confirm, setConfirm] = useState<"delete-selected" | "delete-read" | null>(null)
  const [itemMenu, setItemMenu] = useState<AppNotification | null>(null)

  const hasUnread = notifs.some((n) => !n.isRead)
  const hasRead = notifs.some((n) => n.isRead)
  const selectedCount = selected.size

  const fetchNotifs = useCallback(
    async (nextPage: number, isRefresh = false) => {
      try {
        if (nextPage === 1 && !isRefresh) setLoading(true)
        else if (nextPage > 1) setLoadingMore(true)
        setFetchError(null)

        const res = await api.notifications.getNotifications({
          category: filter === "ALL" ? undefined : filter,
          isRead: readFilter === "UNREAD" ? false : undefined,
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
    [filter, readFilter],
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
      .then(() => refreshUnreadCount())
      .catch(() => setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))))
  }, [])

  const handleMarkAll = useCallback(async () => {
    setMarkingAll(true)
    try {
      await api.notifications.markAllNotificationsRead()
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
      // Badge tab hilang seketika (store bersama), tanpa menunggu poll 60 d
      setUnreadCount(0)
    } catch {
      // gagal: state tidak berubah
    } finally {
      setMarkingAll(false)
    }
  }, [])

  // ── Mode pilih & aksi batch ─────────────────────────────────────────
  const exitSelect = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < BATCH_MAX) next.add(id)
      return next
    })
  }, [])

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  const handleReadSelected = useCallback(async () => {
    if (selectedIds.length === 0 || batchBusy) return
    setBatchBusy(true)
    try {
      await api.notifications.markNotificationsReadBatch(selectedIds)
      const ids = new Set(selectedIds)
      setNotifs((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, isRead: true } : n)))
      void refreshUnreadCount()
      exitSelect()
    } catch {
      // gagal: biarkan pilihan, user bisa coba lagi
    } finally {
      setBatchBusy(false)
    }
  }, [selectedIds, batchBusy, exitSelect])

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0 || batchBusy) return
    setBatchBusy(true)
    try {
      await api.notifications.deleteNotificationsBatch(selectedIds)
      const ids = new Set(selectedIds)
      setNotifs((prev) => prev.filter((n) => !ids.has(n.id)))
      void refreshUnreadCount()
      exitSelect()
    } catch {
      // gagal: list tidak berubah
    } finally {
      setBatchBusy(false)
      setConfirm(null)
    }
  }, [selectedIds, batchBusy, exitSelect])

  const handleDeleteRead = useCallback(async () => {
    if (batchBusy) return
    setBatchBusy(true)
    try {
      await api.notifications.deleteReadNotifications()
      setNotifs((prev) => prev.filter((n) => !n.isRead))
    } catch {
      // gagal: list tidak berubah
    } finally {
      setBatchBusy(false)
      setConfirm(null)
    }
  }, [batchBusy])

  const handleDeleteOne = useCallback(async (id: string) => {
    // Optimistic: hilangkan dulu, kembalikan bila gagal
    let removed: AppNotification | undefined
    setNotifs((prev) => {
      removed = prev.find((n) => n.id === id)
      return prev.filter((n) => n.id !== id)
    })
    try {
      await api.notifications.deleteNotification(id)
      void refreshUnreadCount()
    } catch {
      if (removed) {
        const back = removed
        setNotifs((prev) => (prev.some((n) => n.id === back.id) ? prev : [back, ...prev]))
      }
    }
  }, [])

  const menuActions: ActionSheetItem[] = [
    {
      key: "select",
      label: "Pilih beberapa",
      icon: CheckSquare,
      onPress: () => {
        setMenuOpen(false)
        setSelecting(true)
      },
    },
    {
      key: "delete-read",
      label: "Hapus yang sudah dibaca",
      icon: Broom,
      destructive: true,
      onPress: () => {
        setMenuOpen(false)
        setConfirm("delete-read")
      },
    },
  ]

  const itemActions: ActionSheetItem[] = itemMenu
    ? [
        ...(!itemMenu.isRead
          ? [
              {
                key: "read",
                label: "Tandai dibaca",
                icon: Checks,
                onPress: () => {
                  handleRead(itemMenu.id)
                  setItemMenu(null)
                },
              } satisfies ActionSheetItem,
            ]
          : []),
        {
          key: "select",
          label: "Pilih beberapa",
          icon: CheckSquare,
          onPress: () => {
            setItemMenu(null)
            setSelecting(true)
            setSelected(new Set([itemMenu.id]))
          },
        },
        {
          key: "delete",
          label: "Hapus notifikasi",
          icon: Trash,
          destructive: true,
          onPress: () => {
            const id = itemMenu.id
            setItemMenu(null)
            void handleDeleteOne(id)
          },
        },
      ]
    : []

  return (
    <Screen edges={["top"]} padded={false}>
      {selecting ? (
        <Header
          title={selectedCount > 0 ? `${selectedCount} dipilih` : "Pilih notifikasi"}
          showBack={false}
          left={<IconButton icon={X} variant="ghost" accessibilityLabel="Batal memilih" onPress={exitSelect} />}
          right={
            <>
              <IconButton
                icon={Checks}
                variant="ghost"
                accessibilityLabel="Tandai yang dipilih dibaca"
                disabled={selectedCount === 0 || batchBusy}
                onPress={() => void handleReadSelected()}
              />
              <IconButton
                icon={Trash}
                variant="ghost"
                accessibilityLabel="Hapus yang dipilih"
                disabled={selectedCount === 0 || batchBusy}
                onPress={() => setConfirm("delete-selected")}
              />
            </>
          }
        />
      ) : (
        <Header
          title="Notifikasi"
          right={
            <>
              {hasUnread ? (
                <Button variant="ghost" size="sm" onPress={handleMarkAll} loading={markingAll}>
                  Tandai dibaca
                </Button>
              ) : null}
              {notifs.length > 0 ? (
                <IconButton
                  icon={DotsThreeVertical}
                  variant="ghost"
                  accessibilityLabel="Opsi notifikasi"
                  onPress={() => setMenuOpen(true)}
                />
              ) : null}
            </>
          }
        />
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        <Chip selected={readFilter === "UNREAD"} onPress={() => setReadFilter((v) => (v === "UNREAD" ? "ALL" : "UNREAD"))}>
          Belum dibaca
        </Chip>
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
                  selected={selecting && selected.has(item.id)}
                  onPress={() => {
                    if (selecting) {
                      toggleSelect(item.id)
                      return
                    }
                    if (!item.isRead) handleRead(item.id)
                    // Buka entitas terkait bila referensinya dikenali
                    const target = routeForNotificationReference(item)
                    if (target) router.push(target)
                  }}
                  onLongPress={() => {
                    if (selecting) toggleSelect(item.id)
                    else setItemMenu(item)
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

      <ActionSheet
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
        title="Notifikasi"
        actions={hasRead ? menuActions : menuActions.filter((a) => a.key !== "delete-read")}
      />
      <ActionSheet
        visible={!!itemMenu}
        onRequestClose={() => setItemMenu(null)}
        title={itemMenu?.title}
        actions={itemActions}
      />

      <Dialog
        title={confirm === "delete-read" ? "Hapus notifikasi yang sudah dibaca?" : `Hapus ${selectedCount} notifikasi?`}
        description={
          confirm === "delete-read"
            ? "Semua notifikasi yang sudah dibaca akan dihapus dari daftar."
            : "Notifikasi yang dipilih akan dihapus dari daftar."
        }
        visible={confirm !== null}
        destructive
        loading={batchBusy}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void (confirm === "delete-read" ? handleDeleteRead() : handleDeleteSelected())}
        onCancel={() => setConfirm(null)}
        onRequestClose={() => setConfirm(null)}
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
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.screenPaddingX,
    paddingVertical: tokens.space[2],
  },
})
