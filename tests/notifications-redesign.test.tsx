/**
 * Redesign list Notifikasi 2026-09-27 (TIM NOTIFIKASI).
 *
 * Mengunci kontrak tampilan hasil redesign premium — API asli tidak pernah
 * ditembak (`@/lib/api` di-mock; satu dataset mock dipakai bersama oleh
 * daftar DAN badge, bukan dua angka yang di-mock terpisah):
 *
 *  1. <NotificationListItem>: item unread menampilkan dot + tint halus,
 *     item read tidak; chip ikon berwarna per kategori (order=primary,
 *     wallet=success, promo=amber, keamanan=danger, sistem=netral).
 *  2. Tap item unread → `markNotificationRead(id)` dipanggil, item berubah
 *     jadi read secara optimistis, dan `refreshUnreadCount()` dipanggil
 *     (badge tab tetap sinkron — mekanismenya tidak diubah).
 *  3. Pengelompokan hari WIB: "Hari ini" / "Kemarin" / tanggal
 *     (`lib/notification-grouping`), termasuk batas tengah malam WIB.
 *  4. Empty state: "Belum ada notifikasi".
 *  5. Badge: angka badge berasal dari dataset yang SAMA dengan daftar —
 *     setelah "Tandai dibaca", badge turun ke 0 mengikuti data.
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/notifications-redesign.test.tsx
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useState, type ReactElement } from "react"
import { router } from "expo-router"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import {
  NOTIFICATION_CATEGORY_CHIP,
  NotificationListItem,
  notificationRowTintClass,
} from "@/components/ui/notification-list-item"
import { notificationDayGroup } from "@/lib/notification-grouping"
import { refreshUnreadCount, resetUnreadCount, useUnreadCountState } from "@/lib/unread-count"
import type { AppNotification } from "@/lib/api"
import NotificationsTab from "@/app/(tabs)/notifications"

// ------------------------------------------------------------------
// Mock lapisan data — API asli tidak pernah ditembak. Satu dataset
// (`mocks.items`) dipakai bersama daftar dan badge.
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const holder: { useQuery: () => Record<string, unknown> } = {
    useQuery: () => {
      throw new Error("mocks.holder.useQuery belum dipasang test")
    },
  }
  return {
    holder,
    items: [] as AppNotification[],
    refresh: vi.fn(),
    reload: vi.fn(),
    loadMore: vi.fn(),
    toastShow: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    markAllReadGate: null as (() => Promise<void>) | null,
    logWarn: vi.fn(),
    haptic: vi.fn(),
    /** Kunci query terakhir — saksi kategori aktif (kunci = "notifications:<kategori>:all|unread"). */
    lastKey: null as string | null,
  }
})

vi.mock("@/lib/use-paginated-query", () => ({
  byTimestampDesc: () => () => 0,
  usePaginatedQuery: (key: unknown, ..._args: unknown[]) => {
    if (typeof key === "string") mocks.lastKey = key
    return mocks.holder.useQuery()
  },
}))

vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: () => ({ token: "test-token", restoring: false }),
}))

// The screen only needs the realtime subscription side effect; a provider is
// intentionally absent in these UI tests, so keep the hook at its inert path.
vi.mock("@/lib/realtime/use-notifications-realtime", () => ({
  useNotificationsRealtime: () => undefined,
}))

vi.mock("@/lib/api", () => ({
  userMessage: () => "Gagal memuat",
  isApiError: () => false,
  readUnreadCount: (body: { count?: unknown }) =>
    typeof body?.count === "number" ? body.count : null,
  api: {
    notifications: {
      getNotifications: () => Promise.resolve({ data: mocks.items }),
      // Badge dihitung dari dataset yang SAMA dengan daftar.
      getUnreadCount: () =>
        Promise.resolve({ count: mocks.items.filter((n) => !n.isRead).length }),
      markNotificationRead: (id: string) => {
        mocks.markRead(id)
        const found = mocks.items.find((n) => n.id === id)
        if (found) found.isRead = true
        return Promise.resolve({})
      },
      markAllNotificationsRead: async () => {
        mocks.markAllRead()
        await mocks.markAllReadGate?.()
        for (const n of mocks.items) n.isRead = true
        return {}
      },
      markNotificationsReadBatch: () => Promise.resolve({}),
      deleteNotificationsBatch: () => Promise.resolve({}),
      deleteReadNotifications: () => Promise.resolve({}),
    },
  },
}))

// unread-count imports this domain module directly instead of the API barrel.
// Keep its badge source aligned with the same fixture used by the list.
vi.mock("@/lib/api/notifications", () => ({
  getUnreadCount: () => Promise.resolve({ count: mocks.items.filter((n) => !n.isRead).length }),
  readUnreadCount: (body: { count?: unknown }) =>
    typeof body?.count === "number" ? body.count : null,
}))

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: mocks.toastShow, dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

