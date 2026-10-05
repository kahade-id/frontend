/**
 * Tab Notifikasi (redesign navigasi 2026-09-27; redesign tampilan 2026-09-27).
 *
 * List notifikasi dari `GET /v1/notifications` (read + unread) dengan:
 *  - Tab kategori underline (<Tabs> TANPA icon — persis struktur tab profil
 *    di user-profile-screen, permintaan produk 2026-10-05): TRANSAKSI /
 *    PROMOSI / INFORMASI, nilai PERSIS enum API (query `category`).
 *    Strip dirender langsung sebagai anak <Screen> dalam alur normal di
 *    antara <Header> dan <PaginatedList> — TANPA wrapper animasi/z-index
 *    (pola <SegmentedControl> lama dalam <FadeIn> dihapus: wrapper animasi
 *    auto-height di atas list adalah pola yang pernah membuat baris daftar
 *    bertumpuk dengan kontrol kategori — lihat catatan akar bug di
 *    components/ui/fade-in.tsx).
 *  - Tidak ada lagi tab "Semua" / "Belum dibaca": filter baca dibalik satu
 *    tombol FUNNEL di kanan header (toggle Semua ↔ Belum dibaca, query
 *    `isRead=false`).
 *  - Baris <NotificationListItem> premium: chip ikon kategori BERWARNA
 *    (order=primary, wallet=success, promo=amber, keamanan=danger,
 *    sistem=netral), unread = dot + tint halus, judul 2 baris + preview +
 *    timestamp relatif ("5 menit lalu").
 *  - Agregasi tampilan notifikasi sosial (lib/notification-social-grouping,
 *    2026-09-28): like/follow berurutan & dekat waktunya digabung satu baris
 *    ("Budi dan 12 lainnya menyukai karya Anda"). HANYA tipe allowlist
 *    (SHOWCASE_LIKE, USER_FOLLOW) — transaksi/keuangan TIDAK PERNAH digabung.
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
 *  - Menu ⋮ → "Pilih beberapa", "Hapus yang sudah dibaca"
 *    (`POST /v1/notifications/delete-read`), dan "Pengaturan notifikasi".
 *  - Infinite scroll (page/limit, spec: max 100, default 20) + pull-to-refresh.
 *  - Skeleton loading pertama, EmptyState, ErrorState eksplisit.
 *
 * Komponen sistem yang dipakai: <Tabs> (§9.16),
 * NotificationListItem, LoadMore, ErrorState, EmptyState, Skeleton.
 */

import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"
import { useScrollElevation } from "@/lib/use-scroll-elevation"
import { useNotificationsRealtime } from "@/lib/realtime/use-notifications-realtime"
import { PaginatedList } from "@/components/ui/paginated-list"
import { useToast } from "@/components/ui/toast"
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { View, type FlatList } from "react-native"
import { router } from "expo-router"
import {
  Bell,
  Broom,
  CheckSquare,
  Checks,
  DotsThreeVertical,
  Funnel,
  GearSix,
  Megaphone,
  Plus,
  Receipt,
  Trash,
  X,
} from "phosphor-react-native"

import { api, type AppNotification, type NotificationCategory, userMessage } from "@/lib/api"
import { formatTimeAgo } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { translate, useLanguage } from "@/lib/i18n"
import { openCreateSheet } from "@/lib/create-sheet"
import { tokens } from "@/lib/tokens"
import { ROUTES } from "@/lib/routes"
import { useSetUiPrefs, useUiPref } from "@/lib/ui-prefs"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { notificationTypeUiCategory, notificationUiCategory } from "@/lib/notification-category"
import { notificationDayGroup } from "@/lib/notification-grouping"
import {
  describeSocialGroup,
  groupSocialNotifications,
  notificationRowHead,
  notificationRowId,
  type NotificationRow,
} from "@/lib/notification-social-grouping"
import { routeForNotificationReference } from "@/lib/notification-routing"
import { refreshUnreadCount, setUnreadCount } from "@/lib/unread-count"
import { logWarn } from "@/lib/telemetry"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Dialog } from "@/components/ui/modal"
import { IconButton } from "@/components/ui/icon-button"
import { DrawerMenuButton } from "@/components/ui/drawer-menu-button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { NotificationListItem } from "@/components/ui/notification-list-item"
import { Screen } from "@/components/ui/screen"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { Text } from "@/components/ui/text"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { useAuthSession } from "@/lib/use-auth-session"
import { NotificationsTabListSkeleton } from "@/components/ui/tab-loading-skeletons"
import { useShellTabReselect } from "@/lib/shell-tab-reselect"

