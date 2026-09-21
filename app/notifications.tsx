/**
 * Layar Stack — Notifikasi (dibuka dari Bell di header Beranda)
 *
 * List notifikasi dari `GET /v1/notifications` (read + unread) dengan:
 *  - Tab kategori (dengan IKON — pola tab profil publik, bukan chip scroll):
 *    TRANSAKSI / PROMOSI / INFORMASI, nilai PERSIS enum API (query `category`).
 *  - Tidak ada lagi tab "Semua" / "Belum dibaca": filter baca dibalik satu
 *    tombol FUNNEL di kanan header (toggle Semua ↔ Belum dibaca, query
 *    `isRead=false`), dan tombol BACK standar di kiri header.
 *  - Tap otomatis mark-as-read (`POST /v1/notifications/:id/read`, optimistic)
 *    lalu buka DETAIL notifikasi (`/notification/[id]`) — isi penuh + CTA ke
 *    entitas terkait via `routeForNotificationReference`
 *    (lib/notification-routing — referenceType/referenceId UNVERIFIED).
 *  - Badge tab diturunkan lewat store `lib/unread-count` (bukan poll ulang).
 *  - "Tandai semua dibaca" (`POST /v1/notifications/read-all`).
 *  - Tekan lama → ActionSheet per item + umpan balik scale & haptic pada
 *    baris (intuitif "ini baris yang kupilih").
 *  - Mode pilih (maks 50 = BatchNotificationIdsDto): read-batch & delete-batch.
 *  - Menu ⋮ → "Hapus yang sudah dibaca" (`POST /v1/notifications/delete-read`).
 *  - Infinite scroll (page/limit, spec: max 100, default 20) + pull-to-refresh.
 *  - Skeleton loading pertama, EmptyState, ErrorState eksplisit.
 *
 * Komponen sistem yang dipakai: Tabs-with-icon lokal (basis <Tabs>/§9.16),
 * NotificationListItem, LoadMore, ErrorState, EmptyState, Skeleton.
 */

import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { PaginatedList } from "@/components/ui/paginated-list"
import { useToast } from "@/components/ui/toast"
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import {
  Bell,
  Broom,
  CheckSquare,
  Checks,
  DotsThreeVertical,
  FunnelSimple,
  Megaphone,
  Receipt,
  Trash,
  X,
} from "phosphor-react-native"

import { api, type AppNotification, type NotificationCategory, userMessage } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { ROUTES } from "@/lib/routes"
import { notificationUiCategory } from "@/lib/notification-category"
import { refreshUnreadCount } from "@/lib/unread-count"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { AnimatedCategoryTabs } from "@/components/ui/animated-category-tabs"
import { Dialog } from "@/components/ui/modal"
import { IconButton } from "@/components/ui/icon-button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { NotificationListItem } from "@/components/ui/notification-list-item"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/** Ikon per tab kategori — ikon KONTEKS, bukan lonceng untuk semua. */
const CATEGORY_TABS = [
  { value: "TRANSAKSI", label: "Transaksi", icon: Receipt },
  { value: "PROMOSI", label: "Promosi", icon: Megaphone },
  { value: "INFORMASI", label: "Informasi", icon: Bell },
] as const satisfies readonly { value: NotificationCategory; label: string; icon: typeof Bell }[]