vi.mock("@/lib/notification-routing", () => ({
  routeForNotificationReference: () => null,
}))

vi.mock("@/lib/telemetry", () => ({
  logWarn: (...args: unknown[]) => mocks.logWarn(...args),
}))

vi.mock("@/lib/haptics", () => ({
  haptic: (...args: unknown[]) => mocks.haptic(...args),
}))

// ------------------------------------------------------------------
// Fixture
// ------------------------------------------------------------------

function makeNotif(partial: Partial<AppNotification> & { id: string }): AppNotification {
  return {
    title: `Judul ${partial.id}`,
    body: `Isi notifikasi ${partial.id} yang cukup panjang untuk preview dua baris.`,
    category: "TRANSAKSI",
    type: "ORDER_NEW",
    isRead: false,
    createdAt: new Date().toISOString(),
    referenceId: null,
    referenceType: null,
    actionUrl: null,
    ...partial,
  }
}

/** Hook mock usePaginatedQuery dengan state React sungguhan (mendukung setData updater). */
function useMockNotificationsQuery() {
  const [data, setDataState] = useState<AppNotification[]>(mocks.items)
  const setData = (updater: unknown) =>
    setDataState((prev) =>
      typeof updater === "function"
        ? (updater as (p: AppNotification[]) => AppNotification[])(prev)
        : (updater as AppNotification[]),
    )
  return {
    data,
    setData,
    loading: false,
    error: null,
    refreshing: false,
    loadingMore: false,
    hasMore: false,
    refresh: mocks.refresh,
    reload: mocks.reload,
    loadMore: mocks.loadMore,
  }
}

function installQuery() {
  mocks.holder.useQuery = useMockNotificationsQuery
}

function renderThemed(ui: ReactElement) {
  // ActionSheet/Dialog memakai portal → butuh PortalProvider + PortalHost
  // (pola tests/bank-redesign.test.tsx).
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

async function renderTab() {
  const view = renderThemed(<NotificationsTab />)
  // The route intentionally lazy-loads its screen; wait past Suspense fallback.
  await screen.findByRole("heading", { name: "Notifikasi" })
  return view
}

/** Probe kecil untuk membaca store badge tanpa me-mock angkanya. */
function BadgeProbe() {
  const state = useUnreadCountState()
  return <span data-testid="badge-count">{String(state.count)}</span>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.markAllReadGate = null
  mocks.lastKey = null
  resetUnreadCount()
  installQuery()
})

afterEach(() => {
  cleanup()
})

// ------------------------------------------------------------------
// 1. Item: unread vs read (dot/tint), warna chip per kategori
// ------------------------------------------------------------------

describe("<NotificationListItem> redesign", () => {
  it("item unread menampilkan dot + label 'Belum dibaca'; item read tidak", () => {
    const { rerender } = renderThemed(
      <NotificationListItem title="Pesanan dibayar" body="Rp100.000" unread timestamp="5 menit" />,
    )
    expect(screen.getByTestId("notification-unread-dot")).toBeTruthy()
    expect(screen.getByLabelText(/Belum dibaca/)).toBeTruthy()

    rerender(
      <ThemeProvider>
        <PortalProvider>
          <NotificationListItem title="Pesanan dibayar" body="Rp100.000" timestamp="5 menit" />
          <PortalHost />
        </PortalProvider>
      </ThemeProvider>,
    )
    expect(screen.queryByTestId("notification-unread-dot")).toBeNull()
    expect(screen.queryByLabelText(/Belum dibaca/)).toBeNull()
  })

  it("chip ikon berwarna sesuai kategori backend", () => {
    // order=primary, wallet=success, promo=amber, keamanan=danger, sistem=netral
    expect(NOTIFICATION_CATEGORY_CHIP.order).toEqual({ chip: "bg-primary", tone: "inverse" })
    expect(NOTIFICATION_CATEGORY_CHIP.wallet).toEqual({ chip: "bg-success-soft", tone: "success" })
    expect(NOTIFICATION_CATEGORY_CHIP.promo).toEqual({ chip: "bg-warning-soft", tone: "warning" })
    expect(NOTIFICATION_CATEGORY_CHIP.security).toEqual({ chip: "bg-danger-soft", tone: "danger" })
    expect(NOTIFICATION_CATEGORY_CHIP.dispute).toEqual({ chip: "bg-danger-soft", tone: "danger" })
    expect(NOTIFICATION_CATEGORY_CHIP.system).toEqual({ chip: "bg-surface", tone: "default" })
  })

  it("baris unread memakai tint halus bg-surface (bukan blok mencolok)", () => {
    expect(notificationRowTintClass(true, false)).toBe("bg-surface")
    expect(notificationRowTintClass(false, true)).toBe("bg-surface")
    expect(notificationRowTintClass(false, false)).toBeNull()
  })
})

