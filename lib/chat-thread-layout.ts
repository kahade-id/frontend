/**
 * Kahade — geometri thread untuk `getItemLayout` (audit chat D10/F15, MURNI).
 *
 * Tinggi baris chat variabel (teks, foto, kartu), jadi `getItemLayout` hanya
 * dipakai FlatList sebagai PERKIRAAN untuk baris yang belum terukur — baris
 * yang sudah terukur memakai frame asli dari `onLayout`. Dua hal membuat
 * perkiraan lama melenceng:
 *
 *   1. Baris yang belum terukur dianggap 76 px apa pun isinya. Rata-rata baris
 *      yang SUDAH terukur jauh lebih jujur (thread bergambar ≫ thread teks).
 *   2. Offset dihitung dengan menjumlah tinggi semua baris di atasnya TIAP
 *      panggilan — O(n) per baris × ratusan panggilan per render = O(n²).
 *      Di sini offset dibangun SEKALI per (daftar baris, versi cache tinggi).
 *
 * `headerHeight` = tinggi ListHeaderComponent (tombol "Muat pesan sebelumnya"):
 * offset frame asli sudah memasukkannya, perkiraan harus ikut — kalau tidak,
 * lompatan kasar mendarat setinggi header di atas sasaran.
 */

/** Perkiraan tinggi satu baris sebelum ada yang terukur. */
export const ROW_HEIGHT_FALLBACK = 76
/** Batas wajar perkiraan: satu foto raksasa tidak boleh menyeret rata-rata. */
const ESTIMATE_MIN = 40
const ESTIMATE_MAX = 320

/** Rata-rata tinggi baris terukur (dijepit); `fallback` bila belum ada satu pun. */
export function estimateRowHeight(
  heights: ReadonlyMap<string, number>,
  fallback: number = ROW_HEIGHT_FALLBACK,
): number {
  if (heights.size === 0) return fallback
  let sum = 0
  for (const h of heights.values()) sum += h
  const avg = sum / heights.size
  return Math.min(ESTIMATE_MAX, Math.max(ESTIMATE_MIN, avg))
}

export type RowGeometry = {
  /** `offsets[i]` = jarak dari awal konten (termasuk header) ke baris i. */
  offsets: number[]
  /** `lengths[i]` = tinggi baris i (terukur, atau perkiraan). */
  lengths: number[]
}

export function buildRowGeometry(
  rowKeys: readonly string[],
  heights: ReadonlyMap<string, number>,
  headerHeight = 0,
  fallback: number = ROW_HEIGHT_FALLBACK,
): RowGeometry {
  const estimate = estimateRowHeight(heights, fallback)
  const offsets = new Array<number>(rowKeys.length)
  const lengths = new Array<number>(rowKeys.length)
  let cursor = headerHeight
  for (let i = 0; i < rowKeys.length; i++) {
    const length = heights.get(rowKeys[i] ?? "") ?? estimate
    offsets[i] = cursor
    lengths[i] = length
    cursor += length
  }
  return { offsets, lengths }
}
