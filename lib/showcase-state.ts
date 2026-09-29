/** Domain invariants shared by the Etalase screens and regression tests. */
import type { ShowcaseComment, ShowcaseCommentWithReplies } from "@/lib/api/showcase"

export function mergeComments(previous: ShowcaseCommentWithReplies[], incoming: ShowcaseCommentWithReplies[]) {
  const byId = new Map(previous.map((comment) => [comment.id, comment]))
  for (const comment of incoming) {
    const old = byId.get(comment.id)
    const replies = new Map((old?.replies ?? []).map((reply) => [reply.id, reply]))
    for (const reply of comment.replies ?? []) replies.set(reply.id, reply)
    byId.set(comment.id, { ...old, ...comment, replies: [...replies.values()] })
  }
  return [...byId.values()]
}

export function patchComments(
  comments: ShowcaseCommentWithReplies[],
  patch: (comment: ShowcaseComment) => ShowcaseComment | null,
): ShowcaseCommentWithReplies[] {
  let changed = false
  const result = comments.flatMap((root) => {
    const next = patch(root)
    // A deleted root cannot remain actionable. Fetch the canonical thread after delete.
    if (!next) {
      changed = true
      return []
    }
    const replies = root.replies ?? []
    let repliesChanged = false
    const nextReplies = replies.flatMap((reply) => {
      const updated = patch(reply)
      if (!updated) {
        repliesChanged = true
        return []
      }
      if (updated !== reply) repliesChanged = true
      return [updated]
    })
    /**
     * PERF-FIX (state audit): hanya clone bila benar-benar berubah.
     * Dulu `{ ...next, replies }` membuat objek baru untuk SETIAP root dan
     * reply di tiap aksi — like/hapus satu reply = O(n) clone + seluruh
     * subtree komentar re-render karena semua referensi baru. Kini pemanggil
     * mengembalikan referensi identik untuk item tak berubah (pola
     * `c.id === target ? {...c} : c`), sehingga hanya item yang berubah yang
     * mendapat referensi baru.
     */
    if (next === root && !repliesChanged) return [root]
    changed = true
    return [{ ...next, replies: nextReplies }]
  })
  return changed ? result : comments
}

export function validImageOrder(draft: string[] | null, server: string[]): boolean {
  return !!draft && new Set(draft).size === draft.length && draft.length === server.length &&
    server.every((id) => draft.includes(id))
}

export function showcaseIsHidden(item: { isActive?: boolean; visibility?: string | null }) {
  return item.isActive === false || item.visibility === "PRIVATE"
}

/**
 * SH-F-006 (audit 2026-09-27): kontrak retry pembuatan karya — kunci
 * idempotency dipakai ULANG (satu aksi logis → anti-duplikat server), tetapi
 * DTO dibangun ulang dari state form TERKINI setiap percobaan. DTO basi dari
 * percobaan pertama tidak boleh terkirim setelah pengguna mengedit form.
 */
export function resolveCreateAttempt<Dto>(
  previousKey: string | null,
  buildDto: () => Dto,
  newKey: () => string,
): { key: string; dto: Dto } {
  return { key: previousKey ?? newKey(), dto: buildDto() }
}

/**
 * SH-F-005 (audit 2026-09-27): klasifikasi aset gambar untuk validasi batas
 * ukuran. Aset yang ukurannya TIDAK dilaporkan platform (`size <= 0`)
 * dipisahkan eksplisit — pemanggil WAJIB menanganinya (baca ukuran aktual /
 * tolak dengan pesan jelas), JANGAN fail-open ke upload.
 */
export function partitionAssetsBySize<T extends { size: number }>(
  assets: T[],
  maxBytes: number,
): { ok: T[]; tooBig: T[]; unknownSize: T[] } {
  const ok: T[] = []
  const tooBig: T[] = []
  const unknownSize: T[] = []
  for (const asset of assets) {
    if (asset.size <= 0) unknownSize.push(asset)
    else if (asset.size > maxBytes) tooBig.push(asset)
    else ok.push(asset)
  }
  return { ok, tooBig, unknownSize }
}

/** Shared lock: multiple mounted cards must not mutate the same item concurrently. */
const mutations = new Set<string>()
export function acquireShowcaseMutation(key: string): (() => void) | null {
  if (mutations.has(key)) return null
  mutations.add(key)
  return () => { mutations.delete(key) }
}

export function showcaseMutationPending(key: string): boolean { return mutations.has(key) }
