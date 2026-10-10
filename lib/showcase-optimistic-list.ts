/**
 * UX-11 (audit etalase 2026-10-10): transisi daftar "Etalase Saya" yang
 * OPTIMISTIS — hapus/nonaktifkan/pulihkan langsung terlihat, lalu di-rollback
 * bila server menolak. Helper murni agar layar hanya menyusun urutan
 * (terapkan → request → commit/rollback) dan tiap transisi bisa diuji.
 */

export type RemovedEntry<T> = { next: T[]; removed: T | null; index: number }

/** Keluarkan item `id`; `index` disimpan agar rollback mengembalikannya ke posisi semula. */
export function withoutItem<T extends { id: string }>(list: readonly T[], id: string): RemovedEntry<T> {
  const index = list.findIndex((it) => it.id === id)
  if (index < 0) return { next: [...list], removed: null, index: -1 }
  const next = [...list]
  const [removed] = next.splice(index, 1)
  return { next, removed: removed ?? null, index }
}

/**
 * Sisipkan kembali `item` pada `index` (dijepit ke panjang daftar). Bila id
 * sudah ada (mis. refresh server mendahului rollback), daftar dikembalikan
 * apa adanya — jangan menggandakan baris.
 */
export function withItemAt<T extends { id: string }>(list: readonly T[], item: T, index: number): T[] {
  if (list.some((it) => it.id === item.id)) return [...list]
  const next = [...list]
  const at = Math.max(0, Math.min(index < 0 ? next.length : index, next.length))
  next.splice(at, 0, item)
  return next
}

/** Set `isActive` satu item tanpa menyentuh baris lain (referensi tetap). */
export function withActive<T extends { id: string; isActive?: boolean }>(
  list: readonly T[],
  id: string,
  isActive: boolean,
): T[] {
  return list.map((it) => (it.id === id ? { ...it, isActive } : it))
}
