// @vitest-environment jsdom
/**
 * N-02 (audit 2026-09-23) — tripwire A-01/C-02: aksi sosial (♥/simpan/bagikan)
 * TIDAK BOLEH menandai feed dirty. Test ini memakai
 * `showcaseFeedDirtyVersion` ASLI (bukan mock konstan) sehingga regresi
 * "suka → markShowcaseFeedDirty → refetch → reset feed" pasti tertangkap.
 */
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

const mocks = vi.hoisted(() => ({ like: vi.fn(), unlike: vi.fn(), share: vi.fn() }))

vi.mock("expo-router", () => ({
  router: { push: vi.fn() },
  useGlobalSearchParams: () => ({}),
  usePathname: () => "/showcase/x",
}))
vi.mock("@/lib/api", () => ({
  api: { users: { getMeCached: vi.fn().mockResolvedValue({ id: "me" }) } },
  isApiError: () => false,
  userMessage: () => "failed",
}))
vi.mock("@/lib/api/showcase", () => ({
  getShowcaseDetail: vi.fn(),
  likeShowcase: mocks.like,
  unlikeShowcase: mocks.unlike,
}))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => true, useSessionRevision: () => 0 }))
vi.mock("@/lib/showcase-social", () => ({ shareShowcaseById: mocks.share }))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: vi.fn() }) }))

import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"
import { showcaseFeedDirtyVersion } from "@/lib/showcase-social-prefs"

const item = (id: string): ShowcaseSocialItem =>
  ({ id, title: "T", images: [], author: { username: "p" }, isLiked: false, likeCount: 1 }) as unknown as ShowcaseSocialItem

beforeEach(() => {
  vi.clearAllMocks()
  mocks.like.mockResolvedValue({ isLiked: true, likeCount: 2 })
  mocks.unlike.mockResolvedValue({ isLiked: false, likeCount: 1 })
  mocks.share.mockResolvedValue({ outcome: "shared", payload: {} })
})

describe("A-01/C-02: aksi sosial tidak menandai feed dirty", () => {
  it("toggle suka, simpan, dan bagikan tidak mengubah showcaseFeedDirtyVersion", async () => {
    const before = showcaseFeedDirtyVersion()
    const { result } = renderHook(() => useShowcaseSocialActions(item("soc-1")))

    act(() => result.current.toggleLike())
    await waitFor(() => expect(mocks.like).toHaveBeenCalled())
    act(() => result.current.toggleSave())
    await act(async () => {})
    act(() => result.current.share())
    // PR #110 (sheet share): share() MEMBUKA ShowcaseShareSheet —
    // shareShowcaseById hanya dipanggil dari dalam sheet saat opsi dipilih.
    // Yang dijaga test ini: membuka sheet TIDAK menandai feed dirty.
    expect(result.current.shareSheetVisible).toBe(true)

    expect(showcaseFeedDirtyVersion()).toBe(before) // A-01: TANPA dirty
  })
})

// Use the real store: visibility changes must not refetch/reset paginated data.
describe("feed visibility", () => {
  it("reacts immediately to reports and dismissals without marking the feed dirty", async () => {
    const { useShowcaseHiddenIds, dismissShowcase, markShowcaseReported, isShowcaseReported } = await import("@/lib/showcase-social-prefs")
    const before = showcaseFeedDirtyVersion()
    const { result, unmount } = renderHook(() => useShowcaseHiddenIds())
    act(() => dismissShowcase("not-interested"))
    expect(result.current.has("not-interested")).toBe(true)
    expect(isShowcaseReported("not-interested")).toBe(false)
    act(() => markShowcaseReported("reported-work"))
    expect(result.current.has("reported-work")).toBe(true)
    expect(showcaseFeedDirtyVersion()).toBe(before)
    unmount()
  })
  it("clears dismissed and reported IDs on session change", async () => {
    const { useShowcaseHiddenIds, dismissShowcase, markShowcaseReported } = await import("@/lib/showcase-social-prefs")
    const { clearSession } = await import("@/lib/api/session")
    const { result, unmount } = renderHook(() => useShowcaseHiddenIds())
    act(() => { dismissShowcase("old-owner"); markShowcaseReported("old-report") })
    await act(async () => { await clearSession() })
    expect(result.current.size).toBe(0)
    unmount()
  })
})
