/**
 * Audit chat F15 — <PaginatedList> meneruskan tuning jendela ke FlatList:
 * default = tuning feed (6/6/11), `windowing` menimpanya per daftar.
 */
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))

vi.mock("@/components/ui/pull-to-refresh", () => ({
  PullToRefreshFlatList: (props: Record<string, unknown>) => {
    captured.props = props
    return null
  },
}))

import { PaginatedList } from "@/components/ui/paginated-list"
import { CHAT_LIST_WINDOWING } from "@/lib/chat-list-windowing"

afterEach(() => {
  cleanup()
  captured.props = null
})

const base = {
  data: [{ id: "a" }],
  renderItem: () => null,
  loading: false,
  refreshing: false,
  loadingMore: false,
  hasMore: false,
  onRefresh: () => undefined,
  onRetry: () => undefined,
  onLoadMore: () => undefined,
  empty: <></>,
}

describe("<PaginatedList windowing>", () => {
  it("tanpa `windowing`: tuning feed (tidak ada perubahan untuk daftar lain)", () => {
    render(<PaginatedList {...base} />)
    expect(captured.props).toMatchObject({
      initialNumToRender: 6,
      maxToRenderPerBatch: 6,
      windowSize: 11,
      removeClippedSubviews: false,
    })
    expect(captured.props?.updateCellsBatchingPeriod).toBeUndefined()
  })

  it("`windowing` daftar chat menimpa default dan diteruskan apa adanya", () => {
    render(<PaginatedList {...base} windowing={CHAT_LIST_WINDOWING} />)
    expect(captured.props).toMatchObject({
      initialNumToRender: CHAT_LIST_WINDOWING.initialNumToRender,
      maxToRenderPerBatch: CHAT_LIST_WINDOWING.maxToRenderPerBatch,
      windowSize: CHAT_LIST_WINDOWING.windowSize,
      updateCellsBatchingPeriod: CHAT_LIST_WINDOWING.updateCellsBatchingPeriod,
      // Keputusan produk/UX: tidak pernah true (blank-scroll di Android).
      removeClippedSubviews: false,
    })
  })

  it("sebagian field: sisanya jatuh ke default feed", () => {
    render(<PaginatedList {...base} windowing={{ windowSize: 5 }} />)
    expect(captured.props).toMatchObject({ windowSize: 5, initialNumToRender: 6, maxToRenderPerBatch: 6 })
  })
})
