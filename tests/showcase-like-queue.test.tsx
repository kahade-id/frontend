// @vitest-environment jsdom
/**
 * SO-01/SO-02 (audit etalase 2026-10-10): antrean toggle suka = STATE TUJUAN
 * terakhir, global per item.
 *
 * Bug lama: antrean berupa flag boolean per instance hook —
 *  - tiga tap beruntun (suka → batal → suka) saat request berjalan berakhir
 *    TIDAK suka (flag idempoten, satu toggle dieksekusi);
 *  - tap kedua tanpa umpan balik sampai request pertama selesai;
 *  - flag tersangkut di instance lain (kartu feed vs detail item yang sama)
 *    → satu tap belakangan memicu dua request berlawanan arah.
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
import { resetShowcaseStateForTests } from "@/lib/showcase-state"

const item = (id: string): ShowcaseSocialItem =>
  ({ id, title: "T", images: [], author: { username: "p" }, isLiked: false, likeCount: 1 }) as unknown as ShowcaseSocialItem

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetShowcaseStateForTests()
})

describe("SO-01: tujuan terakhir menang, umpan balik seketika", () => {
  it("tiga tap (suka → batal → suka) saat request berjalan → akhir SUKA, tanpa request kedua", async () => {
    const first = deferred<{ liked: boolean; likeCount: number }>()
    mocks.like.mockImplementationOnce(() => first.promise)
    const { result } = renderHook(() => useShowcaseSocialActions(item("q-1")))

    act(() => result.current.toggleLike()) // suka (request A)
    expect(result.current.liked).toBe(true)
    expect(result.current.likeCount).toBe(2)
    act(() => result.current.toggleLike()) // batal — tampilan berubah SEKARANG
    expect(result.current.liked).toBe(false)
    expect(result.current.likeCount).toBe(1)
    act(() => result.current.toggleLike()) // suka lagi
    expect(result.current.liked).toBe(true)
    expect(result.current.likeCount).toBe(2)
    expect(mocks.like).toHaveBeenCalledTimes(1)

    await act(async () => first.resolve({ liked: true, likeCount: 2 }))

    // Tujuan (suka) sama dengan state server → tidak ada request lanjutan.
    expect(mocks.like).toHaveBeenCalledTimes(1)
    expect(mocks.unlike).not.toHaveBeenCalled()
    expect(result.current.liked).toBe(true)
    expect(result.current.likeCount).toBe(2)
    await waitFor(() => expect(result.current.likePending).toBe(false))
  })

  it("dua tap (suka → batal) → tepat SATU request lanjutan unlike, hitungan dari basis server", async () => {
    const first = deferred<{ liked: boolean; likeCount: number }>()
    mocks.like.mockImplementationOnce(() => first.promise)
    mocks.unlike.mockResolvedValue({ liked: false, likeCount: 7 })
    const { result } = renderHook(() => useShowcaseSocialActions(item("q-2")))

    act(() => result.current.toggleLike())
    act(() => result.current.toggleLike())
    expect(result.current.liked).toBe(false)

    // Server ternyata menghitung 8 suka (orang lain ikut menyukai).
    await act(async () => first.resolve({ liked: true, likeCount: 8 }))
    await waitFor(() => expect(mocks.unlike).toHaveBeenCalledTimes(1))
    // Fallback hitungan request lanjutan = basis server − 1, bukan tebakan lokal.
    expect(mocks.unlike).toHaveBeenCalledWith("q-2", 7)
    await waitFor(() => expect(result.current.liked).toBe(false))
    expect(result.current.likeCount).toBe(7)
  })
})

describe("SO-02: antrean & status sibuk lintas instance (kartu feed + detail item sama)", () => {
  it("tap di instance B saat request instance A berjalan → A yang mengeksekusi; B tampil sibuk", async () => {
    const first = deferred<{ liked: boolean; likeCount: number }>()
    mocks.like.mockImplementationOnce(() => first.promise)
    mocks.unlike.mockResolvedValue({ liked: false, likeCount: 1 })
    const a = renderHook(() => useShowcaseSocialActions(item("q-3")))
    const b = renderHook(() => useShowcaseSocialActions(item("q-3")))

    act(() => a.result.current.toggleLike())
    await waitFor(() => expect(b.result.current.likePending).toBe(true))
    act(() => b.result.current.toggleLike()) // batal — dari instance lain
    expect(b.result.current.liked).toBe(false)
    expect(a.result.current.liked).toBe(false)

    await act(async () => first.resolve({ liked: true, likeCount: 2 }))
    await waitFor(() => expect(mocks.unlike).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(a.result.current.liked).toBe(false))
    expect(b.result.current.liked).toBe(false)
    await waitFor(() => expect(a.result.current.likePending).toBe(false))

    // Tap berikutnya di B = satu request biasa (dulu: flag basi B memicu
    // request kedua berlawanan arah).
    mocks.like.mockResolvedValueOnce({ liked: true, likeCount: 2 })
    await act(async () => b.result.current.toggleLike())
    await waitFor(() => expect(mocks.like).toHaveBeenCalledTimes(2))
    expect(mocks.unlike).toHaveBeenCalledTimes(1)
  })
})
