// @vitest-environment jsdom
/**
 * S-04 (audit 2026-09-24) — "Tidak tertarik" harus bisa DIBATALKAN.
 *
 * Sebelum perbaikan: satu tap pada menu kartu menghilangkan karya dari feed
 * TANPA jejak apa pun (tidak ada toast, tidak ada undo, tidak ada halaman
 * "tersembunyi" versi mobile), jadi salah tap = karya hilang sampai app dibuka
 * ulang. Test ini mengunci janji barunya: kartu hilang **dan** toast menawarkan
 * "Urungkan" yang benar-benar mengembalikan kartu.
 */
import { type ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseFeedPage, ShowcaseSocialItem } from "@/lib/api/showcase"

const mocks = vi.hoisted(() => ({
  feed: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("expo-router", () => ({
  router: { push: vi.fn(), setParams: vi.fn() },
  useLocalSearchParams: () => ({ kind: "latest" }),
}))
vi.mock("phosphor-react-native", () => ({ ChatCircle: () => null, Images: () => null, PaperPlaneRight: () => null, X: () => null }))
vi.mock("react-native-reanimated", () => ({ default: { View: ({ children }: { children: ReactNode }) => <>{children}</> } }))
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => true }))
vi.mock("@/lib/api", () => ({
  api: { users: { getMe: vi.fn(), getFollowing: vi.fn() } },
  isApiError: () => false,
  userMessage: () => "failed",
}))
vi.mock("@/lib/api/showcase", () => ({
  getShowcaseFeed: mocks.feed,
  addShowcaseComment: vi.fn(),
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
  BottomSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) =>
    visible ? <div>{children}</div> : null,
}))
vi.mock("@/components/ui/showcase-report-sheet", () => ({ ShowcaseReportSheet: () => null }))
vi.mock("@/components/ui/showcase-header", () => ({ ShowcaseHeader: () => null }))
vi.mock("@/components/ui/mode-switcher", () => ({ ModeShiftFade: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => <button onClick={onPress}>{children}</button>,
}))
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }))
vi.mock("@/components/ui/error-state", () => ({ ErrorState: () => null }))
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null, SkeletonGroup: () => null }))
vi.mock("@/components/ui/empty-state", () => ({
  EmptyState: ({ title }: { title: string }) => <span data-testid="empty">{title}</span>,
}))
vi.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: ReactNode }) => <span>{children}</span> }))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: mocks.toast }) }))
vi.mock("@/components/ui/paginated-list", () => ({
  PaginatedList: (props: {
    data: ShowcaseSocialItem[]
    empty: ReactNode
    onLoadMore: () => void
    renderItem: (info: { item: ShowcaseSocialItem; index: number }) => ReactNode
  }) => (
    <div>
      {props.data.map((entry, index) => (
        <div key={entry.id}>{props.renderItem({ item: entry, index })}</div>
      ))}
      {!props.data.length ? props.empty : null}
      <button onClick={props.onLoadMore}>more</button>
    </div>
  ),
}))
vi.mock("@/components/ui/showcase-feed-item", () => ({
  ShowcaseFeedItem: ({ item, onOptions }: { item: ShowcaseSocialItem; onOptions?: () => void }) => (
    <span data-testid={`card-${item.id}`}>
      {item.id}
      <button data-testid={`menu-${item.id}`} onClick={() => onOptions?.()}>menu</button>
    </span>
  ),
}))

import { ThemeProvider } from "@/components/theme-provider"
import { ShowcaseFeedTab } from "@/components/showcase-feed-tab"

const item = (id: string) => ({ id, commentCount: 0, author: { username: "seller" } }) as ShowcaseSocialItem
const page = (items: ShowcaseSocialItem[]): ShowcaseFeedPage =>
  ({ items, nextCursor: null, hasMore: false, sort: "latest", limit: 20 })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.feed.mockResolvedValue(page([]))
})
afterEach(cleanup)

describe("S-04: membatalkan 'Tidak tertarik'", () => {
  it("menyembunyikan kartu DAN menawarkan Urungkan yang mengembalikannya", async () => {
    mocks.feed.mockResolvedValue(page([item("a")]))
    render(<ThemeProvider><ShowcaseFeedTab bottomPadding={0} /></ThemeProvider>)
    await screen.findByTestId("card-a")

    fireEvent.click(screen.getByTestId("menu-a"))
    fireEvent.click(screen.getByText("Tidak tertarik"))

    // Kartu benar-benar hilang dari feed...
    expect(screen.queryByTestId("card-a")).toBeNull()
    // ...tetapi keputusan itu tidak boleh senyap: toast wajib menawarkan undo.
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    const shown = mocks.toast.mock.calls[0][0] as {
      title: string
      action?: { label: string; onPress: () => void }
    }
    expect(shown.title).toBe("Karya disembunyikan dari feed")
    expect(shown.action?.label).toBe("Urungkan")

    // Menekan "Urungkan" mengembalikan kartu tanpa refetch apa pun.
    const callsBefore = mocks.feed.mock.calls.length
    await act(async () => { shown.action?.onPress() })
    expect(screen.getByTestId("card-a")).toBeTruthy()
    expect(mocks.feed.mock.calls.length).toBe(callsBefore)
  })
})
