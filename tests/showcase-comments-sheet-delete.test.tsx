// @vitest-environment jsdom
/**
 * SO-03 (audit etalase 2026-10-10): hapus komentar dari sheet feed —
 * konfirmasi dulu, optimistis dengan rollback, dan delta −1 ke ledger.
 *
 * Bug lama: menu "Hapus komentar" langsung menghapus tanpa Dialog, menunggu
 * server, lalu reload; ledger tidak dapat event → hitungan kartu feed tetap
 * "12 Komentar" sementara sheet "Komentar 11".
 */
import { type ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  toast: vi.fn(),
  commentDelta: vi.fn(),
  setData: vi.fn(),
  queryData: null as unknown,
}))

vi.mock("phosphor-react-native", () => ({ ChatCircle: () => null, Copy: () => null, Flag: () => null, PaperPlaneRight: () => null, Trash: () => null, X: () => null }))
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }))
vi.mock("@/lib/api/showcase", () => ({ addShowcaseComment: vi.fn(), deleteShowcaseComment: mocks.del, listShowcaseComments: vi.fn() }))
vi.mock("@/lib/api", () => ({ isApiError: () => false, userMessage: () => "failed", createIdempotencyKey: () => "k" }))
vi.mock("@/lib/api/users", () => ({ getMeCached: () => Promise.resolve({ userId: "USR-ME" }), pickPublicUserId: (u: { userId: string }) => u.userId }))
vi.mock("@/lib/clipboard", () => ({ useCopy: () => ({ copy: vi.fn() }) }))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => true, useSessionRevision: () => 0 }))
vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: () => ({ data: mocks.queryData, setData: mocks.setData, loading: false, error: null, reload: vi.fn() }),
}))
vi.mock("@/lib/showcase-social-prefs", () => ({ queueShowcaseCommentCount: mocks.commentDelta }))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: mocks.toast }) }))
vi.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <div>{children}{footer}</div>,
}))
vi.mock("@/components/ui/action-sheet", () => ({
  ActionSheet: ({ visible, actions }: { visible: boolean; actions: Array<{ key: string; label: string; onPress: () => void }> }) =>
    visible ? <div>{actions.map((a) => <button key={a.key} onClick={a.onPress}>{a.label}</button>)}</div> : null,
}))
vi.mock("@/components/ui/modal", () => ({
  Dialog: ({ visible, onConfirm, onCancel }: { visible: boolean; onConfirm: () => void; onCancel: () => void }) =>
    visible ? <div><button onClick={onConfirm}>confirm-delete</button><button onClick={onCancel}>cancel-delete</button></div> : null,
}))
vi.mock("@/components/ui/button", () => ({ Button: ({ onPress, children }: { onPress: () => void; children: ReactNode }) => <button onClick={onPress}>{children}</button> }))
vi.mock("@/components/ui/chip", () => ({ Chip: ({ children }: { children: ReactNode }) => <span>{children}</span> }))
vi.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: ReactNode }) => <span>{children}</span> }))
vi.mock("@/components/ui/input", () => ({ Input: () => <input aria-label="draft" /> }))
vi.mock("@/components/ui/icon-button", () => ({ IconButton: ({ onPress }: { onPress: () => void }) => <button onClick={onPress}>send</button> }))
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }))
vi.mock("@/components/ui/divider", () => ({ Divider: () => null }))
vi.mock("@/components/ui/error-state", () => ({ ErrorState: () => null }))
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null, SkeletonGroup: () => null }))
vi.mock("@/components/ui/showcase-comment-row", () => ({
  CommentRepliesToggle: () => null,
  ShowcaseCommentRow: ({ comment, onOpenMenu, children }: { comment: { id: string; content: string; isDeleted?: boolean }; onOpenMenu?: (c: unknown) => void; children?: ReactNode }) => (
    <div>
      <span>{comment.isDeleted ? `deleted:${comment.id}` : comment.content}</span>
      <button onClick={() => onOpenMenu?.(comment)}>menu-{comment.id}</button>
      {children}
    </div>
  ),
}))

import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"

