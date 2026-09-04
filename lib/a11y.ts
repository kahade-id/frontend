/**
 * Kahade — helper label screen reader (audit #4, grouping & urutan baca kartu).
 *
 * Kartu kompleks (order, sengketa, langganan) menampilkan 5–8 fragmen teks.
 * Tanpa grouping, VoiceOver/TalkBack membacanya sebagai 5–8 elemen terpisah:
 * pengguna harus swipe berulang dan kehilangan konteks ("Rp 1.500.000" tanpa
 * tahu itu milik pesanan yang mana).
 *
 * `summarize()` merangkai fragmen menjadi SATU kalimat dengan urutan logis
 * yang sama dengan urutan visual, membuang bagian kosong (`undefined`, `null`,
 * `false`, string kosong) supaya call site tidak perlu `.filter(Boolean)`
 * berulang — pola yang sebelumnya disalin di belasan kartu.
 *
 * Pemisah: koma + spasi. Koma memicu jeda prosodi pendek di VoiceOver dan
 * TalkBack, jadi label terbaca sebagai daftar, bukan satu kalimat panjang.
 * Titik di akhir fragmen dibiarkan apa adanya (kalimat deskripsi tetap wajar).
 *
 * Penting — batas grouping (§WCAG 1.3.2 urutan bermakna):
 *   - Root kartu boleh di-`accessible` HANYA bila di dalamnya tidak ada
 *     elemen fokusable. `accessible` pada View membuat seluruh subtree
 *     berhenti menjadi target fokus di iOS dan Android, sehingga tombol
 *     "Bayar"/"Perpanjang" akan HILANG dari screen reader.
 *   - Kartu yang punya aksi memakai <CardSummary> (lihat `card.tsx`) untuk
 *     mengelompokkan bagian informasinya saja; tombol tetap di luar grup.
 */

/** Fragmen label: string, atau nilai kosong yang akan dibuang. */
export type SummaryPart = string | number | false | null | undefined

/**
 * Merangkai fragmen label screen reader menjadi satu string.
 *
 * @example
 * summarize(["Pesanan #123", formatRupiah(1500000), "Selesai", "3 Sep"])
 * // -> "Pesanan #123, Rp 1.500.000, Selesai, 3 Sep"
 *
 * @example
 * summarize(["Paket Pro", isPopular && "Populer"])
 * // -> "Paket Pro"  (fragmen `false` dibuang)
 */
export function summarize(parts: readonly SummaryPart[]): string {
  return parts
    .map((p) => (typeof p === "number" ? String(p) : p))
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .map((p) => p.trim())
    .join(", ")
}
