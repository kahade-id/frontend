// @vitest-environment jsdom
/**
 * N-01 (audit 2026-09-23): test regresi untuk inti tab Etalase profil +
 * koleksi karya tersimpan — useProfileShowcase (H-01/H-02/H-03),
 * <ProfileEtalaseTab> (H-05), <ShowcaseSavedCollection> (item 54: baca server).
 *
 * CATATAN: file ini ditulis dengan React.createElement (bukan sintaks JSX)
 * karena transform JSX .tsx tidak berjalan di lingkungan vitest lokal
 * (vite 8 + vitest 5) — lihat smoke test 2026-09-28.
 */
import * as React from "react"
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseItem } from "@/lib/api/users"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

const h = React.createElement

const mocks = vi.hoisted(() => ({
  getPublicShowcase: vi.fn(),
  getMeCached: vi.fn(),
  detail: vi.fn(),
  getSavedShowcases: vi.fn(),
  removeSavedShowcase: vi.fn(),
  dirtyVersion: 0,
  focused: true,
  savedIds: [] as string[],
  toggled: [] as string[],
  savedStateSet: [] as { id: string; saved: boolean }[],
  feedProps: [] as { item: ShowcaseSocialItem; divider: boolean }[],
}))

vi.mock("expo-router", () => ({ router: { push: vi.fn() } }))
// Ikon yang diimpor subtree ini sering bertambah — mock permisif: nama ikon
// apa pun → komponen kosong, supaya tes tidak basi tiap ada ikon baru.
vi.mock("phosphor-react-native", () => {
  const Icon = () => null
  return new Proxy({}, { has: () => true, get: (_t, prop) => (prop === "then" ? undefined : Icon) })
})
vi.mock("expo-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useIsFocused: () => mocks.focused,
}))
vi.mock("@/lib/api", () => ({
  api: { users: { getPublicShowcase: mocks.getPublicShowcase, getMeCached: mocks.getMeCached } },
  isApiError: (err: unknown) => Boolean((err as { status?: number })?.status),
  userMessage: () => "failed",
}))
vi.mock("@/lib/api/showcase", () => ({
  getShowcaseDetail: mocks.detail,
  getSavedShowcases: mocks.getSavedShowcases,
  removeSavedShowcase: mocks.removeSavedShowcase,
}))
vi.mock("@/lib/api/session", () => ({ getSessionRevision: () => 1 }))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => true, useSessionRevision: () => 1 }))
vi.mock("@/lib/showcase-social-prefs", () => ({
  useShowcaseDirtyVersion: () => mocks.dirtyVersion,
  // F-01/C-01 (audit 2026-09-24): ledger hitungan komentar — tanpa event.
  showcaseCommentCountSeq: () => 0,
  showcaseCommentCountsSince: () => ({ events: [], seq: 0 }),
  useShowcaseCommentCountSeq: () => 0,
  useShowcaseSavedIds: () => mocks.savedIds,
  // U-01 (audit 2026-09-24): kuota tersimpan kini ditampilkan di header.
  SHOWCASE_SAVED_LIMIT: 25,
  toggleShowcaseSaved: (id: string) => {
    mocks.toggled.push(id)
    mocks.savedIds = mocks.savedIds.filter((x) => x !== id)
  },
  setShowcaseSavedState: (id: string, saved: boolean) => {
    mocks.savedStateSet.push({ id, saved })
  },
  loadShowcaseBookmarks: vi.fn(),
}))
vi.mock("@/lib/use-showcase-social-actions", () => ({ useShowcaseSocialActions: () => ({}) }))
vi.mock("@/components/ui/showcase-feed-item", () => ({
  ShowcaseFeedItem: (props: { item: ShowcaseSocialItem; divider: boolean }) => {
    mocks.feedProps.push(props)
    return null
  },
}))
vi.mock("@/components/ui/showcase-comments-sheet", () => ({ ShowcaseCommentsSheet: () => null }))
vi.mock("@/components/ui/showcase-report-sheet", () => ({ ShowcaseReportSheet: () => null }))
// Sheet share (PR #110) memanggil useTheme/useToast di dalam BottomSheet —
// sama seperti comments/report sheet, cukup null di sini (bukan objek test).
vi.mock("@/components/ui/showcase-share-sheet", () => ({ ShowcaseShareSheet: () => null }))
vi.mock("@/components/ui/paginated-list", () => ({ ListLoading: () => null, PaginatedList: () => null }))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onPress }: { children: unknown; onPress?: () => void }) =>
    h("button", { onClick: onPress }, children as never),
}))
vi.mock("@/components/ui/text", () => ({
  Text: ({ children }: { children: unknown }) => h("span", null, children as never),
}))
vi.mock("@/components/ui/empty-state", () => ({
  EmptyState: ({ title }: { title: string }) => h("span", null, title),
}))
vi.mock("@/components/ui/error-state", () => ({
  ErrorState: ({ description, onRetry }: { description?: string; onRetry?: () => void }) =>
    h(
      "div",
      null,
      h("span", null, description),
      h("button", { onClick: onRetry }, "retry"),
    ),
}))
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null }))
vi.mock("@/components/ui/icon-button", () => ({
  IconButton: ({
    onPress,
    loading,
    accessibilityLabel,
    disabled,
  }: {
    onPress?: () => void
    loading?: boolean
    accessibilityLabel?: string
    disabled?: boolean
  }) =>
    h(
      "button",
      { disabled: loading || disabled, onClick: onPress, "aria-label": accessibilityLabel },
      "x",
    ),
}))
vi.mock("@/lib/routes", () => ({ ROUTES: { showcaseDetail: (id: string) => `/showcase/${id}` } }))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: vi.fn() }) }))

