/**
 * Kahade — highlight etalase profil (item 20, 2026-09-28).
 *
 * KONTRAK TIM A — endpoint backend untuk highlight BELUM didefinisikan.
 * Modul ini adalah TITIK INTEGRASI: tipe data + signature fungsi sudah
 * ditetapkan di bawah dan dipakai komponen
 * `components/ui/profile-highlights-strip.tsx`; implementasi nyata (path
 * HTTP, dto) hanya mengganti badan fungsi-fungsi ini begitu kontrak tiba.
 * JANGAN menebak path/metode.
 *
 * Bentuk data yang diusulkan ke TIM A (bukan kontrak final):
 *   - GET  /v1/users/{username}/highlights → Highlight[]
 *   - PUT  /v1/users/me/highlights         { highlights: HighlightInput[] }
 *     (mengganti seluruh daftar, urutan = urutan array)
 */
import type { ShowcaseItem } from "@/lib/api/users"

/** Satu highlight: nama + cover + referensi item etalase (boleh >1 item). */
export type ProfileHighlight = {
  id: string
  name: string
  /** URL cover — item pertama atau cover custom. */
  coverImageUrl?: string | null
  /** Id item etalase yang termasuk highlight ini. */
  showcaseItemIds: string[]
  sortOrder: number
  createdAt: string
}

/** Input untuk membuat/memperbarui highlight (PUT bulk). */
export type ProfileHighlightInput = {
  /** Kosong = highlight baru (server memberi id). */
  id?: string
  name: string
  showcaseItemIds: string[]
  /** Cover custom opsional; kosong = pakai cover item pertama. */
  coverImageUrl?: string | null
}

const CONTRACT_PENDING = new Error(
  "Highlight etalase belum tersedia: menunggu kontrak endpoint dari TIM A.",
)

/**
 * Daftar highlight milik username. Saat ini menolak dengan pesan kontrak —
 * komponen strip menyembunyikan dirinya sendiri bila ini gagal.
 */
export function readProfileHighlights(_username: string): Promise<ProfileHighlight[]> {
  return Promise.reject(CONTRACT_PENDING)
}

/**
 * Simpan seluruh daftar highlight (mengganti). Dipakai editor "Kelola
 * highlight" — saat kontrak tiba, ganti dengan PUT nyata lalu panggil
 * `readProfileHighlights` ulang.
 */
export function saveProfileHighlights(_input: ProfileHighlightInput[]): Promise<ProfileHighlight[]> {
  return Promise.reject(CONTRACT_PENDING)
}

/**
 * Cover highlight dari item etalase: coverImageUrl → images[0] → imageUrl.
 * Murni tampilan — dipakai strip & editor.
 */
export function highlightCoverOf(item: ShowcaseItem | undefined): string | null {
  if (!item) return null
  return (
    item.coverImageUrl ??
    item.images?.[0]?.imageUrl ??
    item.imageUrl ??
    null
  )
}
