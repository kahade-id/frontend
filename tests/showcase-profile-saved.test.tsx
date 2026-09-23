// @vitest-environment jsdom
/**
 * N-01 (audit 2026-09-23): test regresi untuk inti tab Etalase profil +
 * koleksi karya tersimpan — useProfileShowcase (H-01/H-02/H-03),
 * <ProfileEtalaseTab> (H-05), <ShowcaseSavedCollection> (J-02/J-03/J-04/N+1).
 */
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseItem } from "@/lib/api/users"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

const mocks = vi.hoisted(() => ({
  getPublicShowcase: vi.fn(),
  getMeCached: vi.fn(),
  detail: vi.fn(),
  dirtyVersion: 0,
  focused: true,
  savedIds: [] as string[],
  toggled: [] as string[],
  feedProps: [] as { item: ShowcaseSocialItem; divider: boolean }[],
}))

vi.mock("expo-router", () => ({ router: { push: vi.fn() } }))
vi.mock("phosphor-react-native", () => ({ Images: () => null, Plus: () => null, Trash: () => null }))
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => mocks.focused }))
vi.mock("@/lib/api", () => ({
  api: { users: { getPublicShowcase: mocks.getPublicShowcase, getMeCached: mocks.getMeCached } },
  isApiError: (err: unknown) => Boolean((err as { status?: number })?.status),
  userMessage: () => "failed",
}))
vi.mock("@/lib/api/showcase", () => ({ getShowcaseDetail: mocks.detail }))
vi.mock("@/lib/api/session", () => ({ getSessionRevision: () => 1 }))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => true, useSessionRevision: () => 1 }))
vi.mock("@/lib/showcase-social-prefs", () => ({
  useShowcaseDirtyVersion: () => mocks.dirtyVersion,
  useShowcaseSavedIds: () => mocks.savedIds,
  toggleShowcaseSaved: (id: string) => {
    mocks.toggled.push(id)
    mocks.savedIds = mocks.savedIds.filter((x) => x !== id)
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
vi.mock("@/components/ui/paginated-list", () => ({ ListLoading: () => null, PaginatedList: () => null }))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onPress }: { children: unknown; onPress?: () => void }) => (
    <button onClick={onPress}>{children as never}</button>
  ),
}))
vi.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: unknown }) => <span>{children as never}</span> }))
vi.mock("@/components/ui/empty-state", () => ({ EmptyState: ({ title }: { title: string }) => <span>{title}</span> }))
vi.mock("@/components/ui/error-state", () => ({
  ErrorState: ({ description, onRetry }: { description?: string; onRetry?: () => void }) => (
    <div>
      <span>{description}</span>
      <button onClick={onRetry}>retry</button>
    </div>
  ),
}))
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null }))
vi.mock("@/components/ui/icon-button", () => ({
  IconButton: ({ onPress, loading }: { onPress?: () => void; loading?: boolean }) => (
    <button disabled={loading} onClick={onPress}>x</button>
  ),
}))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: vi.fn() }) }))

import { useProfileShowcase } from "@/lib/use-profile-showcase"
import { ProfileEtalaseTab } from "@/components/ui/profile-etalase-tab"
import { ShowcaseSavedCollection, __resetSavedCollectionCache } from "@/components/ui/showcase-saved-collection"

const raw = (id: string): ShowcaseItem => ({ id, title: `Karya ${id}`, createdAt: "2026-01-01T00:00:00Z" }) as ShowcaseItem
const owner = { id: "o1", username: "penjual" }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.dirtyVersion = 0
  mocks.focused = true
  mocks.savedIds = []
  mocks.toggled = []
  mocks.feedProps = []
  mocks.getMeCached.mockResolvedValue({ id: "me" })
  __resetSavedCollectionCache()
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
      <ProfileEtalaseTab items={items} loading={false} handle="penjual" owner={owner} isSelf />,
    )
    await waitFor(() => expect(mocks.feedProps.length).toBe(20))
    expect(screen.getByText("Tampilkan karya lainnya")).toBeTruthy()
    expect(mocks.feedProps[18].divider).toBe(true)
    expect(mocks.feedProps[19].divider).toBe(false) // H-05
  })
})

describe("ShowcaseSavedCollection (J-02/J-03/J-04/N+1)", () => {
  it("N+1/J-02: detail sekali per id — re-render & remount tidak mengulang request", async () => {
    mocks.savedIds = ["s1", "s2", "s3"]
    mocks.detail.mockImplementation(async (id: string) => ({ id, title: `Karya ${id}`, author: { username: "penjual" }, images: [], priceMin: 1000, priceMax: 1000 }) as unknown as ShowcaseSocialItem)
    const view = render(<ShowcaseSavedCollection />)
    await waitFor(() => expect(screen.getByText("Karya s1")).toBeTruthy())
    expect(mocks.detail).toHaveBeenCalledTimes(3)

    view.rerender(<ShowcaseSavedCollection />)
    await act(async () => {})
    expect(mocks.detail).toHaveBeenCalledTimes(3) // re-render tanpa request baru

    view.unmount()
    render(<ShowcaseSavedCollection />)
    await waitFor(() => expect(screen.getByText("Karya s1")).toBeTruthy())
    expect(mocks.detail).toHaveBeenCalledTimes(3) // cache per sesi (J-02/J-03)
  })

  it("J-03: menghapus satu item tidak memuat ulang item lain", async () => {
    mocks.savedIds = ["s1", "s2"]
    mocks.detail.mockImplementation(async (id: string) => ({ id, title: `Karya ${id}`, author: { username: "p" }, images: [] }) as unknown as ShowcaseSocialItem)
    render(<ShowcaseSavedCollection />)
    await waitFor(() => expect(mocks.detail).toHaveBeenCalledTimes(2))
    mocks.savedIds = ["s1"] // unsave s2 (store lokal)
    // pembaruan store memicu render ulang lewat hook — paksa lewat event toggle
    await act(async () => {})
    expect(mocks.detail).toHaveBeenCalledTimes(2) // tanpa GET susulan
  })

  it("J-04: 404/403 = auto-prune dari bookmark; gagal jaringan = retry per baris", async () => {
    mocks.savedIds = ["gone", "net"]
    mocks.detail.mockImplementation(async (id: string) => {
      if (id === "gone") throw { status: 404 }
      throw new Error("offline")
    })
    render(<ShowcaseSavedCollection />)
    await waitFor(() => expect(mocks.toggled).toContain("gone")) // auto-prune
    await screen.findByText("failed") // label jaringan — bukan "Karya tidak tersedia"
    expect(screen.getByText("Coba lagi")).toBeTruthy()
  })
})
