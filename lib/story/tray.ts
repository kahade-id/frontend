/**
 * Kahade — menerapkan overlay lokal ke tray story dari server.
 *
 * Aturan (murni, mudah diuji):
 *   - ring "belum dilihat" = server bilang ada yang belum dilihat DAN penulis
 *     belum ditandai seluruhnya dilihat secara lokal.
 *   - bisu: override lokal menang atas nilai server; penulis yang dibisukan
 *     diurutkan ke bawah (tidak menghilang — tetap bisa dibuka dari tray).
 *   - story yang dihapus secara optimistis mengurangi `storyCount`; bila
 *     habis, entri penulis (bukan pemilik) dibuang dari tray, dan entri
 *     pemilik menjadi null.
 *   - urutan: pemilik paling kiri (diatur UI), lalu belum dilihat, lalu
 *     dilihat; di dalam grup, terbaru dulu. Bisu selalu paling bawah.
 */
import type { StoryTray, StoryTrayEntry } from "@/lib/api/story"
import type { StoryLocalState } from "@/lib/story/local-state"

export function applyTrayOverlay(tray: StoryTray, local: StoryLocalState, ownUserId?: string): StoryTray {
  const applyEntry = (entry: StoryTrayEntry): StoryTrayEntry | null => {
    const hidden = local.hiddenCountByAuthor.get(entry.author.userId) ?? 0
    const storyCount = Math.max(0, entry.storyCount - hidden)
    if (storyCount === 0) return null
    const override = local.muted.get(entry.author.userId)
    return {
      ...entry,
      storyCount,
      muted: override ?? entry.muted,
      hasUnseen: entry.hasUnseen && !local.seenAuthorIds.has(entry.author.userId),
    }
  }

  const own = tray.own ? applyEntry(tray.own) : null
  const others = tray.others
    .map(applyEntry)
    .filter((e): e is StoryTrayEntry => e !== null && e.author.userId !== ownUserId)

  return { own, others: sortTrayOthers(others) }
}

/** Urutan tray untuk penulis selain sendiri. */
export function sortTrayOthers(entries: readonly StoryTrayEntry[]): StoryTrayEntry[] {
  return [...entries].sort((a, b) => {
    if (a.muted !== b.muted) return a.muted ? 1 : -1
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1
    return Date.parse(b.latestAt) - Date.parse(a.latestAt)
  })
}