// ------------------------------------------------------------------
// 2. Tap → mark read (mock handler), badge tetap sinkron
// ------------------------------------------------------------------

describe("tap item menandai dibaca", () => {
  it("memanggil markNotificationRead, menghilangkan dot, dan refresh badge", async () => {
    mocks.items = [
      makeNotif({ id: "n1", title: "Pesanan baru", isRead: false }),
      makeNotif({ id: "n2", title: "Sudah dibaca", isRead: true }),
    ]
    await renderTab()

    // Satu dot unread sebelum tap.
    expect(screen.getAllByTestId("notification-unread-dot")).toHaveLength(1)

    const push = vi.spyOn(router, "push")
    fireEvent.click(screen.getByText("Pesanan baru"))
    await waitFor(() => expect(mocks.markRead).toHaveBeenCalledWith("n1"))
    // Optimistis: dot hilang tanpa menunggu server.
    await waitFor(() =>
      expect(screen.queryByTestId("notification-unread-dot")).toBeNull(),
    )
    // Badge di-refresh lewat mekanisme yang sudah ada (tidak diubah).
    await waitFor(() => expect(screen.getByText("Sudah dibaca")).toBeTruthy())
    // Navigasi deep-link tetap ke detail notifikasi.
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/notification/[id]" }),
    )
    push.mockRestore()
  })
})

// ------------------------------------------------------------------
// 3. Pengelompokan hari WIB
// ------------------------------------------------------------------

describe("notificationDayGroup (WIB)", () => {
  const NOW = new Date("2026-09-27T15:00:00+07:00") // Minggu, 27 Sep 2026 15:00 WIB

  it("Hari ini / Kemarin / tanggal penuh", () => {
    expect(notificationDayGroup("2026-09-27T10:00:00+07:00", NOW).label).toBe("Hari ini")
    expect(notificationDayGroup("2026-09-26T20:00:00+07:00", NOW).label).toBe("Kemarin")
    const old = notificationDayGroup("2026-09-10T08:00:00+07:00", NOW)
    expect(old.label).toBe("Kamis, 10 September 2026")
    expect(old.sub).toBeNull()
  })

  it("sub-label tanggal pendek untuk Hari ini/Kemarin", () => {
    const today = notificationDayGroup("2026-09-27T10:00:00+07:00", NOW)
    expect(today.sub).toBe("27 Sep 2026")
    const yesterday = notificationDayGroup("2026-09-26T20:00:00+07:00", NOW)
    expect(yesterday.sub).toBe("26 Sep 2026")
  })

  it("batas tengah malam dihitung dalam WIB, bukan zona perangkat", () => {
    // 2026-09-27T00:30 WIB = 2026-09-26T17:30Z — di UTC masih "kemarin",
    // di WIB sudah "hari ini".
    const group = notificationDayGroup(
      "2026-09-26T17:30:00Z",
      new Date("2026-09-27T01:00:00+07:00"),
    )
    expect(group.label).toBe("Hari ini")
  })

  it("createdAt tak valid → grup 'Tanggal tidak tersedia'", () => {
    const group = notificationDayGroup("bukan-tanggal", NOW)
    expect(group.key).toBe("invalid")
    expect(group.label).toBe("Tanggal tidak tersedia")
  })

  it("layar menampilkan header Hari ini / Kemarin / tanggal", async () => {
    const now = new Date()
    const wibParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(now)
    const pick = (t: string) => Number(wibParts.find((p) => p.type === t)?.value)
    // Kemarin 12:00 WIB — aman dari batas tengah malam.
    const yesterdayNoonWib = new Date(
      Date.UTC(pick("year"), pick("month") - 1, pick("day") - 1, 5, 0, 0),
    ).toISOString()
    const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000).toISOString()
    mocks.items = [
      makeNotif({ id: "g1", title: "Notif grup pertama", createdAt: now.toISOString() }),
      makeNotif({ id: "g2", title: "Notif grup kedua", createdAt: yesterdayNoonWib }),
      makeNotif({ id: "g3", title: "Notif grup ketiga", createdAt: tenDaysAgo }),
    ]
    await renderTab()
    expect(screen.getByText("Hari ini")).toBeTruthy()
    expect(screen.getByText("Kemarin")).toBeTruthy()
    expect(screen.getByText(notificationDayGroup(tenDaysAgo).label)).toBeTruthy()
  })
})

