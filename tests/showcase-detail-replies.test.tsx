// @vitest-environment jsdom
/**
 * U-02 (audit 2026-09-24) — utas balasan panjang tidak lagi ditumpahkan
 * sekaligus ke layar.
 *
 * Sebelum perbaikan: `(root.replies ?? []).map(...)` merender SEMUA balasan
 * setiap root, jadi satu karya populer bisa menambah ratusan baris tanpa cara
 * melipatnya. Test ini mengunci perilaku barunya: ringkas 3 balasan, tombol
 * "Lihat {x} balasan" membuka sisanya, dan deep link `?comment=<id>` ke
 * balasan yang terlipat tetap membuka lipatannya.
 */
import { type ReactNode } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseComment, ShowcaseCommentWithReplies } from "@/lib/api/showcase"

/*
  Revisi 2026-09-26: balasan kini dikirim sebagai ANAK baris induk (garis
  utas menyambung keduanya), jadi mock ini WAJIB merender `children` —
  tanpa itu seluruh utas hilang dan test di bawah menguji pohon kosong.
*/
vi.mock("@/components/ui/showcase-comment-row", () => ({
  ShowcaseCommentRow: ({
    comment,
    children,
  }: {
    comment: ShowcaseComment
    children?: ReactNode
  }) => (
    <div data-testid={`row-${comment.id}`}>
      {comment.id}
      {children}
    </div>
  ),
}))
vi.mock("@/components/ui/divider", () => ({ Divider: () => null }))
vi.mock("@/components/ui/load-more", () => ({
  LoadMore: () => null,
}))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => (
    <button onClick={onPress}>{children}</button>
  ),
}))
vi.mock("@/components/ui/text", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

import { ShowcaseDetailComments } from "@/components/showcase-detail-comments"

const reply = (id: string) =>
  ({ id, content: id, createdAt: "2026-09-24T00:00:00Z", author: { username: "u" } }) as unknown as ShowcaseComment

const root = (id: string, replyIds: string[]) =>
  ({
    id,
    content: id,
    createdAt: "2026-09-24T00:00:00Z",
    author: { username: "u" },
    replies: replyIds.map(reply),
  }) as unknown as ShowcaseCommentWithReplies

function renderThread(comments: ShowcaseCommentWithReplies[], highlightComment?: string) {
  return render(
    <ShowcaseDetailComments
      comments={comments}
      commentTotal={comments.length}
      commentsStatus="idle"
      commentRenderLimit={40}
      highlightComment={highlightComment}
      isOwner={false}
      hasSession
      isMine={() => false}
      canReply={() => false}
      onReply={vi.fn()}
      onOpenMenu={vi.fn()}
      onShowMore={vi.fn()}
      onLoadMore={vi.fn()}
    />,
  )
}

afterEach(cleanup)

describe("U-02: pelipatan balasan", () => {
  it("meringkas 3 balasan pertama dan menyisakan tombol untuk sisanya", () => {
    renderThread([root("r1", ["a", "b", "c", "d", "e"])])

    expect(screen.getByTestId("row-a")).toBeTruthy()
    expect(screen.getByTestId("row-c")).toBeTruthy()
    // Belum dirender sebelum dibuka — inti perbaikan performa U-02.
    expect(screen.queryByTestId("row-d")).toBeNull()
    expect(screen.queryByTestId("row-e")).toBeNull()
    expect(screen.getByText("Lihat 2 balasan")).toBeTruthy()
  })

  it("membuka dan menutup lipatan lewat tombol", () => {
    renderThread([root("r1", ["a", "b", "c", "d", "e"])])

    fireEvent.click(screen.getByText("Lihat 2 balasan"))
    expect(screen.getByTestId("row-d")).toBeTruthy()
    expect(screen.getByTestId("row-e")).toBeTruthy()

    fireEvent.click(screen.getByText("Tutup balasan"))
    expect(screen.queryByTestId("row-d")).toBeNull()
  })

  it("deep link ke balasan terlipat otomatis membuka lipatannya", () => {
    renderThread([root("r1", ["a", "b", "c", "d", "e"])], "e")

    // Tanpa auto-expand, L-06 (sorot komentar dari notifikasi) akan menunjuk
    // baris yang tidak pernah dirender.
    expect(screen.getByTestId("row-e")).toBeTruthy()
    expect(screen.queryByText("Lihat 2 balasan")).toBeNull()
  })

  it("utas pendek tidak menampilkan kontrol apa pun", () => {
    renderThread([root("r1", ["a", "b"])])

    expect(screen.getByTestId("row-b")).toBeTruthy()
    expect(screen.queryByText(/balasan/)).toBeNull()
  })
})
