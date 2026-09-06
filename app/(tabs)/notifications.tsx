import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { PaginatedList } from "@/components/ui/paginated-list"
import { useToast } from "@/components/ui/toast"
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
import { router } from "expo-router"
import {
  Bell,
  Broom,
  CheckSquare,
  Checks,
  DotsThreeVertical,
  Megaphone,
  Receipt,
  Trash,
  X,
} from "phosphor-react-native"

import { api, type AppNotification, type NotificationCategory, userMessage } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { routeForNotificationReference } from "@/lib/notification-routing"
import { refreshUnreadCount, setUnreadCount } from "@/lib/unread-count"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Chip } from "@/components/ui/chip"
import { Dialog } from "@/components/ui/modal"
import { IconButton } from "@/components/ui/icon-button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import {
  NotificationListItem,
  type NotificationCategory as UiCategory,
} from "@/components/ui/notification-list-item"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { mapValue } from "@/lib/has-own"

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
/** Baris skeleton saat muat pertama — sebentuk <NotificationListItem>. */
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
  const toast = useToast()

  const [filter, setFilter] = useState<FilterValue>("ALL")
  const [readFilter, setReadFilter] = useState<ReadFilter>("ALL")
  const query = usePaginatedQuery<AppNotification>(
    `notifications:${filter}:${readFilter}`,
    (page, signal) =>
      api.notifications.getNotifications(
        {
          category: filter === "ALL" ? undefined : filter,
          isRead: readFilter === "UNREAD" ? false : undefined,
          page,
          limit: PAGE_SIZE,
        },
        signal,
      ),
  )
  const { data: notifs, setData: setNotifs } = query
  const [markingAll, setMarkingAll] = useState(false)

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

  useEffect(() => {
    setSelected(new Set())
    setSelecting(false)
  }, [filter, readFilter])

  const handleRead = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    api.notifications
      .markNotificationRead(id)
      .then(() => refreshUnreadCount())
      .catch(() =>
        setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))),
      )
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
    } catch (err: unknown) {
      toast.show({
        title: "Notifikasi belum dapat ditandai",
        description: userMessage(err),
        tone: "danger",
      })
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
    } catch (err: unknown) {
      toast.show({
        title: "Notifikasi belum dapat dihapus",
        description: userMessage(err),
        tone: "danger",
      })
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
    } catch (err: unknown) {
      toast.show({
        title: "Notifikasi belum dapat dihapus",
        description: userMessage(err),
        tone: "danger",
      })
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
          left={
            <IconButton
              icon={X}
              variant="ghost"
              accessibilityLabel="Batal memilih"
              onPress={exitSelect}
            />
          }
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
          showBack={false}
          title="Notifikasi"
          right={
            <>
              {hasUnread ? (
                <IconButton
                  icon={Checks}
                  variant="ghost"
                  accessibilityLabel="Tandai semua notifikasi dibaca"
                  onPress={() => void handleMarkAll()}
                  disabled={markingAll}
                />
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
        <Chip
          selected={readFilter === "UNREAD"}
          onPress={() => setReadFilter((v) => (v === "UNREAD" ? "ALL" : "UNREAD"))}
        >
          Belum dibaca
        </Chip>
        {FILTERS.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onPress={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </ScrollView>

      <PaginatedList
        {...query}
        padded={false}
        // Audit: default <ListLoading/> merender 4 kartu h-24; baris
        // notifikasi jauh lebih rapat, sehingga daftar "melompat" saat data
        // tiba. Skeleton sebentuk barisnya sudah ada di file ini tapi tidak
        // pernah dipasang.
        loadingPlaceholder={
          <SkeletonGroup>
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <NotifSkeletonRow key={index} />
            ))}
          </SkeletonGroup>
        }
        gap={tokens.space[1]}
        bottomPadding={tokens.space[8]}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        empty={
          <EmptyState
            icon={EMPTY_ICON[filter]}
            title="Tidak ada notifikasi"
            description="Notifikasi untuk Anda akan muncul di sini."
          />
        }
        renderItem={({ item, index }) => (
          <NotificationListItem
            title={item.title}
            body={item.body || undefined}
            category={mapValue(UI_CATEGORY, item.category, "system")}
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
        )}
      />

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
        title={
          confirm === "delete-read"
            ? "Hapus notifikasi yang sudah dibaca?"
            : `Hapus ${selectedCount} notifikasi?`
        }
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
        onConfirm={() =>
          void (confirm === "delete-read" ? handleDeleteRead() : handleDeleteSelected())
        }
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
