// @vitest-environment jsdom
/**
 * S-01/S-02 (audit 2026-09-24) — umpan balik aksi sosial Etalase.
 *
 * Sebelum perbaikan: tap suka kedua saat request pertama masih berjalan
 * DIBUANG diam-diam, dan tombol simpan baru berubah setelah dua lompatan async
 * (`getMeCached()` → `loadShowcaseBookmarks()`) sehingga terasa mati.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

const mocks = vi.hoisted(() => ({
  like: vi.fn(),
  unlike: vi.fn(),
  detail: vi.fn(),
  getMeCached: vi.fn(),
  toastShow: vi.fn(),
  push: vi.fn(),
  session: true,
}))

vi.mock("expo-router", () => ({
  router: { push: mocks.push },
  useGlobalSearchParams: () => ({ kind: "popular" }),
  usePathname: () => "/showcase",
}))
vi.mock("@/lib/api", () => ({
  api: { users: { getMeCached: mocks.getMeCached } },
  isApiError: () => false,
  userMessage: () => "failed",
}))
vi.mock("@/lib/api/showcase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/showcase")>()),
  likeShowcase: mocks.like,
  unlikeShowcase: mocks.unlike,
  getShowcaseDetail: mocks.detail,
}))
vi.mock("@/lib/guest-gate", () => ({
  useHasSession: () => mocks.session,
  useSessionRevision: () => 0,
  useGuestPathBlocked: () => false,
}))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: mocks.toastShow }) }))

import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"
import { clearShowcaseLikeOverride, isShowcaseSaved, toggleShowcaseSaved } from "@/lib/showcase-social-prefs"

const item = {
  id: "w1",
  isLiked: false,
  likeCount: 4,
  title: "w1",
  createdAt: "2026-09-23T00:00:00Z",
  author: { userId: "u1", username: "seller" },
} as unknown as ShowcaseSocialItem

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function Harness() {
  const { liked, likeCount, saved, likePending, toggleLike, toggleSave, requireLogin } =
    useShowcaseSocialActions(item)
  return (
    <div>
      <span data-testid="state">{`liked:${liked ? "yes" : "no"}:${likeCount}:saved:${saved ? "yes" : "no"}`}</span>
      <span data-testid="pending">{`like:${likePending ? "busy" : "idle"}`}</span>
      <button onClick={toggleLike}>like</button>
      <button onClick={toggleSave}>save</button>
      <button onClick={requireLogin}>login</button>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.session = true
  mocks.getMeCached.mockResolvedValue({ id: "me", username: "me" })
  clearShowcaseLikeOverride("w1")
  if (isShowcaseSaved("w1")) toggleShowcaseSaved("w1")
})
afterEach(cleanup)

describe("S-01 — tap suka kedua tidak dibuang", () => {
  it("tap kedua DIANTRE dan dieksekusi setelah request pertama selesai", async () => {
    const first = deferred<{ liked: boolean; likeCount: number }>()
    const second = deferred<{ liked: boolean; likeCount: number }>()
    mocks.like.mockReturnValueOnce(first.promise)
    mocks.unlike.mockReturnValueOnce(second.promise)

    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:no"))

    act(() => { screen.getByText("like").click() })
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:yes:5:saved:no"))
    // Tap kedua saat request masih berjalan: dulu tidak terjadi apa pun.
    act(() => { screen.getByText("like").click() })
    expect(mocks.like.mock.calls.length).toBe(1)
    expect(mocks.unlike.mock.calls.length).toBe(0)

    await act(async () => { first.resolve({ liked: true, likeCount: 5 }) })
    // Toggle yang ditahan kini dieksekusi: batal suka.
    await waitFor(() => expect(mocks.unlike.mock.calls.length).toBe(1))
    await act(async () => { second.resolve({ liked: false, likeCount: 4 }) })
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:no"))
    expect(screen.getByTestId("pending").textContent).toBe("like:idle")
  })

  it("menandai state 'busy' selama request berjalan (bukan diam)", async () => {
    const pending = deferred<{ liked: boolean; likeCount: number }>()
    mocks.like.mockReturnValueOnce(pending.promise)
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("like:idle"))
    act(() => { screen.getByText("like").click() })
    await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("like:busy"))
    await act(async () => { pending.resolve({ liked: true, likeCount: 5 }) })
    await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("like:idle"))
  })

  it("gagal suka mengembalikan nilai sebelumnya + toast", async () => {
    mocks.like.mockRejectedValueOnce(new Error("offline"))
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:no"))
    act(() => { screen.getByText("like").click() })
    await waitFor(() => expect(mocks.toastShow).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:no"))
  })
})

describe("S-02 — simpan optimistis", () => {
  it("label berubah SEGERA, sebelum hidrasi bookmark selesai", async () => {
    const me = deferred<{ id: string; username: string }>()
    mocks.getMeCached.mockReturnValue(me.promise)
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:no"))

    act(() => { screen.getByText("save").click() })
    // Inti S-02: segera setelah tap, tanpa menunggu async apa pun.
    expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:yes")

    await act(async () => { me.resolve({ id: "me", username: "me" }) })
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:yes"))
    // Hook juga memuat bookmark saat mount; yang penting: TIDAK ada penundaan
    // visibilitas (label sudah berubah sebelum promise ini selesai).
    expect(mocks.getMeCached).toHaveBeenCalled()
  })

  it("gagal menyimpan → nilai kembali + pesan batas/kesalahan diteruskan", async () => {
    mocks.getMeCached.mockRejectedValue(new Error("offline"))
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:no"))
    act(() => { screen.getByText("save").click() })
    expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:yes")
    await waitFor(() => expect(mocks.toastShow).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("liked:no:4:saved:no"))
  })

  it("tamu diarahkan ke login dengan jalur kembali layar ini", async () => {
    mocks.session = false
    render(<Harness />)
    act(() => { screen.getByText("login").click() })
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: "/login-required",
      params: { next: "/showcase?kind=popular" },
    })
  })
})