// ------------------------------------------------------------------
// Konstanta layar
// ------------------------------------------------------------------

/** Tab kategori — underline <Tabs> TANPA icon (permintaan produk 2026-10-05):
    struktur PERSIS tab profil (label saja, indicator garis di bawah tab
    aktif). Nilai = enum API `category` apa adanya. */
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
// Tombol "Tandai semua dibaca" — ikon Checks dengan label aksesibilitas lengkap.
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
    <IconButton
      icon={Checks}
      size="sm"
      variant="ghost"
      loading={busy}
      accessibilityLabel={translate("Tandai semua dibaca")}
      accessibilityHint={translate("Menandai seluruh notifikasi sebagai sudah dibaca")}
      onPress={onPress}
    />
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
/**
 * LR-007 (perf-fix): satu baris notifikasi yang di-memo. Callback onPress /
 * onLongPress dibuat stabil di dalam via useCallback, sehingga toggle satu
 * baris (mis. mode pilih) tidak me-render ulang semua baris — tampilan dan
 * perilaku tidak berubah.
 *
 * PERF-FIX (TIM1-P2): status seleksi dibaca per-baris via
 * `useSyncExternalStore` dari `selectionStore` — `renderNotificationRow`
 * tidak lagi ber-dep pada `selected`/`selecting`, sehingga toggle satu
 * notifikasi tidak mengubah identitas renderItem dan tidak me-render ulang
 * semua baris terlihat. Hanya baris yang status `isSelected`-nya berubah
 * yang me-render ulang (snapshot boolean per baris).
 */
type NotificationSelectionState = { selecting: boolean; selected: ReadonlySet<string> }

function createNotificationSelectionStore() {
  let state: NotificationSelectionState = { selecting: false, selected: new Set<string>() }
  const listeners = new Set<() => void>()
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getState: () => state,
    setState: (next: NotificationSelectionState) => {
      state = next
      listeners.forEach((l) => l())
    },
  }
}
type NotificationSelectionStore = ReturnType<typeof createNotificationSelectionStore>

