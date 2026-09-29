// @vitest-environment jsdom
/**
 * D1-009 (perf 2026-09-29): race rollback optimistic like.
 *
 * Skenario: tap-1 (suka) request masih berjalan -> tap-2 ditahan (queued).
 * Bila request PERTAMA GAGAL, toggle yang tertahan DIBATALKAN (bukan
 * dieksekusi) lalu rollback ke snapshot sebelum tap-1. Dua tap saling
 * meniadakan -> keadaan akhir = belum suka, tanpa request kedua.
 *
 * Tanpa fix ini, queued tap-2 dieksekusi setelah rollback dan membalik ke
 * arah yang salah (berakhir "suka" + satu request like palsu).
 */
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

const mocks = vi.hoisted(() => ({ like: vi.fn(), unlike: vi.fn() }))

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
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: vi.fn() }) }))

import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"

const item = (id: string): ShowcaseSocialItem =>
  ({ id, title: "T", images: [], author: { username: "p" }, isLiked: false, likeCount: 1 }) as unknown as ShowcaseSocialItem

beforeEach(() => {
  vi.clearAllMocks()
})

describe("D1-009: double-toggle + request gagal", () => {
  it("request pertama gagal -> queued dibatalkan, rollback ke snapshot, tanpa request kedua", async () => {
    let rejectFirst!: (err: unknown) => void
    mocks.like.mockImplementationOnce(
      () => new Promise<never>((_resolve, reject) => { rejectFirst = reject }),
    )
    const { result } = renderHook(() => useShowcaseSocialActions(item("d1-009-fail")))

    // Tap 1: optimistis suka.
    act(() => { result.current.toggleLike() })
    expect(result.current.liked).toBe(true)
    expect(result.current.likeCount).toBe(2)

    // Tap 2 saat request berjalan: ditahan (queued), bukan dieksekusi.
    act(() => { result.current.toggleLike() })
    expect(mocks.like).toHaveBeenCalledTimes(1)

    // Request pertama gagal.
    await act(async () => { rejectFirst(new Error("network down")) })

    // Rollback ke snapshot sebelum tap-1; toggle tertahan DIBATALKAN.
    expect(result.current.liked).toBe(false)
    expect(result.current.likeCount).toBe(1)
    expect(result.current.likePending).toBe(false)
    expect(mocks.like).toHaveBeenCalledTimes(1)
    expect(mocks.unlike).not.toHaveBeenCalled()
  })

  it("kontrol: request pertama sukses -> toggle tertahan tetap dieksekusi (S-01)", async () => {
    let resolveFirst!: (res: { liked: boolean; likeCount: number }) => void
    mocks.like.mockImplementationOnce(
      () => new Promise<{ liked: boolean; likeCount: number }>((resolve) => { resolveFirst = resolve }),
    )
    mocks.unlike.mockResolvedValue({ liked: false, likeCount: 1 })
    const { result } = renderHook(() => useShowcaseSocialActions(item("d1-009-ok")))

    act(() => { result.current.toggleLike() })
    act(() => { result.current.toggleLike() })

    await act(async () => { resolveFirst({ liked: true, likeCount: 2 }) })

    // Request pertama sukses -> queued tap-2 dieksekusi sebagai unlike.
    await waitFor(() => expect(mocks.unlike).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.liked).toBe(false))
    expect(result.current.likeCount).toBe(1)
  })
})
