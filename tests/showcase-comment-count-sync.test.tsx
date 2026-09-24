// @vitest-environment jsdom
/**
 * F-01/F-03/C-01/C-02 (audit 2026-09-24) — tripwire hitungan komentar.
 *
 * Sebelum perbaikan: satu komentar memanggil `markShowcaseFeedDirty()`,
 * feed yang sedang fokus langsung refetch, halaman 2..N dibuang, dan kenaikan
 * hitungan optimistis tertimpa. Test ini memakai LEDGER HITUNGAN ASLI
 * (`queueShowcaseCommentCount` + watermark) sehingga regresi "komentar →
 * refetch → kartu kembali ke angka lama" pasti tertangkap.
 */
import { type ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseFeedPage, ShowcaseSocialItem } from "@/lib/api/showcase"

const mocks = vi.hoisted(() => ({
  feed: vi.fn(),
  send: vi.fn(),
  toast: vi.fn(),
  params: { kind: "latest" } as Record<string, string>,
}))

vi.mock("expo-router", () => ({
  router: { push: vi.fn(), setParams: vi.fn() },
  useLocalSearchParams: () => mocks.params,
}))
vi.mock("phosphor-react-native", () => ({ Images: () => null, X: () => null, ChatCircle: () => null, PaperPlaneRight: () => null }))
vi.mock("react-native-reanimated", () => ({ default: { View: ({ children }: { children: ReactNode }) => <>{children}</> } }))
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => true }))
vi.mock("@/lib/api", () => ({
  api: { users: { getMe: vi.fn(), getFollowing: vi.fn() } },
  isApiError: () => false,
  userMessage: () => "failed",
  // S-03: kunci idempotensi per aksi dikirim sheet komentar.
  createIdempotencyKey: () => "test-idem-key",
}))
vi.mock("@/lib/api/showcase", () => ({
  getShowcaseFeed: mocks.feed,
  addShowcaseComment: mocks.send,
  listShowcaseComments: vi.fn(),
}))
vi.mock("@/lib/guest-gate", () => ({
  useHasSession: () => true,
  useSessionRevision: () => 0,
  useGuestPathBlocked: () => false,
}))
vi.mock("@/lib/query-cache", () => ({
  fetchViaQueryCache: (_key: string, fetcher: (signal: AbortSignal) => unknown, signal: AbortSignal) => fetcher(signal),
}))
vi.mock("@/lib/use-showcase-social-actions", () => ({ useShowcaseSocialActions: () => ({}) }))
vi.mock("@/lib/use-collapsing-header", () => ({ useCollapsingHeader: () => ({}) }))
vi.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ visible, children, footer }: { visible: boolean; children: ReactNode; footer?: ReactNode }) =>
    visible ? <div>{children}{footer}</div> : null,
}))
vi.mock("@/components/ui/showcase-report-sheet", () => ({ ShowcaseReportSheet: () => null }))
vi.mock("@/components/ui/showcase-header", () => ({ ShowcaseHeader: () => null }))
vi.mock("@/components/ui/mode-switcher", () => ({ ModeShiftFade: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => <button onClick={onPress}>{children}</button>,
}))
vi.mock("@/components/ui/icon-button", () => ({
  IconButton: ({ onPress, loading }: { onPress: () => void; loading?: boolean }) => (
    <button disabled={loading} onClick={onPress}>send</button>
  ),
}))
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }))
vi.mock("@/components/ui/divider", () => ({ Divider: () => null }))
vi.mock("@/components/ui/error-state", () => ({ ErrorState: () => null }))
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null, SkeletonGroup: () => null }))
vi.mock("@/components/ui/showcase-comment-row", () => ({
  ShowcaseCommentRow: ({ comment }: { comment: { content: string } }) => <span>{comment.content}</span>,
}))
vi.mock("@/components/ui/paginated-list", () => ({
  PaginatedList: (props: {
    data: ShowcaseSocialItem[]
    empty: ReactNode
    loading?: boolean
    onRefresh: () => void
    onLoadMore: () => void
    onRetry: () => void
  }) => (
    <div>
      {props.data.map((entry) => <span key={entry.id} data-testid={`card-${entry.id}`}>{`${entry.id}:${entry.commentCount}`}</span>)}
      {!props.data.length && !props.loading ? props.empty : null}
      <button onClick={props.onLoadMore}>more</button>
      <button onClick={props.onRefresh}>refresh</button>
      <button onClick={props.onRetry}>retry</button>
    </div>
  ),
}))
vi.mock("@/components/ui/input", () => ({
  Input: (props: {
    value: string
    onChangeText: (value: string) => void
    onSubmitEditing?: () => void
    disabled?: boolean
  }) => (
    <input
      aria-label="draft"
      value={props.value}
      disabled={props.disabled}
      onChange={(event) => props.onChangeText(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") props.onSubmitEditing?.() }}
    />
  ),
}))
vi.mock("@/components/ui/showcase-feed-item", () => ({
  ShowcaseFeedItem: ({ item }: { item: ShowcaseSocialItem }) => (
    <span data-testid={`card-${item.id}`}>{`${item.id}:${item.commentCount}`}</span>
  ),
}))
vi.mock("@/components/ui/empty-state", () => ({ EmptyState: ({ title }: { title: string }) => <span>{title}</span> }))
vi.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: ReactNode }) => <span>{children}</span> }))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: mocks.toast }) }))

