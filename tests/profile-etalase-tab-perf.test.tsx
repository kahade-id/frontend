// @vitest-environment jsdom
/**
 * FS-001 + FS-002 (audit performa ronde 3) — regresi tab Etalase profil:
 *
 * - FS-001: EtalaseCard SELALU meneruskan autoplay={false} ke
 *   <ShowcaseFeedItem> (video profil hanya via ketuk eksplisit — tab ini
 *   tidak punya viewability wiring seperti feed utama). FD-02 (audit etalase
 *   2026-10-10): prop-nya `autoplay`, BUKAN `autoplayActive` — yang terakhir
 *   ikut mematikan ketuk eksplisit sehingga tombol putar tidak berfungsi.
 * - FS-002: windowing inkremental — mount awal dibatasi (10 kartu, bukan
 *   20), tombol "Tampilkan etalase lainnya" +20/ketuk dipertahankan, dan
 *   memo(EtalaseCard) tidak jebol (render ulang induk tidak me-render ulang
 *   kartu yang prop-nya identik).
 *
 * CATATAN: ditulis dengan React.createElement (bukan JSX) mengikuti
 * tests/showcase-profile-saved.test.tsx — transform JSX .tsx tidak berjalan
 * di vitest lokal.
 */
import * as React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseItem } from "@/lib/api/users"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

const h = React.createElement

const mocks = vi.hoisted(() => ({
  feedProps: [] as Record<string, unknown>[],
}))

vi.mock("expo-router", () => ({ router: { push: vi.fn() } }))
vi.mock("phosphor-react-native", () => ({
  Images: () => null,
  Plus: () => null,
}))
vi.mock("@/lib/showcase-social-prefs", () => ({
  showcaseCommentCountSeq: () => 0,
  showcaseCommentCountsSince: () => ({ events: [], seq: 0 }),
  useShowcaseCommentCountSeq: () => 0,
}))
vi.mock("@/lib/use-showcase-social-actions", () => ({ useShowcaseSocialActions: () => ({}) }))
vi.mock("@/components/ui/showcase-feed-item", () => ({
  ShowcaseFeedItem: (props: Record<string, unknown>) => {
    mocks.feedProps.push(props)
    return null
  },
}))
vi.mock("@/components/ui/showcase-comments-sheet", () => ({ ShowcaseCommentsSheet: () => null }))
vi.mock("@/components/ui/showcase-report-sheet", () => ({ ShowcaseReportSheet: () => null }))
vi.mock("@/components/ui/showcase-share-sheet", () => ({ ShowcaseShareSheet: () => null }))
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
  ErrorState: ({ description }: { description?: string }) => h("span", null, description),
}))
vi.mock("@/lib/routes", () => ({ ROUTES: { showcaseDetail: (id: string) => `/showcase/${id}` } }))

import { ProfileEtalaseTab } from "@/components/ui/profile-etalase-tab"

const raw = (id: string): ShowcaseItem =>
  ({ id, title: `Karya ${id}`, createdAt: "2026-01-01T00:00:00Z" }) as ShowcaseItem
const owner = { id: "o1", username: "penjual" }

/** Jumlah kartu unik yang ter-mount (mock mendorong props tiap render —
 *  render ulang kartu yang sama tidak dihitung dua kali). */
const mountedCount = () =>
  new Set(mocks.feedProps.map((p) => (p.item as ShowcaseSocialItem).id)).size

beforeEach(() => {
  vi.clearAllMocks()
  mocks.feedProps = []
})
afterEach(cleanup)

