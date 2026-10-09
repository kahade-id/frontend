/**
 * <QaThread> — perilaku interaktif utas balasan Tanya Jawab profil.
 *
 * Mengunci:
 *   - balasan bersarang tampil di bawah induknya;
 *   - kedalaman ambang: anak disembunyikan di balik "Tampilkan N balasan"
 *     dan terbuka saat diketuk;
 *   - "Balas" meneruskan komentar yang benar ke pemanggil;
 *   - "Hapus" hanya untuk balasan milik viewer; "Sembunyikan" hanya bila
 *     viewer adalah pemilik profil dan komentarnya bukan milik pemilik.
 *
 * Dijalankan dengan config komponen:
 *   npx vitest run --config vitest.components.config.ts tests/qa-thread-component.test.tsx
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalProvider } from "@/components/ui/portal"
import { QaThread } from "@/components/ui/qa-thread"
import { ToastProvider } from "@/components/ui/toast"
import type { QuestionComment } from "@/lib/api/users"
import { applyLanguage, clearTranslationCache } from "@/lib/i18n"
import { THREAD_COLLAPSE_DEPTH, buildCommentThread } from "@/lib/qa-thread"

function renderThemed(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ToastProvider>{ui}</ToastProvider>
      </PortalProvider>
    </ThemeProvider>,
  )
}

const T0 = Date.parse("2026-10-01T10:00:00Z")
const at = (m: number) => new Date(T0 + m * 60_000).toISOString()

function comment(over: Partial<QuestionComment> & { id: string }): QuestionComment {
  return { content: `isi ${over.id}`, createdAt: at(0), authorName: `Nama ${over.id}`, ...over }
}

const noop = () => {}

function baseProps(items: QuestionComment[]) {
  return {
    sort: "newest" as const,
    onSortChange: noop,
    isMine: () => false,
    canHide: false,
    onHide: noop,
    onReply: noop,
    onDelete: noop,
    nodes: buildCommentThread(items, "newest"),
  }
}

beforeEach(() => {
  applyLanguage("id")
  clearTranslationCache()
})

afterEach(() => {
  cleanup()
  applyLanguage("id")
  clearTranslationCache()
})

describe("<QaThread> — bersarang & collapse", () => {
  it("balasan anak tampil di bawah induknya", () => {
    const items = [
      comment({ id: "p", createdAt: at(0) }),
      comment({ id: "c1", parentId: "p", createdAt: at(1) }),
    ]
    renderThemed(<QaThread {...baseProps(items)} />)
    expect(screen.getByText("isi p")).toBeTruthy()
    expect(screen.getByText("isi c1")).toBeTruthy()
  })

  it("pada kedalaman ambang anak disembunyikan lalu terbuka saat diketuk", () => {
    // Rantai n0 → n1 → n2 → n3 (n3 berada di kedalaman ambang, punya anak).
    const items: QuestionComment[] = []
    const depth = THREAD_COLLAPSE_DEPTH
    for (let i = 0; i <= depth + 1; i++) {
      items.push(comment({ id: `n${i}`, parentId: i === 0 ? undefined : `n${i - 1}`, createdAt: at(i) }))
    }
    renderThemed(<QaThread {...baseProps(items)} />)

    // Anak dari node ambang (n{depth+1}) belum tampil.
    expect(screen.queryByText(`isi n${depth + 1}`)).toBeNull()
    const toggle = screen.getByRole("button", { name: "Tampilkan 1 balasan" })
    fireEvent.click(toggle)
    expect(screen.getByText(`isi n${depth + 1}`)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sembunyikan balasan" })).toBeTruthy()
  })
})

describe("<QaThread> — aksi", () => {
  it("'Balas' meneruskan komentar yang diketuk ke pemanggil", () => {
    const onReply = vi.fn()
    const items = [comment({ id: "x", authorUsername: "budi" })]
    renderThemed(<QaThread {...baseProps(items)} onReply={onReply} />)
    fireEvent.click(screen.getByText("Balas"))
    expect(onReply).toHaveBeenCalledTimes(1)
    expect(onReply.mock.calls[0][0].id).toBe("x")
  })

  it("'Hapus' hanya untuk balasan milik viewer", () => {
    const onDelete = vi.fn()
    const items = [comment({ id: "mine" }), comment({ id: "theirs", createdAt: at(1) })]
    renderThemed(
      <QaThread {...baseProps(items)} isMine={(c) => c.id === "mine"} onDelete={onDelete} />,
    )
    expect(screen.getAllByText("Hapus")).toHaveLength(1)
    fireEvent.click(screen.getByText("Hapus"))
    expect(onDelete.mock.calls[0][0].id).toBe("mine")
  })

  it("'Sembunyikan' hanya bila viewer pemilik dan komentar bukan milik pemilik", () => {
    const onHide = vi.fn()
    const items = [
      comment({ id: "owner", isOwner: true }),
      comment({ id: "visitor", createdAt: at(1) }),
    ]
    renderThemed(<QaThread {...baseProps(items)} canHide onHide={onHide} />)
    const hides = screen.getAllByRole("button", { name: "Sembunyikan" })
    expect(hides).toHaveLength(1)
    fireEvent.click(hides[0])
    expect(onHide.mock.calls[0][0].id).toBe("visitor")
  })

  it("tanpa canHide: tidak ada 'Sembunyikan' sama sekali", () => {
    const items = [comment({ id: "visitor" })]
    renderThemed(<QaThread {...baseProps(items)} canHide={false} />)
    expect(screen.queryByRole("button", { name: "Sembunyikan" })).toBeNull()
  })
})

describe("<QaThread> — urutan", () => {
  it("chip Teratas/Terbaru tampil bila ada lebih dari satu balasan", () => {
    const onSortChange = vi.fn()
    const items = [comment({ id: "a" }), comment({ id: "b", createdAt: at(1) })]
    renderThemed(<QaThread {...baseProps(items)} sort="top" onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Terbaru" }))
    expect(onSortChange).toHaveBeenCalledWith("newest")
  })

  it("satu balasan saja: chip urutan disembunyikan", () => {
    renderThemed(<QaThread {...baseProps([comment({ id: "solo" })])} />)
    expect(screen.queryByRole("button", { name: "Terbaru" })).toBeNull()
  })

  it("jumlah 'membantu' tampil read-only bila backend mengirim upvoteCount", () => {
    const items = [comment({ id: "h", upvoteCount: 4 })]
    renderThemed(<QaThread {...baseProps(items)} />)
    expect(screen.getByLabelText("4 membantu")).toBeTruthy()
  })
})
