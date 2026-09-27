/**
 * Tab Notifikasi (redesign navigasi 2026-09-27; redesign tampilan 2026-09-27).
 *
 * List notifikasi dari `GET /v1/notifications` (read + unread) dengan:
 *  - Segmen kategori gaya pill (<SegmentedControl> — selaras dengan tab peran
 *    di halaman Transaksi): TRANSAKSI / PROMOSI / INFORMASI, nilai PERSIS
 *    enum API (query `category`).
 *  - Tidak ada lagi tab "Semua" / "Belum dibaca": filter baca dibalik satu
 *    tombol FUNNEL di kanan header (toggle Semua ↔ Belum dibaca, query
 *    `isRead=false`).
 *  - Baris <NotificationListItem> premium: chip ikon kategori BERWARNA
 *    (order=primary, wallet=success, promo=amber, keamanan=danger,
 *    sistem=netral), unread = dot + tint halus, judul 2 baris + preview +
 *    timestamp relatif ("5 menit").
 *  - Header grup hari WIB: "Hari ini" / "Kemarin" / tanggal
 *    (lib/notification-grouping).
 *  - Header: judul "Notifikasi" + pil "Tandai dibaca" (hanya bila ada unread).
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
 * Komponen sistem yang dipakai: <SegmentedControl> (§9.16),
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
import { formatRelativeTime } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { translate, useLanguage } from "@/lib/i18n"
import { tokens } from "@/lib/tokens"
import { ROUTES } from "@/lib/routes"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { notificationTypeUiCategory, notificationUiCategory } from "@/lib/notification-category"
import { notificationDayGroup } from "@/lib/notification-grouping"
import { routeForNotificationReference } from "@/lib/notification-routing"
import { refreshUnreadCount } from "@/lib/unread-count"
import { logWarn } from "@/lib/telemetry"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Dialog } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { EmptyState } from "@/components/ui/empty-state"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { NotificationListItem } from "@/components/ui/notification-list-item"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { useAuthSession } from "@/lib/use-auth-session"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/** Segmen kategori — gaya pill <SegmentedControl>, selaras dengan tab
    peran di halaman Transaksi (bukan underline <Tabs>). */
const CATEGORY_TABS = [
  { value: "TRANSAKSI", label: "Transaksi" },
  { value: "PROMOSI", label: "Promosi" },
  { value: "INFORMASI", label: "Informasi" },
] as const satisfies readonly SegmentItem<NotificationCategory>[]

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
        // Sebentuk baris aslinya: chip ikon 40 + gap 12 + padding layar 20.
        gap: tokens.space[3],
        paddingHorizontal: tokens.layout.screenPaddingX,
        paddingVertical: tokens.space[3],
      }}
    >
      <Skeleton shape="circle" width={40} height={40} />
      <View style={{ flex: 1, gap: tokens.space[2] }}>
        <Skeleton height={14} style={{ width: "70%" }} />
        <Skeleton height={12} style={{ width: "88%" }} />
        <Skeleton height={12} style={{ width: "45%" }} />
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// Header grup hari ("Hari ini" / "Kemarin" / tanggal)
// ------------------------------------------------------------------

