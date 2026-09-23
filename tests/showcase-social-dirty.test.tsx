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
    await waitFor(() => expect(mocks.share).toHaveBeenCalled())

    expect(showcaseFeedDirtyVersion()).toBe(before) // A-01: TANPA dirty
  })
})