import { invalidateQueryCache } from "@/lib/query-cache"
import { useProfileShowcase } from "@/lib/use-profile-showcase"
import { ProfileEtalaseTab } from "@/components/ui/profile-etalase-tab"
import { ShowcaseSavedCollection } from "@/components/ui/showcase-saved-collection"

const raw = (id: string): ShowcaseItem =>
  ({ id, title: `Karya ${id}`, createdAt: "2026-01-01T00:00:00Z" }) as ShowcaseItem
const owner = { id: "o1", username: "penjual" }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Katalog publik di-cache lintas test (kunci `public-showcase:{username}`)
  // — kosongkan agar tiap test mulai dari cache miss.
  invalidateQueryCache()
  mocks.dirtyVersion = 0
  mocks.focused = true
  mocks.savedIds = []
  mocks.toggled = []
  mocks.savedStateSet = []
  mocks.feedProps = []
  mocks.getMeCached.mockResolvedValue({ id: "me" })
  mocks.getSavedShowcases.mockReset()
  mocks.removeSavedShowcase.mockReset()
})
afterEach(cleanup)

describe("useProfileShowcase (H-01/H-02/H-03)", () => {
  it("H-03: loading mulai true — tanpa kilatan empty state", () => {
    const { result } = renderHook(() => useProfileShowcase())
    expect(result.current.loading).toBe(true)
    expect(result.current.items).toEqual([])
  })

  it("H-01: refresh dirty/fokus TIDAK menyalakan loading (tanpa skeleton)", async () => {
    mocks.getPublicShowcase.mockResolvedValue([raw("a")])
    const { result, rerender } = renderHook(() => useProfileShowcase())
    act(() => result.current.fetch("alice"))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.loading).toBe(false)

    const slow = deferred<ShowcaseItem[]>()
    mocks.getPublicShowcase.mockReturnValueOnce(slow.promise)
    mocks.dirtyVersion = 1
    rerender()
    // Selama refresh diam berjalan: loading tetap false, item lama tampil.
    expect(result.current.loading).toBe(false)
    expect(result.current.items).toHaveLength(1)
    await act(async () => slow.resolve([raw("a"), raw("b")]))
    await waitFor(() => expect(result.current.items).toHaveLength(2))
    expect(result.current.loading).toBe(false)
  })

  it("H-02: refresh diam gagal TIDAK mengosongkan list", async () => {
    mocks.getPublicShowcase.mockResolvedValue([raw("a")])
    const { result, rerender } = renderHook(() => useProfileShowcase())
    act(() => result.current.fetch("alice"))
    await waitFor(() => expect(result.current.items).toHaveLength(1))

    mocks.getPublicShowcase.mockRejectedValueOnce(new Error("offline"))
    mocks.dirtyVersion = 1
    rerender()
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.items).toHaveLength(1) // data terakhir tetap
    expect(result.current.loading).toBe(false)
  })
})

