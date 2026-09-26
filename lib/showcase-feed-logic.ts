/**
 * Kahade — logika murni feed etalase (ekstraksi dari showcase-feed-tab.tsx)
 * supaya invariant paginasi keyset bisa diuji unit (audit K-01/A-01).
 *
 * Invariant yang DIJAGA di sini:
 *   1. Kursor/flag khusus LANJUT HALAMAN. Setiap muat-awal/refresh WAJIB
 *      memanggil `resetKindCursor` — kursor keyset hanya valid berurutan
 *      dalam himpunan hasil yang sama (tab × kata kunci × kategori).
 *      Pelanggaran = bug A-01 (refresh melompat ke halaman N+1 dan menghapus
 *      halaman sebelumnya dari layar).
 *   2. `interleave` (tab "Untuk Anda") dedupe per id dan mendahulukan sisi
 *      populer (bobot engagement).
 *   3. `mergeById` (lanjut halaman) mempertahankan posisi item lama.
 */
import type { ShowcaseSocialItem } from "@/lib/api/showcase"

/** Kursor per sisi untuk SATU tab feed. */
export type KindCursors = { latest: string | null; popular: string | null }
/** Flag hasMore per sisi untuk SATU tab feed. */
export type KindMoreFlags = { latest: boolean; popular: boolean }

/** State paginasi satu tab — kursor + hasMore selalu berpasangan. */
export type FeedPageState = { cursors: KindCursors; hasMore: KindMoreFlags }

export function emptyKindCursors(): KindCursors {
  return { latest: null, popular: null }
}

export function emptyKindMoreFlags(): KindMoreFlags {
  return { latest: false, popular: false }
}

export function emptyFeedPageState(): FeedPageState {
  return { cursors: emptyKindCursors(), hasMore: emptyKindMoreFlags() }
}

/**
 * A-01: WAJIB dipanggil sebelum fetch mode "initial"/"refresh". Mengubah
 * objek IN-PLACE (state disimpan di ref) dan mengembalikannya.
 */
export function resetFeedPageState(state: FeedPageState): FeedPageState {
  state.cursors.latest = null
  state.cursors.popular = null
  state.hasMore.latest = false
  state.hasMore.popular = false
  return state
}

/** Filter query yang ikut membentuk himpunan hasil (tab × search × kategori × lokasi). */
export type ShowcaseFeedFilter = {
  search?: string
  category?: string
  /** Filter lokasi free-text (users.address milik owner, case-insensitive). */
  location?: string
}

/**
 * Apakah dua filter identik — bila tidak, kursor dari himpunan lama TIDAK
 * valid untuk himpunan baru dan state harus di-reset (perluas A-01: dulu
 * kursor hanya per-tab, jadi kata kunci baru memakai kursor lama).
 */
export function sameFeedFilter(a: ShowcaseFeedFilter, b: ShowcaseFeedFilter): boolean {
  // G-20 (audit 2026-09-23): identitas cache membanding kategori tanpa
  // membedakan huruf besar/kecil — filter "Kriya"/"kriya" = kueri yang sama.
  // Lokasi ikut dibanding case-insensitive: backend memakai ILIKE, jadi
  // "jakarta"/"Jakarta" adalah himpunan hasil yang sama.
  return (
    (a.search ?? "") === (b.search ?? "") &&
    (a.category ?? "").toLocaleLowerCase() === (b.category ?? "").toLocaleLowerCase() &&
    (a.location ?? "").toLocaleLowerCase() === (b.location ?? "").toLocaleLowerCase()
  )
}

/** Selang-seling dua halaman (popular dulu = bobot engagement), dedupe id. */
export function interleave(
  a: ShowcaseSocialItem[],
  b: ShowcaseSocialItem[],
): ShowcaseSocialItem[] {
  const out: ShowcaseSocialItem[] = []
  const seen = new Set<string>()
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    for (const item of [b[i], a[i]]) {
      if (item && !seen.has(item.id)) {
        seen.add(item.id)
        out.push(item)
      }
    }
  }
  return out
}

/** Gabung halaman lanjutan tanpa duplikat (kursor feed bisa tumpang-tindih). */
export function mergeById(
  prev: ShowcaseSocialItem[],
  incoming: ShowcaseSocialItem[],
): ShowcaseSocialItem[] {
  const merged = new Map(prev.map((item) => [item.id, item]))
  for (const item of incoming) merged.set(item.id, item)
  return [...merged.values()]
}
