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
 *  - Tekan lama → MASUK MODE PILIH dengan baris itu terpilih + haptic
 *    (v3 2026-09-21). ActionSheet per item dan tombol ⋮ di tiap baris
 *    dihapus: keduanya menduplikasi aksi yang sudah ada di header mode pilih
 *    (tandai dibaca / hapus), dan chevron/titik tiga membuat baris terasa
 *    seperti punya dua target sentuh padahal seluruh baris adalah tombol.
 *  - Mode pilih (maks 50 = BatchNotificationIdsDto): read-batch & delete-batch.
 *  - Menu ⋮ → "Hapus yang sudah dibaca" (`POST /v1/notifications/delete-read`).
 *  - Infinite scroll (page/limit, spec: max 100, default 20) + pull-to-refresh.
 *  - Skeleton loading pertama, EmptyState, ErrorState eksplisit.
 *
 * Komponen sistem yang dipakai: Tabs-with-icon lokal (basis <Tabs>/§9.16),
 * NotificationListItem, LoadMore, ErrorState, EmptyState, Skeleton.
 */

import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
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
import { haptic } from "@/lib/haptics"
import { translate } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"
import { ROUTES } from "@/lib/routes"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { notificationTypeUiCategory, notificationUiCategory } from "@/lib/notification-category"
import { routeForNotificationReference } from "@/lib/notification-routing"
import { refreshUnreadCount } from "@/lib/unread-count"
import { logWarn } from "@/lib/telemetry"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Dialog } from "@/components/ui/modal"
import { IconButton } from "@/components/ui/icon-button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { NotificationListItem } from "@/components/ui/notification-list-item"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Tabs, type TabItem } from "@/components/ui/tabs"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/** Tab kategori — selaras dengan <Tabs> profil (tanpa ikon). */
const CATEGORY_TABS = [
  { value: "TRANSAKSI", label: "Transaksi" },
  { value: "PROMOSI", label: "Promosi" },
  { value: "INFORMASI", label: "Informasi" },
] as const satisfies readonly TabItem<NotificationCategory>[]

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
        alignItems: "flex-start",
        // Sebentuk baris aslinya: chip ikon 32 + gap 12 + padding layar 20.
        gap: tokens.space[3],
        paddingHorizontal: tokens.layout.screenPaddingX,
        paddingVertical: tokens.space[3],
      }}
    >
      <Skeleton shape="circle" width={32} height={32} />
      <View style={{ flex: 1, gap: tokens.space[2] }}>
        <Skeleton height={14} style={{ width: "60%" }} />
        <Skeleton height={12} style={{ width: "88%" }} />
        <Skeleton height={12} style={{ width: "45%" }} />
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function NotificationsScreen() {
  const toast = useToast()
  const insets = useSafeAreaInsets()

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
    // C-08 (audit): notifikasi terbaru wajib di atas — daftar ini kronologis
    // dan server mengurutkannya begitu.
    {
      refreshOnFocus: true,
      compare: byTimestampDesc<AppNotification>((item) => item.createdAt),
    },
  )
  const { data: notifs, setData: setNotifs } = query

  // Menu "⋮" + mode pilih (batch read/delete) + konfirmasi hapus
  const [menuOpen, setMenuOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [confirm, setConfirm] = useState<"delete-selected" | "delete-read" | null>(null)

  const hasUnread = notifs.some((n) => !n.isRead)
  const hasRead = notifs.some((n) => n.isRead)
  const selectedCount = selected.size

  useEffect(() => {
    setSelected(new Set())
    setSelecting(false)
  }, [category, unreadOnly])

  const handleRead = useCallback(
    (id: string) => {
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
      api.notifications
        .markNotificationRead(id)
        .then(() => refreshUnreadCount())
        .catch((err: unknown) => {
          // CN-018: rollback TIDAK boleh diam-diam — beri tahu pengguna.
          setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)))
          logWarn("notifications:mark-read", err)
          toast.show({
            title: "Gagal menandai dibaca",
            description: "Periksa koneksi Anda lalu coba lagi.",
            tone: "danger",
          })
        })
    },
    [toast.show],
  )

  const exitSelect = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
  }, [])

  const toggleSelect = useCallback((id: string) => {
    haptic("select")
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < BATCH_MAX) next.add(id)
      return next
    })
  }, [])

  /** Tekan lama satu baris → mode pilih dengan baris itu sudah terpilih. */
  const enterSelect = useCallback((id: string) => {
    haptic("select")
    setSelecting(true)
    setSelected(new Set([id]))
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

  /** Tandai semua dibaca — tombol Checks di header mode normal. */
  const handleReadAll = useCallback(async () => {
    if (batchBusy || !hasUnread) return
    setBatchBusy(true)
    try {
      await api.notifications.markAllNotificationsRead()
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
      void refreshUnreadCount()
      toast.show({ title: "Semua notifikasi ditandai dibaca", tone: "success", duration: 2000 })
    } catch (err: unknown) {
      toast.show({
        title: "Notifikasi belum dapat ditandai",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setBatchBusy(false)
    }
  }, [batchBusy, hasUnread])

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

  return (
    <Screen edges={["top"]} padded={false}>
      {selecting ? (
        <Header
          title={selectedCount > 0 ? translate(`${selectedCount} dipilih`) : "Pilih notifikasi"}
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
              {hasUnread ? (
                <IconButton
                  icon={Checks}
                  variant="ghost"
                  accessibilityLabel="Tandai semua dibaca"
                  accessibilityHint="Menandai seluruh notifikasi sebagai sudah dibaca"
                  disabled={batchBusy}
                  onPress={() => void handleReadAll()}
                />
              ) : null}
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

      {/* Tab kategori — selaras dengan pola <Tabs> profil publik (tanpa ikon).
          Kalau sedang memilih (mode batch) tab tetap tampil agar konteks
          kategori yang sedang dipilih tidak hilang. */}
      <Tabs<NotificationCategory>
        items={CATEGORY_TABS}
        value={category}
        onChange={setCategory}
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
        // Gap 0: pemisahnya adalah divider inset di tiap baris. Gap + divider
        // sekaligus membuat daftar terlihat bergaris ganda.
        gap={0}
        bottomPadding={insets.bottom + tokens.space[8]}
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
            category={notificationTypeUiCategory(item.type) ?? notificationUiCategory(item.category)}
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
              // CN-017: satu ketukan — bila entitas terkait bisa di-resolve
              // (referenceType/referenceId atau actionUrl), langsung ke sana
              // seperti tap push; bila tidak, baru ke layar detail.
              const direct = routeForNotificationReference(item)
              router.push(direct ?? ROUTES.notificationDetail(item.id))
            }}
            // Tekan lama = masuk mode pilih (bukan ActionSheet per item).
            // Di web affordance tekan-lama tidak ada, jadi hint baris
            // menyebutnya eksplisit (lihat NotificationListItem).
            onLongPress={() => (selecting ? toggleSelect(item.id) : enterSelect(item.id))}
            ripple
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

      <Dialog
        title={
          confirm === "delete-read"
            ? "Hapus notifikasi yang sudah dibaca?"
            : translate("Hapus {x} notifikasi?", { x: selectedCount })
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