function NotificationDayHeader({ label, sub }: { label: string; sub: string | null }) {
  return (
    <View className="px-5 pb-1.5 pt-4">
      <View className="flex-row items-baseline gap-2">
        <Text variant="body" weight={600} tone="primary">
          {label}
        </Text>
        {sub ? (
          <Text variant="caption" tone="secondary">
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// Tombol "Tandai semua dibaca" — pil berlabel, bukan ikon kriptik.
// Hanya dirender bila ada unread (lihat pemanggil).
// ------------------------------------------------------------------

function MarkAllReadButton({
  busy,
  onPress,
}: {
  busy: boolean
  onPress: () => void
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={translate("Tandai semua dibaca")}
      accessibilityHint={translate("Menandai seluruh notifikasi sebagai sudah dibaca")}
      scaleOnPress={false}
      ripple
      disabled={busy}
      onPress={onPress}
      className="h-10 flex-row items-center gap-1.5 rounded-full bg-surface px-4"
    >
      <Icon icon={Checks} size="sm" tone="active" />
      <Text variant="body" weight={600} tone="primary">
        {translate("Tandai dibaca")}
      </Text>
    </PressableScale>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

/**
 * Tab Notifikasi (redesign navigasi mobile 2026-09-27): layar ini kini tab
 * bottom navbar. Tamu yang mengetuk tab ini mendapat ajakan login — tanpa
 * gate ini query notifikasi menembak 401 berulang (audit chat B-01).
 */
export default function NotificationsTab() {
  const { token, restoring } = useAuthSession()
  if (restoring) return null
  if (!token) {
    return (
      <Screen edges={["top"]} padded={false}>
        <GuestLoginPrompt next="/notifications" bare />
      </Screen>
    )
  }
  return <NotificationsScreen />
}

function NotificationsScreen() {
  // Langganan bahasa: a11y label/hint tombol header (prop string) harus
  // langsung ikut berganti saat pengguna mengubah bahasa (UI-M019).
  useLanguage()
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
          separator={false}
          left={
            <IconButton
              icon={X}
              variant="ghost"
              accessibilityLabel={translate("Batal memilih")}
              onPress={exitSelect}
            />
          }
          right={
            <>
              <IconButton
                icon={Checks}
                variant="ghost"
                accessibilityLabel={translate("Tandai yang dipilih dibaca")}
                disabled={selectedCount === 0 || batchBusy}
                onPress={() => void handleReadSelected()}
              />
              <IconButton
                icon={Trash}
                variant="ghost"
                accessibilityLabel={translate("Hapus yang dipilih")}
                disabled={selectedCount === 0 || batchBusy}
                onPress={() => setConfirm("delete-selected")}
              />
            </>
          }
        />
      ) : (
        <Header
          title="Notifikasi"
          // Tab top-level (bottom navbar) — tidak ada layar "sebelumnya"
          // untuk kembali (seperti <Header title="Transaksi" showBack={false}/>).
          showBack={false}
          separator={false}
          right={
            <>
              {hasUnread ? (
                <MarkAllReadButton busy={batchBusy} onPress={() => void handleReadAll()} />
              ) : null}
              <IconButton
                icon={FunnelSimple}
                variant="ghost"
                active={unreadOnly}
                accessibilityLabel={
                  unreadOnly ? translate("Tampilkan semua notifikasi") : translate("Hanya yang belum dibaca")
                }
                accessibilityHint={translate("Saring daftar antara semua dan belum dibaca")}
                disabled={!hasUnread && !unreadOnly}
                onPress={() => setUnreadOnly((v) => !v)}
              />
              {notifs.length > 0 ? (
                <IconButton
                  icon={DotsThreeVertical}
                  variant="ghost"
                  accessibilityLabel={translate("Opsi notifikasi")}
                  onPress={() => setMenuOpen(true)}
                />
              ) : null}
            </>
          }
        />
      )}

      {/* Segmen kategori — gaya pill <SegmentedControl> seperti tab peran di
          halaman Transaksi (konsisten antar tab top-level).
          Kalau sedang memilih (mode batch) segmen tetap tampil agar konteks
          kategori yang sedang dipilih tidak hilang. */}
      <FadeIn duration="fast" translate={false} className="bg-background px-5 pb-3 pt-3">
        <SegmentedControl<NotificationCategory>
          accessibilityLabel={translate("Kategori notifikasi")}
          items={CATEGORY_TABS}
          value={category}
          onChange={setCategory}
        />
      </FadeIn>

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
                : "Belum ada notifikasi"
            }
            description={
              unreadOnly
                ? "Semua notifikasi pada kategori ini sudah Anda baca."
                : category === "TRANSAKSI"
                  ? "Notifikasi transaksi Anda akan muncul di sini."
                  : category === "PROMOSI"
                    ? "Promo dan penawaran menarik untuk Anda akan muncul di sini."
                    : "Info penting dari Kahade akan muncul di sini."
            }
          />
        }
        renderItem={({ item, index }) => {
          // Header grup hari (WIB): tampil di baris pertama tiap hari.
          // Daftar diurutkan terbaru-di-atas (byTimestampDesc), jadi hari-hari
          // selalu berurutan — tidak perlu struktur SectionList.
          const group = notificationDayGroup(item.createdAt)
          const prev = index > 0 ? notifs[index - 1] : undefined
          const showHeader =
            index === 0 || (prev != null && notificationDayGroup(prev.createdAt).key !== group.key)
          // Divider hanya antar baris dalam hari yang sama; antar grup yang
          // memisahkan adalah header harinya sendiri.
          const next = index < notifs.length - 1 ? notifs[index + 1] : undefined
          const sameDayAsNext =
            next != null && notificationDayGroup(next.createdAt).key === group.key
          return (
            <View>
              {showHeader ? <NotificationDayHeader label={group.label} sub={group.sub} /> : null}
              <NotificationListItem
                title={item.title}
                body={item.body || undefined}
                category={notificationTypeUiCategory(item.type) ?? notificationUiCategory(item.category)}
                // Timestamp relatif ("5 menit", "2 jam") — format eksplisit
                // tetap tersedia di layar detail bila dibutuhkan.
                timestamp={formatRelativeTime(item.createdAt)}
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
                divider={sameDayAsNext}
              />
            </View>
          )
        }}
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