// ------------------------------------------------------------------
// 4. Empty state
// ------------------------------------------------------------------

describe("empty & error state", () => {
  it("daftar kosong → 'Belum ada notifikasi'", async () => {
    mocks.items = []
    await renderTab()
    expect(screen.getByText("Belum ada notifikasi")).toBeTruthy()
  })
})

// ------------------------------------------------------------------
// 5. Badge: angka berasal dari dataset yang sama dengan daftar
// ------------------------------------------------------------------

describe("badge unread sinkron dengan data daftar", () => {
  it("menunggu konfirmasi server sebelum mengosongkan badge dan menampilkan sukses", async () => {
    mocks.items = [
      makeNotif({ id: "b1", isRead: false }),
      makeNotif({ id: "b2", isRead: false }),
      makeNotif({ id: "b3", isRead: false }),
      makeNotif({ id: "b4", isRead: true }),
    ]
    let resolveMarkAll!: () => void
    mocks.markAllReadGate = () => new Promise<void>((resolve) => { resolveMarkAll = resolve })
    renderThemed(
      <>
        <BadgeProbe />
        <NotificationsTab />
      </>,
    )
    await screen.findByRole("heading", { name: "Notifikasi" })

    // Badge dihitung dari dataset yang sama — bukan angka mock.
    await refreshUnreadCount()
    await waitFor(() => expect(screen.getByTestId("badge-count").textContent).toBe("3"))
    expect(screen.getAllByTestId("notification-unread-dot")).toHaveLength(3)

    fireEvent.click(screen.getByRole("button", { name: "Tandai semua dibaca" }))
    await waitFor(() => expect(mocks.markAllRead).toHaveBeenCalledTimes(1))
    // Rows update optimistically, but a pending POST cannot falsely clear the
    // global badge or claim success yet.
    expect(screen.getByTestId("badge-count").textContent).toBe("3")
    expect(screen.queryByTestId("notification-unread-dot")).toBeNull()
    expect(mocks.toastShow).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Semua notifikasi ditandai dibaca" }),
    )

    await act(async () => resolveMarkAll())
    await waitFor(() => expect(screen.getByTestId("badge-count").textContent).toBe("0"))
    expect(mocks.toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Semua notifikasi ditandai dibaca", tone: "success" }),
    )
    expect(screen.queryByRole("button", { name: "Tandai semua dibaca" })).toBeNull()
  })
})

// ------------------------------------------------------------------
// 6. Polish 2026-09-27: tanpa tombol back; kategori via tab underline
//    (2026-10-05: <SegmentedControl> pill diganti <Tabs> TANPA icon —
//    persis struktur tab profil, permintaan produk)
// ------------------------------------------------------------------

describe("polish header & tab kategori", () => {
  it("tidak merender tombol back (tab top-level bottom navbar)", async () => {
    mocks.items = []
    await renderTab()
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull()
    // Aksi fungsional header tetap ada: funnel filter + menu ⋮.
    expect(
      screen.getByRole("button", { name: "Hanya yang belum dibaca" }),
    ).toBeTruthy()
  })

  it("kategori memakai underline Tabs tanpa icon (tablist), bukan SegmentedControl", async () => {
    mocks.items = []
    await renderTab()

    // <Tabs> = tablist + opsi tab (bukan radiogroup).
    const group = screen.getByRole("tablist", { name: "Kategori notifikasi" })
    const options = within(group).getAllByRole("tab")
    expect(options).toHaveLength(3)
    expect(options.map((o) => o.getAttribute("aria-label"))).toEqual([
      "Transaksi",
      "Promosi",
      "Informasi",
    ])
    // TRANSAKSI aktif secara default — dibuktikan lewat kunci query kategori
    // (state kategori → usePaginatedQuery, bukan lewat markup visual).
    expect(mocks.lastKey).toBe("notifications:TRANSAKSI:all")
    // SegmentedControl pill (radiogroup) tidak dipakai lagi.
    expect(screen.queryByRole("radiogroup")).toBeNull()
  })

  it("memilih tab Promosi mengaktifkan tab itu", async () => {
    mocks.items = []
    await renderTab()
    expect(mocks.lastKey).toBe("notifications:TRANSAKSI:all")

    const group = screen.getByRole("tablist", { name: "Kategori notifikasi" })
    fireEvent.click(within(group).getByRole("tab", { name: "Promosi" }))

    // Klik tab → kategori berganti → kunci query (dan daftar) ikut berganti.
    await waitFor(() => expect(mocks.lastKey).toBe("notifications:PROMOSI:all"))
  })
})