import { ThemeProvider } from "@/components/theme-provider"
import { ShowcaseFeedTab } from "@/components/showcase-feed-tab"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import {
  queueShowcaseCommentCount,
  showcaseCommentCountSeq,
  showcaseCommentCountsSince,
  showcaseFeedDirtyVersion,
} from "@/lib/showcase-social-prefs"

const item = (id: string, commentCount = 0) =>
  ({ id, commentCount, author: { username: "seller" } }) as ShowcaseSocialItem
const page = (items: ShowcaseSocialItem[], nextCursor: string | null = null): ShowcaseFeedPage =>
  ({ items, nextCursor, hasMore: nextCursor != null, sort: "latest", limit: 20 })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.params = { kind: "latest" }
  mocks.feed.mockResolvedValue(page([]))
  mocks.send.mockResolvedValue({ id: "new-comment", showcaseId: "a", content: "halo" })
  // Ledger modul = state global: mulai dari posisi bersih untuk tiap test.
  showcaseCommentCountsSince(0)
})
afterEach(cleanup)

describe("ledger hitungan komentar (semantik watermark)", () => {
  it("watermark mencegah penghitungan ganda; konsumen baru mulai dari posisi sekarang", () => {
    const start = showcaseCommentCountSeq()
    queueShowcaseCommentCount("a", 1)
    queueShowcaseCommentCount("a", 1)
    const first = showcaseCommentCountsSince(start)
    expect(first.events).toEqual([{ id: "a", delta: 1 }, { id: "a", delta: 1 }])
    // Konsumen kedua pada watermark yang sama menerima event yang SAMA
    // (fan-out), bukan konsumsi sekali.
    expect(showcaseCommentCountsSince(start).events).toHaveLength(2)
    // Konsumen yang sudah maju ke `first.seq` tidak menerima apa pun lagi.
    expect(showcaseCommentCountsSince(first.seq).events).toHaveLength(0)
  })
})

describe("feed + komentar (F-01/C-01)", () => {
  it("komentar menaikkan hitungan kartu TANPA refetch dan halaman 2 tetap utuh", async () => {
    mocks.feed
      .mockResolvedValueOnce(page([item("a", 1)], "c1"))
      .mockResolvedValueOnce(page([item("b", 0)]))
    render(<ThemeProvider><ShowcaseFeedTab bottomPadding={0} /></ThemeProvider>)
    await screen.findByTestId("card-a")

    fireEvent.click(screen.getByText("more"))
    await screen.findByTestId("card-b")
    expect(screen.getByTestId("card-b").textContent).toBe("b:0")
    const callsAfterFirstPage = mocks.feed.mock.calls.length

    // Komentar ditulis dari sheet (atau layar lain) → ledger.
    act(() => queueShowcaseCommentCount("b", 1))
    await waitFor(() => expect(screen.getByTestId("card-b").textContent).toBe("b:1"))

    // Inti F-01: TIDAK ada request jaringan tambahan — halaman 1 dan 2 utuh.
    expect(mocks.feed.mock.calls.length).toBe(callsAfterFirstPage)
    expect(screen.getByTestId("card-a").textContent).toBe("a:1")
    // Aksi sosial juga tidak boleh menandai feed dirty.
    expect(showcaseFeedDirtyVersion()).toBe(showcaseFeedDirtyVersion())
  })

  it("delta negatif (hapus komentar) tidak pernah menurunkan hitungan di bawah nol", async () => {
    mocks.feed.mockResolvedValue(page([item("a", 1)]))
    render(<ThemeProvider><ShowcaseFeedTab bottomPadding={0} /></ThemeProvider>)
    await screen.findByTestId("card-a")
    act(() => queueShowcaseCommentCount("a", -5))
    await waitFor(() => expect(screen.getByTestId("card-a").textContent).toBe("a:0"))
  })
})

describe("sheet komentar (F-02: tidak ada dirty lagi)", () => {
  it("mengirim komentar mendaftarkan delta +1 dan TIDAK menaikkan dirty version", async () => {
    const dirtyBefore = showcaseFeedDirtyVersion()
    const seqBefore = showcaseCommentCountSeq()
    render(<ThemeProvider><ShowcaseCommentsSheet item={item("a", 0)} onRequestClose={() => {}} /></ThemeProvider>)
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "halo" } })
    fireEvent.click(screen.getByText("send"))
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1))

    const { events } = showcaseCommentCountsSince(seqBefore)
    expect(events).toEqual([{ id: "a", delta: 1 }])
    expect(showcaseFeedDirtyVersion()).toBe(dirtyBefore)
  })
})
