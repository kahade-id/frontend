// @vitest-environment jsdom
import { type ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseFeedPage, ShowcaseSocialItem } from "@/lib/api/showcase"
const mocks = vi.hoisted(() => ({
  feed: vi.fn(), followingIds: vi.fn(), me: vi.fn(), session: false,
  params: { kind: "following" } as Record<string, string>, renders: 0,
  // N-02 (audit 2026-09-23): versi dirty & fokus HIDUP (bukan konstan) —
  // regresi A-01/A-08 harus bisa ditangkap test di bawah.
  dirtyVersion: 0, focused: true,
}))
// Modul native di lingkungan test: cukup stub nol / hook fokus statis.
// Ikon feed sering bertambah (CardsThree, ShoppingBag, …) — mock permisif:
// nama ikon apa pun → komponen kosong, supaya tes ini tidak basi tiap ada ikon baru.
vi.mock("phosphor-react-native", () => {
  const Icon = () => null
  return new Proxy({}, { has: () => true, get: (_t, prop) => (prop === "then" ? undefined : Icon) })
})
// S-04: feed-tab memakai useToast (aksi "Tidak tertarik" bisa diurungkan);
// provider asli hanya ada di app/_layout.tsx, jadi di test di-mock.
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: vi.fn() }) }))
// Feed-tab membaca mode tema untuk tombol "ke atas" (elevasi) — provider
// asli ada di app/_layout.tsx.
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ mode: "light", preference: "light", setPreference: vi.fn(), toggle: vi.fn() }),
}))
vi.mock("react-native-reanimated", () => ({ default: { View: ({ children }: { children: ReactNode }) => <>{children}</> } }))
// SATU mock expo-router: dua `vi.mock` untuk modul yang sama saling menimpa
// (yang terakhir menang) — dulu `useLocalSearchParams` tertimpa stub asli
// sehingga `kind` tidak pernah "following" di tes ini.
vi.mock("expo-router", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  router: { push: vi.fn(), setParams: vi.fn() },
  useLocalSearchParams: () => mocks.params,
  useIsFocused: () => mocks.focused,
}))
// FE-076: daftar akun yang diikuti dibaca SATU request (`getMyFollowingIds`),
// bukan loop halaman `getFollowing`.
vi.mock("@/lib/api", () => ({ api: { users: { getMe: mocks.me, getMyFollowingIds: mocks.followingIds } }, isApiError: () => false, userMessage: () => "failed" }))
vi.mock("@/lib/api/showcase", () => ({ getShowcaseFeed: mocks.feed }))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => mocks.session, useSessionRevision: () => 0 }))
vi.mock("@/lib/query-cache", () => ({
  CACHE_REVALIDATE_AFTER_MS: 0,
  fetchViaQueryCache: (_key: string, fetcher: (signal: AbortSignal) => unknown, signal: AbortSignal) => fetcher(signal),
  markQueryRevalidating: () => true,
  onQueryCacheInvalidation: () => () => {},
  readQueryCacheEntry: () => null,
  releaseQueryRevalidation: () => {},
  writeQueryCache: () => {},
}))
vi.mock("@/lib/showcase-social-prefs", () => ({
  showcaseFeedDirtyVersion: () => mocks.dirtyVersion,
  useShowcaseDirtyVersion: () => mocks.dirtyVersion,
  isShowcaseReported: () => false,
  useShowcaseHiddenIds: () => new Set(),
  dismissShowcase: vi.fn(),
  undismissShowcase: vi.fn(),
  // F-01/C-01 (audit 2026-09-24): ledger hitungan komentar — tanpa event.
  showcaseCommentCountSeq: () => 0,
  showcaseCommentCountsSince: () => ({ events: [], seq: 0 }),
  useShowcaseCommentCountSeq: () => 0,
}))
vi.mock("@/lib/use-showcase-social-actions", () => ({ useShowcaseSocialActions: () => ({}) }))
vi.mock("@/lib/use-collapsing-header", () => ({ useCollapsingHeader: () => ({}) }))
vi.mock("@/components/ui/bottom-sheet", () => ({ BottomSheet: () => null }))
vi.mock("@/components/ui/showcase-comments-sheet", () => ({ ShowcaseCommentsSheet: () => null }))
vi.mock("@/components/ui/showcase-report-sheet", () => ({ ShowcaseReportSheet: () => null }))
vi.mock("@/components/ui/showcase-feed-item", () => ({ ShowcaseFeedItem: () => null }))
// U5 (journey): lapisan first-run (overlay orientasi, coach mark, sheet
// rationale push) memakai <Portal>; di luar cakupan tes ini → stub kosong.
vi.mock("@/components/ui/feed-orientation-overlay", () => ({ FeedOrientationOverlay: () => null }))
vi.mock("@/components/ui/coach-mark", () => ({ CoachMark: () => null }))
vi.mock("@/components/ui/push-rationale-sheet", () => ({ PushRationaleSheet: () => null }))
vi.mock("@/components/ui/showcase-header", () => ({ ShowcaseHeader: () => null }))
vi.mock("@/components/ui/mode-switcher", () => ({ ModeShiftFade: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => <button onClick={onPress}>{children}</button> }))
vi.mock("@/components/ui/icon-button", () => ({ IconButton: () => null }))
vi.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: ReactNode }) => <span>{children}</span> }))
vi.mock("@/components/ui/empty-state", () => ({ EmptyState: ({ title }: { title: string }) => <span>{title}</span> }))
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null, SkeletonGroup: () => null }))
vi.mock("@/components/ui/paginated-list", () => ({ PaginatedList: (props: {
  data: ShowcaseSocialItem[]; loading: boolean; refreshing: boolean; loadMoreError: string | null;
  empty: ReactNode; header?: ReactNode; onRefresh: () => void; onLoadMore: () => void; onRetry: () => void;
}) => {
  mocks.renders++
  return <div>
    {props.header}
    <span data-testid="loading">{String(props.loading || props.refreshing)}</span>
    <span data-testid="more-error">{props.loadMoreError}</span>
    {props.data.map(item => <span key={item.id}>{item.id}</span>)}
    {!props.data.length && !props.loading ? props.empty : null}
    <button onClick={props.onLoadMore}>more</button><button onClick={props.onRefresh}>refresh</button><button onClick={props.onRetry}>retry</button>
  </div>
} }))
import { ShowcaseFeedTab } from "@/components/showcase-feed-tab"