describe("ProfileEtalaseTab (H-05)", () => {
  it("H-05: divider dihitung dari slice render — kartu terakhir sebelum 'Tampilkan lainnya' tanpa divider", async () => {
    const items = Array.from({ length: 25 }, (_, i) => raw(`it-${i}`))
    render(
      h(ProfileEtalaseTab, { items, loading: false, handle: "penjual", owner, isSelf: true }),
    )
    // FS-002 (audit performa): jendela awal 10 kartu (dulu 20).
    await waitFor(() => expect(mocks.feedProps.length).toBe(10))
    expect(screen.getByText("Tampilkan etalase lainnya")).toBeTruthy()
    expect(mocks.feedProps[8].divider).toBe(true)
    expect(mocks.feedProps[9].divider).toBe(false) // H-05
  })
})

describe("ShowcaseSavedCollection (FE-IMP-1 item 54: baca dari server)", () => {
  const entry = (id: string) => ({
    item: {
      id,
      title: `Karya ${id}`,
      author: { userId: "u", username: "penjual" },
      images: [],
      priceMin: 1000,
      priceMax: 1000,
    } as unknown as ShowcaseSocialItem,
    savedAt: "2026-09-28T00:00:00.000Z",
  })

  it("satu request ke /v1/showcase/saved (bukan N+1 detail per id)", async () => {
    mocks.getSavedShowcases.mockResolvedValue({
      data: [entry("s1"), entry("s2")],
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    })
    render(h(ShowcaseSavedCollection))
    await waitFor(() => expect(mocks.getSavedShowcases).toHaveBeenCalledTimes(1))
    // NP-008: halaman pertama = cursor null (keyset), bukan nomor halaman.
    expect(mocks.getSavedShowcases).toHaveBeenCalledWith({ cursor: null, limit: 20 }, expect.anything())
    expect(mocks.detail).not.toHaveBeenCalled() // tanpa GET detail per id
    await waitFor(() => expect(screen.getByText("Karya s1")).toBeTruthy())
    expect(screen.getByText("Karya s2")).toBeTruthy()
    expect(screen.getAllByText("@penjual").length).toBeGreaterThan(0)
  })

  it("Muat lagi mengambil halaman berikut dan menempelkan hasilnya", async () => {
    mocks.getSavedShowcases
      .mockResolvedValueOnce({
        data: [entry("s1")],
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
        nextCursor: "c2",
      })
      .mockResolvedValueOnce({
        data: [entry("s2")],
        page: 2,
        limit: 20,
        total: 2,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
        nextCursor: null,
      })
    render(h(ShowcaseSavedCollection))
    await waitFor(() => expect(screen.getByText("Karya s1")).toBeTruthy())
    await act(async () => {
      ;(screen.getByText("Muat lagi") as HTMLElement).click()
    })
    await waitFor(() => expect(mocks.getSavedShowcases).toHaveBeenCalledTimes(2))
    expect(mocks.getSavedShowcases).toHaveBeenLastCalledWith(
      { cursor: "c2", limit: 20 },
      expect.anything(),
    )
    expect(screen.getByText("Karya s1")).toBeTruthy()
    expect(screen.getByText("Karya s2")).toBeTruthy()
  })

  it("hapus = DELETE server + optimistis hilang + sinkron store lokal", async () => {
    mocks.getSavedShowcases.mockResolvedValue({
      data: [entry("s1"), entry("s2")],
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    })
    mocks.removeSavedShowcase.mockResolvedValue(undefined)
    render(h(ShowcaseSavedCollection))
    await waitFor(() => expect(screen.getByText("Karya s1")).toBeTruthy())
    const trashButtons = screen.getAllByLabelText("Hapus etalase tersimpan")
    await act(async () => {
      ;(trashButtons[0] as HTMLElement).click()
    })
    await waitFor(() => expect(mocks.removeSavedShowcase).toHaveBeenCalledWith("s1"))
    expect(mocks.savedStateSet).toContainEqual({ id: "s1", saved: false })
    expect(screen.queryByText("Karya s1")).toBeNull() // optimistis hilang
    expect(screen.getByText("Karya s2")).toBeTruthy()
  })

  it("gagal muat = pesan error + tombol Coba lagi memuat ulang", async () => {
    mocks.getSavedShowcases.mockRejectedValueOnce(new Error("offline"))
    render(h(ShowcaseSavedCollection))
    await waitFor(() => expect(screen.getByText("Coba lagi")).toBeTruthy())
    mocks.getSavedShowcases.mockResolvedValueOnce({
      data: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    })
    await act(async () => {
      ;(screen.getByText("Coba lagi") as HTMLElement).click()
    })
    await waitFor(() => expect(mocks.getSavedShowcases).toHaveBeenCalledTimes(2))
    expect(screen.getByText("Belum ada etalase tersimpan")).toBeTruthy()
  })
})
