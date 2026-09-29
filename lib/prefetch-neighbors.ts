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

/**
 * PERF-FIX (2026-09-30): batas prefetch aktif bersamaan — dipanggil dari 3+
 * tempat (image-viewer, showcase-media-gallery, spin360-viewer); swipe cepat
 * di dua galeri bisa menumpuk prefetch tanpa throttle → spike bandwidth.
 */
const MAX_ACTIVE_PREFETCH = 4
let activePrefetch = 0
const prefetchQueue: Array<() => void> = []

function pumpQueue(): void {
  while (activePrefetch < MAX_ACTIVE_PREFETCH && prefetchQueue.length > 0) {
    const run = prefetchQueue.shift()
    if (!run) break
    activePrefetch += 1
    run()
  }
}

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
      // Fire-and-forget via antrean terbatas; kegagalan diabaikan.
      prefetchQueue.push(() => {
        Image.prefetch(url, "memory-disk")
          .catch(() => undefined)
          .finally(() => {
            activePrefetch = Math.max(0, activePrefetch - 1)
            pumpQueue()
          })
      })
    }
  }
  pumpQueue()
}