const NotificationRowView = memo(function NotificationRowView({
  row,
  showHeader,
  groupLabel,
  groupSub,
  sameDayAsNext,
  selectionStore,
  onOpen,
  onEnterSelectGroup,
  onToggleSelectGroup,
  onEnterSelect,
  onToggleSelect,
}: {
  row: NotificationRow
  showHeader: boolean
  groupLabel: string
  groupSub: string | null
  sameDayAsNext: boolean
  selectionStore: NotificationSelectionStore
  onOpen: (head: AppNotification, isGroup: boolean, members: AppNotification[]) => void
  onEnterSelectGroup: (items: AppNotification[]) => void
  onToggleSelectGroup: (items: AppNotification[]) => void
  onEnterSelect: (id: string) => void
  onToggleSelect: (id: string) => void
}) {
  const head = notificationRowHead(row)
  const isGroup = row.kind === "group"
  const members = isGroup ? row.items : [head]
  // Id anggota stabil per baris — untuk snapshot seleksi per baris.
  const memberIds = useMemo(() => members.map((m) => m.id), [row])
  // PERF-FIX (TIM1-P2): baca seleksi via store — bukan prop dari renderItem.
  const selecting = useSyncExternalStore(
    selectionStore.subscribe,
    () => selectionStore.getState().selecting,
  )
  const isSelected = useSyncExternalStore(
    selectionStore.subscribe,
    () => {
      const s = selectionStore.getState()
      return s.selecting && memberIds.every((id) => s.selected.has(id))
    },
  )

  const handlePress = useCallback(
    () => onOpen(head, isGroup, members),
    [onOpen, isGroup, head.id],
  )
  const handleLongPress = useCallback(
    () =>
      isGroup
        ? selecting
          ? onToggleSelectGroup(row.items)
          : onEnterSelectGroup(row.items)
        : selecting
          ? onToggleSelect(head.id)
          : onEnterSelect(head.id),
    [selecting, isGroup, onToggleSelectGroup, onEnterSelectGroup, onToggleSelect, onEnterSelect, head.id],
  )

  return (
    <View>
      {showHeader ? <NotificationDayHeader label={groupLabel} sub={groupSub} /> : null}
      <NotificationListItem
        title={isGroup ? describeSocialGroup(head.type ?? "", row.items) : head.title}
        body={isGroup ? undefined : head.body || undefined}
        category={notificationTypeUiCategory(head.type) ?? notificationUiCategory(head.category)}
        timestamp={formatTimeAgo(head.createdAt)}
        unread={isGroup ? true : !head.isRead}
        selected={isSelected}
        haptic
        onPress={handlePress}
        onLongPress={handleLongPress}
        ripple
        divider={sameDayAsNext}
      />
    </View>
  )
})

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
  // BFI-112: segarkan inbox saat event WS notification.new/unread_count tiba.
  useNotificationsRealtime()
  const toast = useToast()
  // Efek scroll: header terangkat (bayangan) saat daftar digulir.
  const { onScrollWorklet } = useScrollElevation()
  const listRef = useRef<FlatList<NotificationRow>>(null)
  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])
  useShellTabReselect("notifications", scrollToTop)
  const insets = useSafeAreaInsets()

  const [categoryState, setCategoryState] = useState<NotificationCategory | null>(null)
  // Item 40: kategori tersimpan di preferensi perangkat (useUiPrefs) —
  // pilihan tidak hilang setiap buka tab (pola sama dengan tab Transaksi).
  // State lokal menampung pemilihan sampai preferensi termuat.
  const notificationsCategory = useUiPref("notificationsCategory")
  const setPrefs = useSetUiPrefs()
  const category = categoryState ?? notificationsCategory
  const setCategory = useCallback(
    (next: NotificationCategory) => {
      setCategoryState(next)
      setPrefs({ notificationsCategory: next })
    },
    [setPrefs],
  )
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
    // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
    {
      refreshOnFocus: true,
      refreshOnFocusStaleMs: 30_000,
      compare: byTimestampDesc<AppNotification>((item) => item.createdAt),
    },
  )
  const { data: notifs, setData: setNotifs } = query

  // Agregasi tampilan (2026-09-28): notifikasi sosial (like/follow) yang
  // berurutan & dekat waktunya digabung satu baris. Murni tampilan — tidak
  // mengubah data/API. Transaksi/keuangan tidak pernah masuk grup (allowlist
  // di lib/notification-social-grouping).
  const rows = useMemo<NotificationRow[]>(() => groupSocialNotifications(notifs), [notifs])
  /**
   * PERF (tim8-komputasi P0): grup hari ("Hari ini"/"Kemarin"/tanggal)
   * dihitung SEKALI per baris di sini — bukan 3× per renderItem. Satu `now`
   * bersama untuk semua baris supaya "Hari ini" konsisten dalam satu pass.
   */
  const rowGroups = useMemo(() => {
    const now = new Date()
    return rows.map((row) => notificationDayGroup(notificationRowHead(row).createdAt, now))
  }, [rows])
  /**
   * LR-007 (perf-fix): renderItem stabil via useCallback + baris di-memo —
   * identitas renderItem tidak berubah tiap render; setiap baris hanya
   * re-render bila datanya sendiri berubah.
   */

  // Menu "⋮" + mode pilih (batch read/delete) + konfirmasi hapus
  const [menuOpen, setMenuOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [readAllBusy, setReadAllBusy] = useState(false)
  const readAllInFlight = useRef(false)
  const [confirm, setConfirm] = useState<"delete-selected" | "delete-read" | null>(null)
  // PERF-FIX (TIM1-P2): store seleksi untuk dibaca per-baris via
  // useSyncExternalStore (lihat NotificationRowView) — renderItem stabil.
  const selectionStoreRef = useRef<NotificationSelectionStore | null>(null)
  if (!selectionStoreRef.current) selectionStoreRef.current = createNotificationSelectionStore()
  const selectionStore = selectionStoreRef.current
  useEffect(() => {
    selectionStore.setState({ selecting, selected })
  }, [selecting, selected, selectionStore])

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

  /**
   * Tap satu baris GRUP: tandai SEMUA anggotanya dibaca (batch, di-chunk
   * BATCH_MAX = batas BatchNotificationIdsDto) lalu rute ke entitas target
   * (referenceType/referenceId sama untuk semua anggota grup).
   */
  const handleReadGroup = useCallback(
    (items: AppNotification[]) => {
      const ids = items.map((i) => i.id)
      const idSet = new Set(ids)
      setNotifs((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, isRead: true } : n)))
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += BATCH_MAX) chunks.push(ids.slice(i, i + BATCH_MAX))
      Promise.all(chunks.map((c) => api.notifications.markNotificationsReadBatch(c)))
        .then(() => refreshUnreadCount())
        .catch((err: unknown) => {
          // Rollback tidak diam-diam (pola CN-018 di handleRead).
          setNotifs((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, isRead: false } : n)))
          logWarn("notifications:mark-read-group", err)
          toast.show({
            title: "Gagal menandai dibaca",
            description: "Periksa koneksi Anda lalu coba lagi.",
            tone: "danger",
          })
        })
    },
    [setNotifs, toast.show],
  )

  /** Tekan lama satu baris grup → mode pilih dengan SEMUA anggotanya terpilih. */
  const enterSelectGroup = useCallback((items: AppNotification[]) => {
    haptic("select")
    setSelecting(true)
    setSelected(new Set(items.map((i) => i.id)))
  }, [])

  /** Toggle pilih satu baris grup saat mode pilih aktif. */
  const toggleSelectGroup = useCallback((items: AppNotification[]) => {
    haptic("select")
    setSelected((prev) => {
      const next = new Set(prev)
      const ids = items.map((i) => i.id)
      if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id))
      else for (const id of ids) if (next.size < BATCH_MAX) next.add(id)
      return next
    })
  }, [])

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

  // Navigate immediately; destination queries own loading/not-found/error states.
  const handleOpenNotification = useCallback(
    async (head: AppNotification, isGroup: boolean, items: AppNotification[]) => {
      if (selecting) {
        if (isGroup) toggleSelectGroup(items)
        else toggleSelect(head.id)
        return
      }
      if (isGroup) {
        // Grup hanya berisi yang belum dibaca (aturan agregasi).
        handleReadGroup(items)
      } else if (!head.isRead) {
        handleRead(head.id)
      }
      // CN-017: satu ketukan — bila entitas terkait bisa di-resolve
      // (referenceType/referenceId atau actionUrl), langsung ke sana
      // seperti tap push; bila tidak, baru ke layar detail.
      // Grup: reference sama untuk semua anggota → pakai head.
      router.push(routeForNotificationReference(head) ?? ROUTES.notificationDetail(head.id))
    },
    [selecting, toggleSelectGroup, toggleSelect, handleReadGroup, handleRead],
  )

  /** Tekan lama satu baris → mode pilih dengan baris itu sudah terpilih. */
  const enterSelect = useCallback((id: string) => {
    haptic("select")
    setSelecting(true)
    setSelected(new Set([id]))
  }, [])

  const renderNotificationRow = useCallback(
    ({ item: row, index }: { item: NotificationRow; index: number }) => {
      // PERF (tim8-komputasi P0): grup dibaca dari `rowGroups` yang
      // di-precompute — tanpa panggil notificationDayGroup per renderItem.
      const group = rowGroups[index] ?? notificationDayGroup(notificationRowHead(row).createdAt)
      const showHeader =
        index === 0 || (rowGroups[index - 1] != null && rowGroups[index - 1].key !== group.key)
      const sameDayAsNext =
        rowGroups[index + 1] != null && rowGroups[index + 1].key === group.key
      return (
        <NotificationRowView
          row={row}
          showHeader={showHeader}
          groupLabel={group.label}
          groupSub={group.sub}
          sameDayAsNext={sameDayAsNext}
          selectionStore={selectionStore}
          onOpen={handleOpenNotification}
          onEnterSelectGroup={enterSelectGroup}
          onToggleSelectGroup={toggleSelectGroup}
          onEnterSelect={enterSelect}
          onToggleSelect={toggleSelect}
        />
      )
    },
    [rowGroups, selectionStore, handleOpenNotification, enterSelectGroup, toggleSelectGroup, enterSelect, toggleSelect],
  )

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  const handleReadSelected = useCallback(() => {
    if (selectedIds.length === 0 || batchBusy) return
    // PERF-FIX (network P2): UI optimistis dulu (konsisten dengan tap satuan),
    // lalu kirim chunk 20 id per POST di background — satu POST 50 id bisa
    // 413/berat di beberapa proxy. Rollback + toast bila ada chunk yang gagal.
    const ids = new Set(selectedIds)
    const previous = notifs
    setNotifs((prev) => prev.map((n) => (ids.has(n.id) ? { ...n, isRead: true } : n)))
    void refreshUnreadCount()
    exitSelect()
    const chunks: string[][] = []
    for (let i = 0; i < selectedIds.length; i += 20) {
      chunks.push(selectedIds.slice(i, i + 20))
    }
    void (async () => {
      try {
        for (const chunk of chunks) {
          await api.notifications.markNotificationsReadBatch(chunk)
        }
      } catch (err: unknown) {
        setNotifs(previous)
        void refreshUnreadCount()
        logWarn("notifications:mark-read-batch", err)
        toast.show({
          title: "Notifikasi belum dapat ditandai",
          description: userMessage(err),
          tone: "danger",
        })
      }
    })()
  }, [selectedIds, batchBusy, exitSelect, notifs, toast.show])

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
    // Ref closes the same-frame gap before React commits the busy state, so a
    // double tap cannot send the bulk mutation twice.
    if (batchBusy || readAllInFlight.current || !hasUnread) return
    readAllInFlight.current = true
    setReadAllBusy(true)
    // Optimistic rows; the global badge is updated only after the server
    // confirms the mutation. Refreshing before the POST resolves can race and
    // restore the old unread count for the full polling interval.
    const previous = notifs
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })))
    try {
      await api.notifications.markAllNotificationsRead()
      // A successful read-all is authoritative for the unread badge. This
      // invalidates any poll started before the mutation (so its stale count
      // cannot race back in); later push/poll updates cover new arrivals.
      setUnreadCount(0)
      toast.show({ title: "Semua notifikasi ditandai dibaca", tone: "success", duration: 2000 })
    } catch (err: unknown) {
      setNotifs(previous)
      void refreshUnreadCount()
      logWarn("notifications:mark-all-read", err)
      toast.show({
        title: "Notifikasi belum dapat ditandai",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      readAllInFlight.current = false
      setReadAllBusy(false)
    }
  }, [batchBusy, hasUnread, notifs, toast.show])

  // FE-064: prop header di-memo agar memo <Header> bisa bail-out.
  // Ditaruh setelah exitSelect/handleReadSelected/handleReadAll dideklarasikan.
  const selectHeaderLeft = useMemo(
    () => (
      <IconButton
        icon={X}
        variant="ghost"
        accessibilityLabel={translate("Batal memilih")}
        onPress={exitSelect}
      />
    ),
    [exitSelect],
  )
  const selectHeaderRight = useMemo(
    () => (
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
    ),
    [selectedCount, batchBusy, handleReadSelected],
  )
  const headerLeft = useMemo(() => <DrawerMenuButton />, [])
  const headerRight = useMemo(
    () => (
      <>
        {/* Sidebar 2026-10-05: tombol Buat di header (syarat hapus pensil
            drawer) — sheet global "Buat baru". */}
        <IconButton
          icon={Plus}
          variant="ghost"
          accessibilityLabel={translate("Buat baru")}
          onPress={openCreateSheet}
        />
        {hasUnread || readAllBusy ? (
          <MarkAllReadButton busy={batchBusy || readAllBusy} onPress={() => void handleReadAll()} />
        ) : null}
        <IconButton
          icon={Funnel}
          variant="ghost"
          active={unreadOnly}
          accessibilityLabel={
            unreadOnly ? translate("Lihat semua notifikasi") : translate("Hanya yang belum dibaca")
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
    ),
    [hasUnread, readAllBusy, batchBusy, handleReadAll, unreadOnly, notifs.length],
  )

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
    // Item 41: jalan pintas ke pengaturan notifikasi dari menu.
    {
      key: "settings",
      label: "Pengaturan notifikasi",
      icon: GearSix,
      onPress: () => {
        setMenuOpen(false)
        router.push(ROUTES.notificationSettings)
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

  /**
   * R1-005 (2026-09-29, audit render-perf): placeholder & empty distabilkan —
   * identitas baru tiap render membatalkan `useMemo` di dalam <PaginatedList>
   * dan memaksa VirtualizedList render ulang kontainer.
   */
  const notifListLoading = useMemo(() => <NotificationsTabListSkeleton />, [])
  const notifListEmpty = useMemo(
    () => (
      <EmptyState
        icon={EMPTY_ICON[category]}
        title={unreadOnly ? "Tidak ada notifikasi belum dibaca" : "Belum ada notifikasi"}
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
    ),
    [category, unreadOnly],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      {selecting ? (
        <Header
          title={selectedCount > 0 ? translate(`${selectedCount} dipilih`) : "Pilih notifikasi"}
          titleAlign="left"
          showBack={false}
          separator={false}
          elevated={false}
          left={selectHeaderLeft}
          right={selectHeaderRight}
        />
      ) : (
        <Header
          title="Notifikasi"
          titleAlign="left"
          // Tab top-level (bottom navbar) — tidak ada layar "sebelumnya"
          // untuk kembali (seperti <Header title="Transaksi" showBack={false}/>).
          showBack={false}
          separator={false}
          elevated={false}
          // T5-002 (audit UI/UX intuitif 2026-09-29): drawer bisa dibuka dari
          // semua tab, bukan cuma Etalase.
          left={headerLeft}
          right={headerRight}
        />
      )}

      {/* Tab kategori — PERSIS pola tab profil (user-profile-screen): strip
          <Tabs> jadi anak LANGSUNG <Screen>, dalam alur normal di antara
          <Header> dan <PaginatedList> — tanpa wrapper animasi, tanpa z-index,
          tanpa padding ekstra. Strip memegang ruang layout-nya sendiri, jadi
          daftar SELALU mulai setelah strip: baris grup hari ("Kemarin,
          4 Okt 2026") tidak mungkin bertumpuk dengan tab.
          Saat memilih (mode batch) tab tetap tampil agar konteks kategori
          yang sedang dipilih tidak hilang. */}
      <Tabs<NotificationCategory>
        accessibilityLabel={translate("Kategori notifikasi")}
        items={CATEGORY_TABS}
        value={category}
        onChange={setCategory}
      />

      <PaginatedList
        {...query}
        // `data` diganti baris tampilan (hasil agregasi sosial); `query`
        // tetap membawa loading/error/pagination.
        data={rows}
        keyExtractor={notificationRowId}
        listRef={listRef}
        onScrollWorklet={onScrollWorklet}
        padded={false}
        // Audit: default <ListLoading/> merender 4 kartu h-24; baris
        // notifikasi jauh lebih rapat, sehingga daftar "melompat" saat data
        // tiba. Skeleton sebentuk barisnya dipasang di sini.
        loadingPlaceholder={notifListLoading}
        // Gap 0: pemisahnya adalah divider inset di tiap baris. Gap + divider
        // sekaligus membuat daftar terlihat bergaris ganda.
        gap={0}
        bottomPadding={insets.bottom + tokens.space[8]}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        empty={notifListEmpty}
        renderItem={renderNotificationRow}
      />

      {/* FE-099: judul "Notifikasi" dihapus — menduplikasi judul layar;
          sheet opsi berdiri tanpa judul. */}
      <ActionSheet
        visible={menuOpen}
        onRequestClose={() => setMenuOpen(false)}
        actions={hasRead ? menuActions : menuActions.filter((a) => a.key !== "delete-read")}
      />

      <Dialog
        title={
          confirm === "delete-read"
            ? "Hapus notifikasi yang sudah dibaca?"
            : translate("Hapus {x} notifikasi?", { x: selectedCount })
        }
        // FE-100: description mengulang judul dialog — dihapus (§9 aturan 2).
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
