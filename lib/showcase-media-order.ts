/**
 * Kahade — util urutan & sampul media etalase (C09, batch 139).
 *
 * Dipakai form buat (`app/showcase/create.tsx`) dan sheet foto kelola
 * (`app/showcase-management.tsx`). Aturan produk: media PERTAMA = sampul
 * karya — "pilih sampul" = pindahkan media ke indeks 0. Murni & unit-testable.
 */

/**
 * Pindahkan elemen ke posisi sampul (indeks 0), sisanya bergeser kanan.
 * Indeks tak valid / sudah sampul → salinan tanpa perubahan (tidak throw).
 */
export function moveMediaToFront<T>(list: readonly T[], index: number): T[] {
  const next = [...list]
  if (index <= 0 || index >= next.length) return next
  const [item] = next.splice(index, 1)
  next.unshift(item)
  return next
}

/** True bila `index` bisa dijadikan sampul (bukan yang pertama). */
export function canSetAsCover(length: number, index: number): boolean {
  return index > 0 && index < length
}