const item = { id: "s1", commentCount: 2 } as ShowcaseSocialItem
const mine = (id: string, extra: Record<string, unknown> = {}) => ({
  id, showcaseId: "s1", parentId: null, content: `isi ${id}`, createdAt: "2026-10-10T00:00:00.000Z",
  author: { userId: "USR-ME", username: "me", fullName: null }, replies: [], ...extra,
})

function pending() {
  let resolve!: (value: unknown) => void
  let reject!: (err: unknown) => void
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.queryData = { data: [mine("c1"), mine("c2")], total: 2 }
})
afterEach(cleanup)

async function openDeleteFor(id: string) {
  render(<ShowcaseCommentsSheet item={item} onRequestClose={() => {}} />)
  await waitFor(() => expect(screen.getByText(`menu-${id}`)).toBeTruthy())
  // isMine membutuhkan meId dari getMeCached (async) → tunggu menu muncul lengkap.
  await act(async () => { fireEvent.click(screen.getByText(`menu-${id}`)) })
  await waitFor(() => expect(screen.getByText("Hapus komentar")).toBeTruthy())
}

describe("SO-03 hapus komentar dari sheet", () => {
  it("menu → Dialog konfirmasi (bukan hapus langsung); batal = tidak ada request", async () => {
    await openDeleteFor("c1")
    fireEvent.click(screen.getByText("Hapus komentar"))
    expect(mocks.del).not.toHaveBeenCalled()
    expect(screen.getByText("confirm-delete")).toBeTruthy()
    fireEvent.click(screen.getByText("cancel-delete"))
    expect(mocks.del).not.toHaveBeenCalled()
    expect(mocks.commentDelta).not.toHaveBeenCalled()
  })

  it("konfirmasi → optimistis hilang sebelum server menjawab, lalu ledger −1 saat sukses", async () => {
    const request = pending()
    mocks.del.mockReturnValue(request.promise)
    await openDeleteFor("c1")
    fireEvent.click(screen.getByText("Hapus komentar"))
    await act(async () => { fireEvent.click(screen.getByText("confirm-delete")) })

    // Optimistis: data query ditulis ulang tanpa c1 dan total −1, SEBELUM resolve.
    expect(mocks.setData).toHaveBeenCalledWith(expect.objectContaining({ total: 1, data: [expect.objectContaining({ id: "c2" })] }))
    expect(mocks.commentDelta).not.toHaveBeenCalled()

    await act(async () => request.resolve({ ok: true }))
    expect(mocks.del).toHaveBeenCalledWith("c1")
    expect(mocks.commentDelta).toHaveBeenCalledTimes(1)
    expect(mocks.commentDelta).toHaveBeenCalledWith("s1", -1)
  })

  it("gagal → rollback ke data semula, tanpa delta ledger", async () => {
    const request = pending()
    mocks.del.mockReturnValue(request.promise)
    await openDeleteFor("c2")
    fireEvent.click(screen.getByText("Hapus komentar"))
    await act(async () => { fireEvent.click(screen.getByText("confirm-delete")) })
    await act(async () => request.reject(new Error("boom")))

    const last = mocks.setData.mock.calls.at(-1)?.[0] as { total: number; data: Array<{ id: string }> }
    expect(last.total).toBe(2)
    expect(last.data.map((c) => c.id)).toEqual(["c1", "c2"])
    expect(mocks.commentDelta).not.toHaveBeenCalled()
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "danger" }))
  })

  it("SO-04: root yang punya balasan jadi placeholder isDeleted, bukan dibuang", async () => {
    mocks.queryData = { data: [mine("c1", { replyCount: 2, replies: [mine("r1", { parentId: "c1" })] })], total: 3 }
    mocks.del.mockResolvedValue({ ok: true })
    await openDeleteFor("c1")
    fireEvent.click(screen.getByText("Hapus komentar"))
    await act(async () => { fireEvent.click(screen.getByText("confirm-delete")) })
    const written = mocks.setData.mock.calls.at(-1)?.[0] as { total: number; data: Array<{ id: string; isDeleted?: boolean; replies: unknown[] }> }
    expect(written.data[0]).toMatchObject({ id: "c1", isDeleted: true })
    expect(written.data[0].replies).toHaveLength(1)
    expect(written.total).toBe(2)
    expect(mocks.commentDelta).toHaveBeenCalledWith("s1", -1)
  })
})