const item = (id: string, username = "followed") => ({ id, author: { username } }) as ShowcaseSocialItem
const page = (items: ShowcaseSocialItem[], nextCursor: string | null = null): ShowcaseFeedPage => ({ items, nextCursor, hasMore: nextCursor != null, sort: "latest", limit: 20 })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = false
  mocks.params = { kind: "following" }
  mocks.renders = 0
  mocks.dirtyVersion = 0
  mocks.focused = true
  mocks.me.mockResolvedValue({ username: "me" })
  mocks.followingIds.mockResolvedValue([{ userId: "f1", username: "followed" }])
  mocks.feed.mockResolvedValue(page([]))
})
afterEach(cleanup)

describe("actual feed component E09–E20", () => {
  it("guest following settles without a fetch/effect feedback loop", async () => {
    render(<ShowcaseFeedTab bottomPadding={0} />)
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"))
    expect(screen.getByText("Masuk untuk melihat feed mengikuti")).toBeTruthy()
    expect(mocks.feed).not.toHaveBeenCalled()
    expect(mocks.renders).toBeLessThan(10)
  })
  it("no-following account does not scan public feed pages", async () => {
    mocks.session = true
    mocks.followingIds.mockResolvedValue([])
    render(<ShowcaseFeedTab bottomPadding={0} />)
    await screen.findByText("Anda belum mengikuti siapa pun")
    expect(mocks.feed).not.toHaveBeenCalled()
  })
  it("reads the whole following list in ONE request (no 200-account page cap)", async () => {
    mocks.session = true
    mocks.followingIds.mockResolvedValue([
      ...Array.from({ length: 250 }, (_, i) => ({ userId: `u${i}`, username: `user-${i}` })),
      { userId: "last", username: "followed" },
    ])
    mocks.feed.mockResolvedValue(page([item("last-account-work")]))
    render(<ShowcaseFeedTab bottomPadding={0} />)
    await screen.findByText("last-account-work")
    expect(mocks.followingIds).toHaveBeenCalledTimes(1)
  })
  it("F-05: memberi tahu saat hasil tab Mengikuti terpotong plafon klien", async () => {
    mocks.session = true
    // Setiap halaman hanya lolos filter 1 item (< FOLLOWING_MIN_ITEMS) dan
    // masih hasMore → loop memakai SELURUH jatah FOLLOWING_MAX_PAGES, lalu
    // berhenti karena plafon, bukan karena feed habis.
    mocks.feed.mockResolvedValue(page([item("only-one")], "next"))
    render(<ShowcaseFeedTab bottomPadding={0} />)
    await waitFor(() => expect(screen.getAllByText("only-one").length).toBeGreaterThan(0))
    expect(
      screen.getByText("Hanya sebagian etalase dari akun yang Anda ikuti yang ditampilkan."),
    ).toBeTruthy()
  })

  it("F-05: tidak menampilkan peringatan saat hasil following memang habis", async () => {
    mocks.session = true
    mocks.feed.mockResolvedValue(page([item("last-account-work")]))
    render(<ShowcaseFeedTab bottomPadding={0} />)
    await screen.findByText("last-account-work")
    expect(screen.queryByText("Hanya sebagian etalase dari akun yang Anda ikuti yang ditampilkan.")).toBeNull()
  })

  it("refresh blocks concurrent more and clears the old load-more error", async () => {
    mocks.params = { kind: "latest" }
    mocks.feed.mockResolvedValueOnce(page([item("one")], "cursor-1")).mockRejectedValueOnce(new Error("offline"))
    render(<ShowcaseFeedTab bottomPadding={0} />)
    await screen.findByText("one")
    fireEvent.click(screen.getByText("more"))
    await waitFor(() => expect(screen.getByTestId("more-error").textContent).toBe("failed"))
    const pending = deferred<ShowcaseFeedPage>()
    mocks.feed.mockReturnValueOnce(pending.promise)
    fireEvent.click(screen.getByText("refresh"))
    fireEvent.click(screen.getByText("more"))
    expect(mocks.feed).toHaveBeenCalledTimes(3)
    await act(async () => pending.resolve(page([item("fresh")], "new-cursor")))
    expect(screen.getByTestId("more-error").textContent).toBe("")
    expect(screen.queryByText("one")).toBeNull()
  })
  it("following partial failure retries from the original cursor, not after lost items", async () => {
    mocks.session = true
    mocks.feed.mockResolvedValueOnce(page(Array.from({ length: 5 }, (_, i) => item(`initial-${i}`)), "c1"))
      .mockResolvedValueOnce(page([item("must-not-skip")], "c2"))
      .mockRejectedValueOnce(new Error("page2 failed"))
      .mockResolvedValueOnce(page([item("must-not-skip")], "c2"))
      .mockResolvedValueOnce(page([item("end")]))
    render(<ShowcaseFeedTab bottomPadding={0} />)
    await screen.findByText("initial-0")
    fireEvent.click(screen.getByText("more"))
    await waitFor(() => expect(screen.getByTestId("more-error").textContent).toBe("failed"))
    fireEvent.click(screen.getByText("more"))
    await screen.findByText("must-not-skip")
    expect(mocks.feed.mock.calls[3][0].cursor).toBe("c1")
  })
  it("changing query hides previous results and fences late responses", async () => {
    mocks.params = { kind: "latest" }
    const pending = deferred<ShowcaseFeedPage>()
    mocks.feed.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([item("popular-result")]))
    const view = render(<ShowcaseFeedTab bottomPadding={0} />)
    mocks.params = { kind: "popular" }
    view.rerender(<ShowcaseFeedTab bottomPadding={0} />)
    await screen.findByText("popular-result")
    await act(async () => pending.resolve(page([item("stale-latest")])))
    expect(screen.queryByText("stale-latest")).toBeNull()
  })
  it("A-01/A-08: refetch dirty hanya saat kembali fokus — tidak saat blur", async () => {
    // N-02: mock dirty HIDUP — regresi A-01 (dirty akibat aksi sosial →
    // refetch → reset list) kini tertangkap lewat test ini.
    mocks.params = { kind: "latest" }
    mocks.feed.mockResolvedValue(page([item("one")], "c1"))
    const view = render(<ShowcaseFeedTab bottomPadding={0} />)
    await screen.findByText("one")
    expect(mocks.feed).toHaveBeenCalledTimes(1)

    // Mutasi etalase di layar lain sementara tab blur.
    mocks.focused = false
    mocks.dirtyVersion = 1
    view.rerender(<ShowcaseFeedTab bottomPadding={0} />)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mocks.feed).toHaveBeenCalledTimes(1) // A-01: tidak refetch saat blur

    mocks.focused = true
    view.rerender(<ShowcaseFeedTab bottomPadding={0} />)
    await waitFor(() => expect(mocks.feed).toHaveBeenCalledTimes(2)) // A-08: fokus kembali → segar
    await screen.findByText("one")
  })
})
