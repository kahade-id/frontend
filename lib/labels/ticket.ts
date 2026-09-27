/**
 * Kahade — label kategori tiket dukungan (mega-batch FE-IMP-5, item 125).
 *
 * Kartu tiket dan form "Buat tiket" tidak boleh menampilkan kode mentah
 * backend ("PAYMENT", "ORDER", …) — selalu lewat peta ini. Satu sumber
 * kebenaran: `app/contact.tsx` (chip kategori) dan
 * <SupportTicketCard> memakai fungsi yang sama.
 *
 * Konvensi lib/labels: string Indonesia polos di level modul (bukan
 * translate()) — translate() di level modul membekukan bahasa saat modul
 * pertama dimuat dan tidak ikut berganti saat pengguna mengubah bahasa.
 */

/** Kode kategori backend → label Indonesia. */
export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "Umum",
  ORDER: "Pesanan",
  PAYMENT: "Pembayaran",
  ACCOUNT: "Akun",
  KYC: "Verifikasi",
  TECHNICAL: "Teknis",
  OTHER: "Lainnya",
}

/** Label Indonesia untuk kode kategori tiket; kode asing → kode apa adanya. */
export function ticketCategoryLabel(code: string | null | undefined): string {
  if (!code) return "Umum"
  return Object.prototype.hasOwnProperty.call(TICKET_CATEGORY_LABELS, code)
    ? TICKET_CATEGORY_LABELS[code]
    : code
}
