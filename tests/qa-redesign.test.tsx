/**
 * Redesign Utas Tanya Jawab ala Threads (2026-09-27, TIM QA).
 *
 * Mengunci kontrak tampilan hasil redesign (API tidak ditembak — `lib/api`,
 * `useApiQuery`, `usePaginatedQuery`, dan `useHasSession` di-mock; yang diuji
 * pohon render + perilaku):
 *
 *   1. <QACard>: avatar + nama + @username + cap waktu relatif, isi
 *      pertanyaan, bar aksi Threads (balas/suka/bagikan + hitungan).
 *   2. Konektor utas: garis vertikal hanya antar balasan bersambung.
 *   3. Composer: counter karakter + tombol kirim TERKUNCI bila < minLength
 *      atau > maxLength (aturan SAMA seperti validasi layar).
 *   4. Hapus hanya milik sendiri: tombol hapus muncul hanya bila `onDelete`
 *      diberikan (pemanggil = pemilik yang menentukan).
 *   5. Empty state "Belum ada pertanyaan" + ajakan bertanya.
 *   6. Fail closed: error API -> ErrorState, bukan daftar kosong palsu.
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/qa-redesign.test.tsx
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useState } from "react"

import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/ui/toast"
import { PortalProvider } from "@/components/ui/portal"
import { QACard } from "@/components/ui/qa-card"
import {
  QaCommentComposer,
  QaCommentItem,
  isQaComposerValid,
} from "@/components/ui/qa-comment-item"
import { QaEmptyState } from "@/components/ui/qa-empty-state"
import { applyLanguage, clearTranslationCache } from "@/lib/i18n"

// ------------------------------------------------------------------
// Mock lapisan data — API asli tidak pernah ditembak.
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  hasSession: true,
  questionsData: [] as Array<Record<string, unknown>>,
  questionsLoading: false,
  questionsError: null as string | null,
  meData: null as Record<string, unknown> | null,
}))

// lib/api menarik graf native dalam — komponen & layar yang diuji hanya
// butuh tipenya; query-nya sendiri di-mock di bawah.
vi.mock("@/lib/api", () => ({ api: {} }))
vi.mock("@/lib/guest-gate", () => ({
  useHasSession: () => mocks.hasSession,
}))
vi.mock("@/lib/use-api-query", () => ({
  useApiQuery: () => ({
    data: mocks.meData,
    loading: false,
    refreshing: false,
    error: null,
    refresh: vi.fn(),
    reload: vi.fn(),
  }),
}))
vi.mock("@/lib/use-paginated-query", () => ({
  byTimestampDesc: (get: (x: unknown) => string) => get,
  usePaginatedQuery: () => ({
    data: mocks.questionsData,
    loading: mocks.questionsLoading,
    refreshing: false,
    loadingMore: false,
    error: mocks.questionsError,
    loadMoreError: null,
    hasMore: false,
    refresh: vi.fn(),
    reload: vi.fn(),
    loadMore: vi.fn(),
    setData: vi.fn(),
  }),
}))
vi.mock("expo-router", async (importOriginal) => {
  const mod = await importOriginal<typeof import("expo-router")>()
  return { ...mod, useLocalSearchParams: () => ({ username: "tokoandi" }) }
})

// Layar publik diimpor SETELAH mock terpasang.
import PublicQuestionsScreen from "@/app/user/[username]/questions"

function renderThemed(ui: React.ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ToastProvider>{ui}</ToastProvider>
      </PortalProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  applyLanguage("id")
  clearTranslationCache()
  mocks.hasSession = true
  mocks.questionsData = []
  mocks.questionsLoading = false
  mocks.questionsError = null
  mocks.meData = { id: "me-1", fullName: "Saya", username: "saya", avatarUrl: null }
})

afterEach(() => {
  cleanup()
  applyLanguage("id")
  clearTranslationCache()
})

const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

// ------------------------------------------------------------------
// 1. Kartu pertanyaan ala Threads
// ------------------------------------------------------------------

describe("<QACard> ala Threads", () => {
  it("merender avatar, nama, @username, cap waktu relatif, dan isi pertanyaan", () => {
    renderThemed(
      <QACard
        question="Apakah barang ini masih tersedia?"
        asker={{ name: "Budi Santoso", username: "budi", avatar: "https://x.test/a.jpg" }}
        date={fiveMinutesAgo}
      />,
    )
    expect(screen.getByLabelText("Foto profil Budi Santoso")).toBeTruthy()
    expect(screen.getByText("Budi Santoso")).toBeTruthy()
    expect(screen.getByText("@budi")).toBeTruthy()
    expect(screen.getByText("5 menit")).toBeTruthy()
    expect(screen.getByText("Apakah barang ini masih tersedia?")).toBeTruthy()
  })

  it("bar aksi: ikon balas + hitungan, suka + hitungan, tanpa tombol mati", () => {
    const onToggle = vi.fn()
    const { container } = renderThemed(
      <QACard
        question="Tanya stok"
        asker={{ name: "Budi" }}
        date={fiveMinutesAgo}
        commentCount={3}
        onToggleComments={onToggle}
        upvote={{ count: 12, active: false, onToggle: vi.fn() }}
      />,
    )
    const replyBtn = screen.getByRole("button", { name: "Balas" })
    expect(within(replyBtn).getByText("3")).toBeTruthy()
    fireEvent.click(replyBtn)
    expect(onToggle).toHaveBeenCalledTimes(1)

    const likeBtn = screen.getByRole("button", { name: "Suka" })
    expect(within(likeBtn).getByText("12")).toBeTruthy()
    // Ikon bagikan tidak dirender tanpa onShare — tanpa tombol mati.
    expect(container.querySelector('[data-icon="PaperPlaneTilt"]')).toBeNull()
  })

  it("suka aktif: hati terisi merah + label 'Batal suka'", () => {
    const { container } = renderThemed(
      <QACard
        question="Tanya stok"
        asker={{ name: "Budi" }}
        date={fiveMinutesAgo}
        upvote={{ count: 7, active: true, onToggle: vi.fn() }}
      />,
    )
    expect(screen.getByRole("button", { name: "Batal suka" })).toBeTruthy()
    const heart = container.querySelector('[data-icon="Heart"]')
    expect(heart?.getAttribute("data-weight")).toBe("fill")
  })

  it("jawaban resmi dirender sebagai balasan ber-utas dengan badge Penjual", () => {
    renderThemed(
      <QACard
        question="Apakah bisa COD?"
        asker={{ name: "Budi" }}
        date={fiveMinutesAgo}
        answer={{
          text: "Bisa, silakan checkout.",
          by: { name: "@tokoandi", username: "tokoandi" },
          date: fiveMinutesAgo,
        }}
      />,
    )
    expect(screen.getByText("Bisa, silakan checkout.")).toBeTruthy()
    expect(screen.getByText("Penjual")).toBeTruthy()
  })

  it("tanpa jawaban: tampil 'Belum dijawab' + slot answerAction", () => {
    renderThemed(
      <QACard
        question="Tanya stok"
        asker={{ name: "Budi" }}
        date={fiveMinutesAgo}
        answerAction={<button type="button">Jawab</button>}
      />,
    )
    expect(screen.getByText("Belum dijawab")).toBeTruthy()
    expect(screen.getByText("Jawab")).toBeTruthy()
  })
})

// ------------------------------------------------------------------
// 2. Hapus hanya milik sendiri
// ------------------------------------------------------------------

describe("aturan hapus milik sendiri", () => {
  it("kartu: menu overflow + 'Hapus' hanya ada bila onDelete diberikan", () => {
    const { rerender } = renderThemed(
      <QACard question="Tanya" asker={{ name: "Budi" }} date={fiveMinutesAgo} />,
    )
    expect(screen.queryByRole("button", { name: "Opsi lainnya" })).toBeNull()

    const onDelete = vi.fn()
    rerender(
      <ThemeProvider>
        <QACard question="Tanya" asker={{ name: "Budi" }} date={fiveMinutesAgo} onDelete={onDelete} />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Opsi lainnya" }))
    const hapus = screen.getByRole("button", { name: "Hapus" })
    fireEvent.click(hapus)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it("item komentar: 'Hapus' hanya muncul bila onDelete diberikan", () => {
    const { rerender } = renderThemed(
      <QaCommentItem authorName="Budi" content="Halo" createdAt={fiveMinutesAgo} />,
    )
    expect(screen.queryByText("Hapus")).toBeNull()

    const onDelete = vi.fn()
    rerender(
      <ThemeProvider>
        <ToastProvider>
          <QaCommentItem
            authorName="Budi"
            content="Halo"
            createdAt={fiveMinutesAgo}
            onDelete={onDelete}
          />
        </ToastProvider>
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByText("Hapus"))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})

// ------------------------------------------------------------------
// 3. Konektor utas
// ------------------------------------------------------------------

describe("konektor utas balasan", () => {
  it("garis vertikal hanya digambar bila ada lanjutan (hasNext)", () => {
    const { container } = renderThemed(
      <>
        <QaCommentItem authorName="A" content="Satu" createdAt={fiveMinutesAgo} hasNext />
        <QaCommentItem authorName="B" content="Dua" createdAt={fiveMinutesAgo} />
      </>,
    )
    expect(container.querySelectorAll('[data-testid="qa-thread-line"]').length).toBe(1)
  })

  it("tanpa hasNext: tidak ada garis konektor", () => {
    const { container } = renderThemed(
      <QaCommentItem authorName="A" content="Satu" createdAt={fiveMinutesAgo} />,
    )
    expect(container.querySelectorAll('[data-testid="qa-thread-line"]').length).toBe(0)
  })

  it("cap waktu komentar relatif", () => {
    renderThemed(<QaCommentItem authorName="A" content="Satu" createdAt={fiveMinutesAgo} />)
    expect(screen.getByText("5 menit")).toBeTruthy()
  })
})

// ------------------------------------------------------------------
// 4. Composer: counter + validasi panjang
// ------------------------------------------------------------------

describe("<QaCommentComposer>", () => {
  function type(text: string) {
    fireEvent.change(screen.getByPlaceholderText("Tulis balasan…"), {
      target: { value: text },
    })
  }

  it("counter menampilkan n/maxLength", () => {
    const onSubmit = vi.fn()
    function H() {
      const [value, setValue] = useState("")
      return (
        <QaCommentComposer
          value={value}
          onChangeText={setValue}
          onSubmit={onSubmit}
          minLength={5}
          maxLength={500}
        />
      )
    }
    renderThemed(<H />)
    expect(screen.getByText("0/500")).toBeTruthy()
    type("abc")
    expect(screen.getByText("3/500")).toBeTruthy()
  })

  it("tombol kirim TERKUNCI di bawah minimum (aturan pertanyaan 5–500)", () => {
    const onSubmit = vi.fn()
    function H() {
      const [value, setValue] = useState("")
      return (
        <QaCommentComposer
          value={value}
          onChangeText={setValue}
          onSubmit={onSubmit}
          minLength={5}
          maxLength={500}
        />
      )
    }
    renderThemed(<H />)
    const send = screen.getByRole("button", { name: "Kirim balasan" })

    // < 5 karakter: klik tidak mengirim.
    type("abcd")
    expect(screen.getByText("4/500")).toBeTruthy()
    fireEvent.click(send)
    expect(onSubmit).not.toHaveBeenCalled()

    // Tepat 5 karakter: terbuka.
    type("abcde")
    fireEvent.click(screen.getByRole("button", { name: "Kirim balasan" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("tombol kirim TERKUNCI di atas maksimum", () => {
    const onSubmit = vi.fn()
    function H() {
      const [value, setValue] = useState("")
      return (
        <QaCommentComposer
          value={value}
          onChangeText={setValue}
          onSubmit={onSubmit}
          minLength={5}
          maxLength={500}
        />
      )
    }
    renderThemed(<H />)
    type("x".repeat(501))
    fireEvent.click(screen.getByRole("button", { name: "Kirim balasan" }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("aturan balasan 1–1000: 1 karakter sudah valid", () => {
    const onSubmit = vi.fn()
    function H() {
      const [value, setValue] = useState("")
      return (
        <QaCommentComposer
          value={value}
          onChangeText={setValue}
          onSubmit={onSubmit}
          minLength={1}
          maxLength={1000}
        />
      )
    }
    renderThemed(<H />)
    type("y")
    expect(screen.getByText("1/1000")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Kirim balasan" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("isQaComposerValid: helper aturan panjang", () => {
    expect(isQaComposerValid("    ", 5, 500)).toBe(false)
    expect(isQaComposerValid("abcd", 5, 500)).toBe(false)
    expect(isQaComposerValid("abcde", 5, 500)).toBe(true)
    expect(isQaComposerValid("x".repeat(500), 5, 500)).toBe(true)
    expect(isQaComposerValid("x".repeat(501), 5, 500)).toBe(false)
    expect(isQaComposerValid("y", 1, 1000)).toBe(true)
  })
})

// ------------------------------------------------------------------
// 5. Empty state
// ------------------------------------------------------------------

describe("<QaEmptyState>", () => {
  it("'Belum ada pertanyaan' + ajakan bertanya memanggil onAsk", () => {
    const onAsk = vi.fn()
    renderThemed(<QaEmptyState onAsk={onAsk} />)
    expect(screen.getByText("Belum ada pertanyaan")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Ajukan pertanyaan" }))
    expect(onAsk).toHaveBeenCalledTimes(1)
  })

  it("tanpa onAsk: tidak ada tombol CTA", () => {
    renderThemed(<QaEmptyState />)
    expect(screen.getByText("Belum ada pertanyaan")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Ajukan pertanyaan" })).toBeNull()
  })
})

// ------------------------------------------------------------------
// 6. Layar feed publik: empty state + fail closed
// ------------------------------------------------------------------

describe("layar Tanya Jawab publik", () => {
  it("daftar kosong -> empty state cantik dengan CTA", () => {
    renderThemed(<PublicQuestionsScreen />)
    expect(screen.getByText("Belum ada pertanyaan")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ajukan pertanyaan" })).toBeTruthy()
  })

  it("fail closed: error API -> ErrorState, bukan daftar kosong palsu", () => {
    mocks.questionsError = "Jaringan gagal"
    renderThemed(<PublicQuestionsScreen />)
    expect(screen.getByText("Gagal memuat")).toBeTruthy()
    expect(screen.queryByText("Belum ada pertanyaan")).toBeNull()
  })

  it("ada data -> kartu pertanyaan tampil", () => {
    mocks.questionsData = [
      {
        id: "q1",
        question: "Apakah garansi resmi?",
        createdAt: fiveMinutesAgo,
        askerId: "other-1",
        asker: { username: "budi", fullName: "Budi Santoso", avatarUrl: null },
        commentCount: 2,
        upvoteCount: 5,
        isUpvotedByViewer: false,
        answer: "Ya, garansi resmi 1 tahun.",
        answeredAt: fiveMinutesAgo,
      },
    ]
    renderThemed(<PublicQuestionsScreen />)
    expect(screen.getByText("Apakah garansi resmi?")).toBeTruthy()
    expect(screen.getByText("Ya, garansi resmi 1 tahun.")).toBeTruthy()
  })
})
