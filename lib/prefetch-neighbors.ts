/**
 * Kahade — prefetch gambar tetangga galeri (FE-068).
 *
 * Masalah: galeri pager (`ShowcaseMediaGallery`, `ImageViewer`) me-render
 * slide tetangga hanya saat dikunjungi (jendela render ±1), jadi swipe
 * maju/mundur selalu diawali spinner. Solusi: saat halaman berubah,
 * prefetch 1 slide ke depan + 1 ke belakang via `Image.prefetch`
 * (expo-image) — unduhan berjalan di latar, cache memory-disk yang sama
 * dipakai <Picture> saat slide tampil.
 *
 * Batasan (sesuai temuan):
 * - Hanya gambar — video TIDAK di-prefetch (stream boros); pemanggil
 *   mengirim `undefined` untuk slide video.
 * - Hormati mode hemat data: tidak ada prefetch sama sekali.
 * - Fire-and-forget: kegagalan diabaikan, tidak melempar.
 */
import { Image } from "expo-image"

export function prefetchNeighborImages(
  /** URL per slide; `undefined` = bukan gambar / jangan prefetch. */
  urls: readonly (string | undefined)[],
  current: number,
  dataSaver: boolean,
): void {
  if (dataSaver) return
  for (const index of [current - 1, current + 1]) {
    const url = urls[index]
    if (url) {
      Image.prefetch(url, "memory-disk").catch(() => undefined)
    }
  }
}