/** Ikon EmptyState per kategori filter (nilai enum API, bukan label). */
const EMPTY_ICON: Record<NotificationCategory, typeof Bell> = {
  TRANSAKSI: Receipt,
  PROMOSI: Megaphone,
  INFORMASI: Bell,
}

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
        alignItems: "center",
        gap: tokens.space[2],
        paddingHorizontal: tokens.layout.screenPaddingX,
        paddingVertical: tokens.space[3],
      }}
    >
      <Skeleton shape="circle" width={16} height={16} />
      <View style={{ flex: 1, gap: tokens.space[1] }}>
        <Skeleton height={14} style={{ width: "60%" }} />
        <Skeleton height={12} style={{ width: "80%" }} />
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function NotificationsScreen() {
  const toast = useToast()

  const [category, setCategory] = useState<NotificationCategory>("TRANSAKSI")
  /** Funnel kanan header: true = hanya "Belum dibaca" (query isRead=false). */
  const [unreadOnly, setUnreadOnly] = useState(false)

  const query = usePaginatedQuery<AppNotification>(
    `notifications:${category}:${unreadOnly ? "unread" : "all"}`,
    (page, signal) =>
      api.notifications.getNotifications(
        {
          category,
          isRead: unreadOnly ? false : undefined,
          page,
          limit: PAGE_SIZE,
        },
        signal,
      ),
    // F-01 (audit): notifikasi baru (transfer masuk, status pesanan) harus
    // muncul saat tab kembali fokus tanpa pull-to-refresh.
    { refreshOnFocus: true },
  )
  const { data: notifs, setData: setNotifs } = query

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
  }, [category, unreadOnly])

  const handleRead = useCallback((id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    api.notifications
      .markNotificationRead(id)
      .then(() => refreshUnreadCount())
      .catch(() =>
        setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))),
      )
  }, [])

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
      void refreshUnreadCount()
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
          title="Notifikasi"
          right={
            <>
              <IconButton
                icon={FunnelSimple}
                variant="ghost"
                active={unreadOnly}
                accessibilityLabel={unreadOnly ? "Tampilkan semua notifikasi" : "Hanya yang belum dibaca"}
                accessibilityHint="Saring daftar antara semua dan belum dibaca"
                disabled={!hasUnread && !unreadOnly}
                onPress={() => setUnreadOnly((v) => !v)}
              />
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

      {/* Tab kategori dengan ikon + indikator meluncur — pola profil publik.
          Kalau sedang memilih (mode batch) tab tetap tampil agar konteks
          kategori yang sedang dipilih tidak hilang. */}
      <AnimatedCategoryTabs
        items={CATEGORY_TABS}
        value={category}
        onChange={setCategory}
        className="border-b border-border"
      />

      <PaginatedList
        {...query}
        padded={false}
        // Audit: default <ListLoading/> merender 4 kartu h-24; baris
        // notifikasi jauh lebih rapat, sehingga daftar "melompat" saat data
        // tiba. Skeleton sebentuk barisnya dipasang di sini.
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
            icon={EMPTY_ICON[category]}
            title={
              unreadOnly
                ? "Tidak ada notifikasi belum dibaca"
                : "Tidak ada notifikasi"
            }
            description={
              unreadOnly
                ? "Semua notifikasi pada kategori ini sudah Anda baca."
                : "Notifikasi untuk Anda akan muncul di sini."
            }
          />
        }
        renderItem={({ item, index }) => (
          <NotificationListItem
            title={item.title}
            body={item.body || undefined}
            category={notificationUiCategory(item.category)}
            timestamp={formatDateTime(item.createdAt)}
            unread={!item.isRead}
            selected={selecting && selected.has(item.id)}
            haptic
            onPress={() => {
              if (selecting) {
                toggleSelect(item.id)
                return
              }
              if (!item.isRead) handleRead(item.id)
              // Selalu buka DETAIL dulu (`/notification/[id]`): isi penuh +
              // CTA "Lihat ..." ke entitas terkait bila referensinya dikenali.
              router.push(ROUTES.notificationDetail(item.id))
            }}
            onLongPress={() => {
              if (selecting) toggleSelect(item.id)
              else setItemMenu(item)
            }}
            // Aksi TERLIHAT untuk menu per item: tekan-lama saja tidak bisa
            // ditemukan (di web tidak ada affordance-nya sama sekali).
            action={
              selecting ? undefined : (
                <IconButton
                  icon={DotsThreeVertical}
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={`Menu aksi notifikasi: ${item.title}`}
                  onPress={() => setItemMenu(item)}
                />
              )
            }
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