describe("ProfileEtalaseTab FS-001/FS-002 (audit performa)", () => {
  it("FS-002: 100 item → mount awal dibatasi 10 kartu (bukan 100)", async () => {
    const items = Array.from({ length: 100 }, (_, i) => raw(`big-${i}`))
    render(
      h(ProfileEtalaseTab, { items, loading: false, handle: "penjual", owner, isSelf: true }),
    )
    await waitFor(() => expect(mountedCount()).toBe(10))
    // Tombol muat-bertahap tetap ada (UX dipertahankan).
    expect(screen.getByText("Tampilkan etalase lainnya")).toBeTruthy()
  })

  it("FS-002: 'Tampilkan etalase lainnya' menambah +20 per ketuk", async () => {
    const items = Array.from({ length: 100 }, (_, i) => raw(`big-${i}`))
    render(
      h(ProfileEtalaseTab, { items, loading: false, handle: "penjual", owner, isSelf: true }),
    )
    await waitFor(() => expect(mountedCount()).toBe(10))
    await act(async () => {
      ;(screen.getByText("Tampilkan etalase lainnya") as HTMLElement).click()
    })
    await waitFor(() => expect(mountedCount()).toBe(30))
    await act(async () => {
      ;(screen.getByText("Tampilkan etalase lainnya") as HTMLElement).click()
    })
    await waitFor(() => expect(mountedCount()).toBe(50))
  })

  it("FS-002: ganti handle me-reset jendela ke 10", async () => {
    const items = Array.from({ length: 100 }, (_, i) => raw(`big-${i}`))
    const { rerender } = render(
      h(ProfileEtalaseTab, { items, loading: false, handle: "penjual-a", owner, isSelf: true }),
    )
    await waitFor(() => expect(mountedCount()).toBe(10))
    await act(async () => {
      ;(screen.getByText("Tampilkan etalase lainnya") as HTMLElement).click()
    })
    await waitFor(() => expect(mountedCount()).toBe(30))
    mocks.feedProps = []
    rerender(
      h(ProfileEtalaseTab, { items, loading: false, handle: "penjual-b", owner, isSelf: true }),
    )
    // Jendela ter-reset ke 10 (efek [handle] sudah flush via act di rerender):
    // satu ketuk "lainnya" me-mount big-10..big-29 — BUKAN big-30..big-49.
    await act(async () => {
      ;(screen.getByText("Tampilkan etalase lainnya") as HTMLElement).click()
    })
    await waitFor(() =>
      expect(
        mocks.feedProps.some((p) => (p.item as ShowcaseSocialItem).id === "big-29"),
      ).toBe(true),
    )
    const ids = new Set(mocks.feedProps.map((p) => (p.item as ShowcaseSocialItem).id))
    expect(ids.has("big-10")).toBe(true)
    expect(ids.has("big-30")).toBe(false)
  })

  it("FS-001/FD-02: SEMUA kartu menerima autoplay={false} tanpa mematikan autoplayActive (ketuk putar tetap hidup)", async () => {
    const items = Array.from({ length: 100 }, (_, i) => raw(`big-${i}`))
    render(
      h(ProfileEtalaseTab, { items, loading: false, handle: "penjual", owner, isSelf: true }),
    )
    await waitFor(() => expect(mountedCount()).toBe(10))
    expect(mocks.feedProps.length).toBeGreaterThan(0)
    for (const props of mocks.feedProps) {
      expect(props.autoplay).toBe(false)
      expect(props.autoplayActive).not.toBe(false)
    }
    // Setelah muat-bertahap pun tetap sama.
    await act(async () => {
      ;(screen.getByText("Tampilkan etalase lainnya") as HTMLElement).click()
    })
    await waitFor(() => expect(mountedCount()).toBe(30))
    for (const props of mocks.feedProps) {
      expect(props.autoplay).toBe(false)
      expect(props.autoplayActive).not.toBe(false)
    }
  })

  it("FS-002: render ulang induk dengan items identik TIDAK me-render ulang kartu (memo utuh)", async () => {
    const items = Array.from({ length: 25 }, (_, i) => raw(`memo-${i}`))
    const props = { items, loading: false, handle: "penjual", owner, isSelf: true }
    const { rerender } = render(h(ProfileEtalaseTab, props))
    await waitFor(() => expect(mocks.feedProps.length).toBe(10))
    const rendersAfterMount = mocks.feedProps.length
    // Render ulang dengan identitas props yang sama → kartu memo harus skip.
    rerender(h(ProfileEtalaseTab, props))
    rerender(h(ProfileEtalaseTab, props))
    expect(mocks.feedProps.length).toBe(rendersAfterMount)
  })

  it("FS-002: item hasil normalisasi tetap membawa id unik per kartu", async () => {
    const items = Array.from({ length: 12 }, (_, i) => raw(`uniq-${i}`))
    render(
      h(ProfileEtalaseTab, { items, loading: false, handle: "penjual", owner, isSelf: true }),
    )
    await waitFor(() => expect(mountedCount()).toBe(10))
    const ids = mocks.feedProps.map((p) => (p.item as ShowcaseSocialItem).id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
