/**
 * Audit etalase 2026-10-10 — <PaginatedList>:
 *  - FD-04: gerbang infinite scroll juga di-arm oleh awal seret
 *    (`onScrollBeginDrag`) — RN-web tidak mengemisi event momentum, dan di
 *    native seret pelan sampai ujung tidak pernah menembak momentum.
 *  - UX-04: `errorTitle` diteruskan ke ErrorState (judul jujur, bukan
 *    "Terjadi kesalahan").
 *  - UX-22: `endLabel` → footer "akhir daftar" saat hasMore=false & ada data.
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as React from "react"

const captured = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))

vi.mock("@/components/ui/pull-to-refresh", () => ({
  PullToRefreshFlatList: (props: Record<string, unknown>) => {
    captured.props = props
    return null
  },
}))
vi.mock("@/components/ui/error-state", () => ({
  ErrorState: ({ title, description }: { title?: string; description?: string }) =>
    React.createElement("span", null, `${title ?? "(default)"}|${description ?? ""}`),
}))
vi.mock("@/components/ui/load-more", () => ({
  LoadMore: ({ status, endLabel }: { status: string; endLabel?: string }) =>
    React.createElement("span", null, `load-more:${status}:${endLabel ?? ""}`),
}))
vi.mock("@/components/ui/offline-empty-state", () => ({ OfflineEmptyState: () => null }))

import { PaginatedList } from "@/components/ui/paginated-list"

afterEach(() => {
  cleanup()
  captured.props = null
})

const base = {
  data: [{ id: "a" }, { id: "b" }],
  renderItem: () => null,
  loading: false,
  refreshing: false,
  loadingMore: false,
  hasMore: true,
  onRefresh: () => undefined,
  onRetry: () => undefined,
  onLoadMore: () => undefined,
  empty: <></>,
}

describe("FD-04 gerbang infinite scroll", () => {
  it("onEndReached tanpa scroll nyata diabaikan (LR-011 tetap)", () => {
    const onLoadMore = vi.fn()
    render(<PaginatedList {...base} onLoadMore={onLoadMore} />)
    ;(captured.props?.onEndReached as () => void)()
    expect(onLoadMore).not.toHaveBeenCalled()
  })

  it("awal seret (onScrollBeginDrag) meng-arm gerbang → onEndReached memuat halaman berikut, sekali per gestur", () => {
    const onLoadMore = vi.fn()
    render(<PaginatedList {...base} onLoadMore={onLoadMore} />)
    const props = captured.props!
    ;(props.onScrollBeginDrag as () => void)()
    ;(props.onEndReached as () => void)()
    ;(props.onEndReached as () => void)()
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it("momentum tetap meng-arm seperti semula", () => {
    const onLoadMore = vi.fn()
    render(<PaginatedList {...base} onLoadMore={onLoadMore} />)
    const props = captured.props!
    ;(props.onMomentumScrollBegin as () => void)()
    ;(props.onEndReached as () => void)()
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })
})

describe("UX-04 judul error", () => {
  it("daftar kosong + error → ErrorState memakai errorTitle", () => {
    render(<PaginatedList {...base} data={[]} error="Periksa jaringan" errorTitle="Tidak ada koneksi internet" />)
    render(captured.props!.ListEmptyComponent as React.ReactElement)
    expect(screen.getByText("Tidak ada koneksi internet|Periksa jaringan")).toBeTruthy()
  })

  it("ada data + error → banner compact di header juga memakai errorTitle", () => {
    render(<PaginatedList {...base} error="Periksa jaringan" errorTitle="Koneksi terputus" />)
    render(captured.props!.ListHeaderComponent as React.ReactElement)
    expect(screen.getByText("Koneksi terputus|Periksa jaringan")).toBeTruthy()
  })
})

describe("UX-22 akhir daftar", () => {
  it("hasMore=false + data + endLabel → footer status end", () => {
    render(<PaginatedList {...base} hasMore={false} endLabel="Anda sudah melihat semua etalase" />)
    render(captured.props!.ListFooterComponent as React.ReactElement)
    expect(screen.getByText("load-more:end:Anda sudah melihat semua etalase")).toBeTruthy()
  })

  it("tanpa endLabel (daftar lain) atau data kosong → tidak ada footer end", () => {
    render(<PaginatedList {...base} hasMore={false} />)
    render(captured.props!.ListFooterComponent as React.ReactElement)
    expect(screen.queryByText(/load-more:end/)).toBeNull()
    cleanup()
    render(<PaginatedList {...base} data={[]} hasMore={false} endLabel="Habis" />)
    render(captured.props!.ListFooterComponent as React.ReactElement)
    expect(screen.queryByText(/load-more:end/)).toBeNull()
  })

  it("masih ada halaman → footer idle/loading seperti semula", () => {
    render(<PaginatedList {...base} hasMore endLabel="Habis" />)
    render(captured.props!.ListFooterComponent as React.ReactElement)
    expect(screen.getByText("load-more:idle:")).toBeTruthy()
  })
})
