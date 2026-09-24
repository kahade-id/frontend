// @vitest-environment jsdom
import { type ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
const mocks = vi.hoisted(() => ({ send: vi.fn(), toast: vi.fn(), commentDelta: vi.fn(), session: true }))
// Ikon phosphor = modul native; di lingkungan test cukup komponen nol.
vi.mock("phosphor-react-native", () => ({ ChatCircle: () => null, PaperPlaneRight: () => null }))
vi.mock("expo-router", () => ({ router: { push: vi.fn() } }))
vi.mock("@/lib/api/showcase", () => ({ addShowcaseComment: mocks.send, listShowcaseComments: vi.fn() }))
// S-03: sheet kini memakai Idempotency-Key stabil per aksi (diekspor lib/api).
vi.mock("@/lib/api", () => ({
  isApiError: () => false,
  userMessage: () => "failed",
  createIdempotencyKey: () => "test-idem-key",
}))
vi.mock("@/lib/guest-gate", () => ({ useHasSession: () => mocks.session, useSessionRevision: () => 0 }))
vi.mock("@/lib/use-api-query", () => ({ useApiQuery: () => ({ data: { data: [], total: 0 }, loading: false, error: null, reload: vi.fn() }) }))
vi.mock("@/lib/showcase-social-prefs", () => ({ queueShowcaseCommentCount: mocks.commentDelta }))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: mocks.toast }) }))
vi.mock("@/components/ui/bottom-sheet", () => ({ BottomSheet: ({ visible, children, footer }: { visible: boolean; children: ReactNode; footer: ReactNode }) => visible ? <div>{children}{footer}</div> : null }))
vi.mock("@/components/ui/button", () => ({ Button: ({ onPress, children }: { onPress: () => void; children: ReactNode }) => <button onClick={onPress}>{children}</button> }))
vi.mock("@/components/ui/text", () => ({ Text: ({ children }: { children: ReactNode }) => <span>{children}</span> }))
vi.mock("@/components/ui/input", () => ({ Input: ({ value, onChangeText, onSubmitEditing, disabled }: { value: string; onChangeText: (v: string) => void; onSubmitEditing: () => void; disabled: boolean }) => <input aria-label="draft" value={value} disabled={disabled} onChange={event => onChangeText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") onSubmitEditing() }} /> }))
vi.mock("@/components/ui/icon-button", () => ({ IconButton: ({ onPress, loading }: { onPress: () => void; loading: boolean }) => <button disabled={loading} onClick={onPress}>send</button> }))
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }))
vi.mock("@/components/ui/divider", () => ({ Divider: () => null }))
vi.mock("@/components/ui/error-state", () => ({ ErrorState: () => null }))
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => null, SkeletonGroup: () => null }))
vi.mock("@/components/ui/showcase-comment-row", () => ({ ShowcaseCommentRow: ({ comment }: { comment: { content: string } }) => <span>{comment.content}</span> }))
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
const item = (id: string) => ({ id, commentCount: 0 }) as ShowcaseSocialItem
function pending() {
  let resolve!: (value: unknown) => void
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
beforeEach(() => { vi.clearAllMocks(); mocks.session = true })
afterEach(cleanup)

describe("actual comments sheet mutation lifecycle", () => {
  it("late response for A neither appears in B nor clears B's draft", async () => {
    const request = pending()
    mocks.send.mockReturnValue(request.promise)
    const view = render(<ShowcaseCommentsSheet item={item("a")} onRequestClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "message A" } })
    fireEvent.click(screen.getByText("send"))
    view.rerender(<ShowcaseCommentsSheet item={item("b")} onRequestClose={() => {}} />)
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "draft B" } })
    await act(async () => request.resolve({ id: "a1", showcaseId: "a", content: "message A" }))
    expect(screen.queryByText("message A")).toBeNull()
    expect((screen.getByLabelText("draft") as HTMLInputElement).value).toBe("draft B")
    // F-01/C-01 (audit 2026-09-24): kontrak baru — DELTA ke ledger TEPAT
    // SEKALI per mutasi sukses (bukan markShowcaseFeedDirty yang memicu
    // refetch dan membuang halaman feed 2..N).
    expect(mocks.commentDelta).toHaveBeenCalledTimes(1)
    expect(mocks.commentDelta).toHaveBeenCalledWith("a", 1)
  })
  it("double Enter cannot submit twice; composer stays disabled while pending", async () => {
    const request = pending()
    mocks.send.mockReturnValue(request.promise)
    render(<ShowcaseCommentsSheet item={item("a")} onRequestClose={() => {}} />)
    const input = screen.getByLabelText("draft")
    fireEvent.change(input, { target: { value: "one message" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect((input as HTMLInputElement).disabled).toBe(true)
    await act(async () => request.resolve({ id: "a1", showcaseId: "a", content: "one message" }))
    expect((input as HTMLInputElement).value).toBe("")
    expect(screen.getByText("one message")).toBeTruthy()
  })
  it("guest has a login CTA rather than a composer", () => {
    mocks.session = false
    render(<ShowcaseCommentsSheet item={item("a")} onRequestClose={() => {}} />)
    expect(screen.queryByLabelText("draft")).toBeNull()
    expect(screen.getByText("Masuk untuk berkomentar")).toBeTruthy()
  })
})
