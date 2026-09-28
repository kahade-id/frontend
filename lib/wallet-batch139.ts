/**
 * Kahade — helper murni batch 139 area D (Dompet & Transaksi).
 *
 * UI-only, fail-closed. Tidak menyentuh logika uang/escrow/ledger — hanya
 * keputusan presentasi yang bisa diuji tanpa render.
 */

/** D04: hasil lookup ulang penerima transfer. */
export type RevalidatedRecipient =
  | { valid: true; name: string }
  | { valid: false }

/**
 * D04 (batch 139): cocokkan hasil lookup ulang dengan penerima terpilih.
 *
 * Identifier (id) adalah kunci — bukan username/nama yang bisa berubah.
 * - Tidak ada entri dengan id yang sama → `{ valid: false }`: pemanggil
 *   WAJIB membuang pilihan dan kembali ke langkah pilih penerima
 *   (fail-closed — jangan kirim ke penerima yang belum tervalidasi).
 * - Ada → `{ valid: true, name }` dengan nama TERBARU dari server
 *   (fullName bila ada, kalau tidak username). Nama tampilan yang basi
 *   diperbarui, bukan dibiarkan.
 */
export function resolveRevalidatedRecipient(
  results: ReadonlyArray<{ id: string; username: string; fullName?: string | null }>,
  selected: { id: string; name: string },
): RevalidatedRecipient {
  const match = results.find((r) => r.id === selected.id)
  if (!match) return { valid: false }
  return { valid: true, name: match.fullName || match.username || selected.name }
}

/**
 * D05 (batch 139): alasan chip nominal cepat dinonaktifkan.
 *
 * Mengembalikan teks alasan bila ADA chip yang melebihi `max` (dan keypad
 * tidak disabled secara keseluruhan), selain itu `null`. `max` di pemanggil
 * = min(limit server, saldo tersedia), jadi pesan "melebihi batas" mencakup
 * kedua sebab tanpa menebak mana yang mengikat.
 */
export function disabledPresetReason(
  presets: ReadonlyArray<number> | undefined,
  max: number | undefined,
  disabled: boolean,
  formatMax: (value: number) => string,
): string | null {
  if (disabled || max == null || !presets || presets.length === 0) return null
  if (!presets.some((p) => p > max)) return null
  return `Nominal cepat di atas ${formatMax(max)} dinonaktifkan — melebihi batas`
}

/**
 * D03 (batch 139): apakah rincian saldo konsisten (tersedia + ditahan = total).
 *
 * Hanya true bila ketiga angka terdefinisi dan penjumlahan PAS — selain itu
 * pemanggil menampilkan label netral ("Jumlah seluruh dana di dompet Anda"),
 * bukan klaim konsistensi yang tidak terbukti.
 */
export function breakdownAddsUp(
  available: number | undefined,
  held: number,
  total: number | undefined,
): boolean {
  return (
    typeof available === "number" &&
    Number.isFinite(available) &&
    typeof total === "number" &&
    Number.isFinite(total) &&
    Number.isFinite(held) &&
    available + held === total
  )
}
