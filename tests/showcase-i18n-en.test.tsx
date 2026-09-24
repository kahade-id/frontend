// @vitest-environment jsdom
/**
 * Q-08/Q-01 (audit 2026-09-24) — gerbang RENDER bahasa Inggris untuk permukaan
 * Etalase.
 *
 * Kenapa perlu: `npm run check:i18n` hanya membuktikan katalog ↔ kamus
 * seimbang. Tiga cacat nyata (label a11y yang melewati penerjemah, kunci yang
 * tidak pernah terkumpul, plural salah) lolos gate itu tanpa jejak. Test ini
 * merender komponen Etalase SUNGGUHAN dalam bahasa Inggris dan menuntut teks
 * yang benar-benar muncul — gaya pengujian yang sama dengan
 * tests/i18n-render.test.tsx, tapi untuk permukaan showcase.
 */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

vi.mock("@/lib/guest-gate", () => ({
  useHasSession: () => true,
  useSessionRevision: () => 0,
  useGuestPathBlocked: () => false,
}))

import { applyLanguage, clearTranslationCache, translate } from "@/lib/i18n"
import { ThemeProvider } from "@/components/theme-provider"
import { ShowcaseCommentRow, isEditedComment } from "@/components/ui/showcase-comment-row"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"

const item = {
  id: "w1",
  title: "Kursi rotan",
  description: "Kursi rotan anyaman tangan.",
  category: "Furniture",
  priceMin: 250000,
  priceMax: 300000,
  isLiked: false,
  likeCount: 4,
  commentCount: 3,
  createdAt: "2026-09-01T09:00:00.000Z",
  author: { userId: "u1", username: "seller", fullName: "Penjual", isKycVerified: true },
  images: [{ id: "i1", url: "https://example.com/1.jpg", sortOrder: 0 }],
} as unknown as ShowcaseSocialItem

const comment = {
  id: "c1",
  showcaseId: "w1",
  parentId: null,
  content: "Masih ada?",
  isHidden: true,
  hiddenReason: "SPAM",
  createdAt: "2026-09-01T09:00:00.000Z",
  author: { userId: "u2", username: "buyer", fullName: "Pembeli", avatarUrl: null },
} as never

beforeEach(() => {
  act(() => applyLanguage("en"))
  clearTranslationCache()
})
afterEach(() => {
  cleanup()
  act(() => applyLanguage("id"))
  clearTranslationCache()
})

describe("kartu feed Etalase dalam bahasa Inggris", () => {
  it("membaca hitungan komentar + aksi dalam EN, bukan Indonesia", () => {
    render(
      <ThemeProvider>
        <ShowcaseFeedItem item={item} onToggleLike={() => {}} onOpenComments={() => {}} />
      </ThemeProvider>,
    )
    // A-02 (audit 2026-09-24): label a11y tombol komentar = ANGKA, dan dalam EN.
    expect(screen.getByLabelText("3 Comments")).toBeTruthy()
    expect(screen.getByText("Like")).toBeTruthy()
    // Label lain di kartu juga EN (bukti render penuh, bukan satu tombol):
    expect(screen.getByLabelText("Report work")).toBeTruthy()
    expect(screen.getByLabelText("View Penjual's profile")).toBeTruthy()
    // K-04/penanda suntingan tidak boleh muncul untuk komentar apa adanya.
    expect(screen.queryByText("(Komentar disembunyikan)")).toBeNull()
  })
})

describe("baris komentar dalam bahasa Inggris", () => {
  it("menerjemahkan penanda tersembunyi, alasan, dan aksi balas", () => {
    render(
      <ThemeProvider>
        <ShowcaseCommentRow comment={comment} canReply onReply={() => {}} />
      </ThemeProvider>,
    )
    expect(screen.getByText("(Comment hidden)")).toBeTruthy()
    expect(screen.getByText("Reason: Spam")).toBeTruthy()
    expect(screen.getByText("Reply")).toBeTruthy()
  })
})

describe("kunci Etalase yang dulu tidak pernah terkumpul", () => {
  it("menghasilkan English (bukan fallback Indonesia)", () => {
    expect(translate("Judul wajib diisi.")).toBe("Title is required.")
    expect(translate("Harga maksimum harus ≥ harga minimum.")).toBe("Maximum price must be ≥ minimum price.")
    expect(translate("Profil tidak ditemukan.")).toBe("Profile not found.")
    expect(translate("Tutup balasan")).toBe("Hide replies")
    expect(translate("Lihat balasan")).toBe("View replies")
    expect(translate("Muat komentar berikutnya")).toBe("Load more comments")
    expect(translate("Karya terlihat di feed & profil publik Anda.")).toBe("The work appears in the feed and your public profile.")
    expect(translate("Karya disimpan sebagai draf privat (tidak terlihat pengunjung).")).toBe("The work is saved as a private draft (not visible to visitors).")
  })

  it("menghasilkan English untuk jalur render yang dulu melewati penerjemah", () => {
    expect(translate("Memuat etalase")).toBe("Loading showcase")
    expect(translate("Saring hasil pencarian")).toBe("Filter search results")
    expect(translate("Etalase")).toBe("Showcase")
    expect(translate("Buka komentar")).toBe("Open comments")
    expect(translate("Buka opsi karya")).toBe("Open work options")
  })

  it("plural EN jamak: '{x} Komentar' → '{x} Comments'", () => {
    expect(translate("{x} Komentar", { x: 3 })).toBe("3 Comments")
  })
})

describe("C-04 — penanda '(diedit)' tahan beda presisi waktu", () => {
  it("tidak menandai komentar yang createdAt == updatedAt", () => {
    expect(isEditedComment("2026-09-01T09:00:00.000Z", "2026-09-01T09:00:00.000Z")).toBe(false)
  })
  it("tidak menandai perbedaan presisi detik vs milidetik", () => {
    expect(isEditedComment("2026-09-01T09:00:00.000Z", "2026-09-01T09:00:00Z")).toBe(false)
  })
  it("menandai suntingan yang benar-benar berbeda", () => {
    expect(isEditedComment("2026-09-01T09:00:00.000Z", "2026-09-01T09:05:00.000Z")).toBe(true)
  })
  it("mengabaikan nilai tak terurai / kosong", () => {
    expect(isEditedComment("2026-09-01T09:00:00.000Z", undefined)).toBe(false)
    expect(isEditedComment("2026-09-01T09:00:00.000Z", "")).toBe(false)
  })
})
