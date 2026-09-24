/**
 * Kahade — SATU sumber judul toast operasi komentar Etalase.
 *
 * D-01/U-07 (audit 2026-09-24): tujuh kalimat yang sama ditulis ulang di layar
 * detail (`app/showcase/[id].tsx`) dan sheet komentar
 * (`components/ui/showcase-comments-sheet.tsx`). Duplikasi itu membuat copy
 * mudah menyimpang antar-permukaan. Nilai di sini adalah LITERAL (bukan hasil
 * `translate()` saat modul dimuat) supaya:
 *   1. `scripts/gen-i18n-catalog.mjs` tetap mengumpulkannya sebagai kunci
 *      katalog — ia memindai object literal di `lib/`,
 *   2. bahasa aktif tetap dibaca di titik render (`<Text>`/Toast menerjemahkan
 *      nilainya), bukan sekali saat import.
 */
export const SHOWCASE_COMMENT_MESSAGES = {
  sendFailed: "Gagal mengirim komentar",
  saveFailed: "Gagal menyimpan komentar",
  deleted: "Komentar dihapus",
  hidden: "Komentar disembunyikan",
  updateFailed: "Gagal memperbarui komentar",
  restored: "Komentar ditampilkan kembali",
  revealFailed: "Gagal membuka komentar",
} as const
