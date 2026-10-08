/**
 * Kahade — state lokal story untuk pembaruan OPTIMISTIS + rollback.
 *
 * Pola: setiap aksi (tandai dilihat, reaksi, bisukan, hapus, unggah) langsung
 * tercermin di layar lewat overlay di sini, LALU request dikirim. Bila request
 * gagal, `rollback` dari aksi itu dijalankan dan overlay dikembalikan. Overlay
 * TIDAK pernah menggantikan data server secara permanen: setelah refresh tray,
 * server adalah sumber kebenaran; overlay hanya menutupi jendela antara aksi
 * dan konfirmasi server.
 *
 * Implementasi memakai snapshot immutable + `useSyncExternalStore` (lihat
 * `useStoryLocal`) agar React merender ulang hanya saat snapshot berubah.
 */
import { useSyncExternalStore } from "react"

import type { StoryKind, StoryReaction } from "@/lib/api/story"

export type PendingStory = {
  localId: string
  kind: StoryKind
  /** URI lokal foto (kind = image). */
  mediaUri: string | null
  text: string | null
  backgroundColor: string | null
  createdAt: number
  status: "uploading" | "failed"
}

export type StoryLocalState = {
  /** Story (id) yang sudah dilihat viewer ini secara optimistis. */
  seenStoryIds: ReadonlySet<string>
  /** Penulis yang seluruh story-nya sudah dilihat (ring abu-abu di tray). */
  seenAuthorIds: ReadonlySet<string>
  reactions: ReadonlyMap<string, StoryReaction | null>
  /** Status bisu optimistis per penulis. */
  muted: ReadonlyMap<string, boolean>
  /** Story yang dihapus secara optimistis (disembunyikan dari semua daftar). */
  hiddenStoryIds: ReadonlySet<string>
  /** Jumlah story yang disembunyikan per penulis (untuk tray). */
  hiddenCountByAuthor: ReadonlyMap<string, number>
  /** Story sendiri yang sedang diunggah. */
  pending: readonly PendingStory[]
  /**
   * Naik setiap kali ada mutasi story yang SUKSES di server (buat/hapus/sorot).
   * Tray & viewer memuat ulang saat nilai ini berubah, meski layar pemicunya
   * tidak berpindah fokus (mis. pengguna tetap di tab Pesan).
   */
  revision: number
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>()

const INITIAL: StoryLocalState = {
  seenStoryIds: EMPTY_SET,
  seenAuthorIds: EMPTY_SET,
  reactions: new Map<string, StoryReaction | null>(),
  muted: new Map<string, boolean>(),
  hiddenStoryIds: EMPTY_SET,
  hiddenCountByAuthor: new Map<string, number>(),
  pending: [],
  revision: 0,
}

let state: StoryLocalState = INITIAL
const listeners = new Set<() => void>()

function commit(next: StoryLocalState): void {
  if (next === state) return
  state = next
  for (const l of listeners) l()
}

export function getStoryLocalState(): StoryLocalState {
  return state
}

export function subscribeStoryLocal(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Hook React: snapshot overlay lokal (render ulang hanya saat berubah). */
export function useStoryLocal(): StoryLocalState {
  return useSyncExternalStore(subscribeStoryLocal, getStoryLocalState, getStoryLocalState)
}

/** Hanya untuk test & keluar sesi. */
export function resetStoryLocalState(): void {
  state = INITIAL
  for (const l of listeners) l()
}

function withSet(set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> {
  if (set.has(id) === on) return set
  const next = new Set(set)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

function withMap<V>(map: ReadonlyMap<string, V>, key: string, value: V | undefined): ReadonlyMap<string, V> {
  const next = new Map(map)
  if (value === undefined) next.delete(key)
  else next.set(key, value)
  return next
}

// ---- Mutasi overlay (masing-masing mengembalikan fungsi rollback) ----

export function markStorySeenLocal(storyId: string): () => void {
  const wasSeen = state.seenStoryIds.has(storyId)
  commit({ ...state, seenStoryIds: withSet(state.seenStoryIds, storyId, true) })
  return () => {
    if (!wasSeen) commit({ ...state, seenStoryIds: withSet(state.seenStoryIds, storyId, false) })
  }
}

export function markAuthorSeenLocal(authorId: string, seen: boolean): () => void {
  const was = state.seenAuthorIds.has(authorId)
  commit({ ...state, seenAuthorIds: withSet(state.seenAuthorIds, authorId, seen) })
  return () => {
    if (was !== seen) commit({ ...state, seenAuthorIds: withSet(state.seenAuthorIds, authorId, was) })
  }
}

export function setReactionLocal(storyId: string, emoji: StoryReaction | null): () => void {
  const had = state.reactions.has(storyId)
  const prev = state.reactions.get(storyId) ?? null
  commit({ ...state, reactions: withMap(state.reactions, storyId, emoji) })
  return () => {
    commit({ ...state, reactions: withMap(state.reactions, storyId, had ? prev : undefined) })
  }
}

export function setMutedLocal(authorId: string, muted: boolean): () => void {
  const had = state.muted.has(authorId)
  const prev = state.muted.get(authorId)
  commit({ ...state, muted: withMap(state.muted, authorId, muted) })
  return () => {
    commit({ ...state, muted: withMap(state.muted, authorId, had ? prev : undefined) })
  }
}

export function hideStoryLocal(storyId: string, authorId: string): () => void {
  if (state.hiddenStoryIds.has(storyId)) return () => undefined
  const count = state.hiddenCountByAuthor.get(authorId) ?? 0
  commit({
    ...state,
    hiddenStoryIds: withSet(state.hiddenStoryIds, storyId, true),
    hiddenCountByAuthor: withMap(state.hiddenCountByAuthor, authorId, count + 1),
  })
  return () => {
    const cur = state.hiddenCountByAuthor.get(authorId) ?? 0
    commit({
      ...state,
      hiddenStoryIds: withSet(state.hiddenStoryIds, storyId, false),
      hiddenCountByAuthor: withMap(state.hiddenCountByAuthor, authorId, cur > 1 ? cur - 1 : undefined),
    })
  }
}

export function addPendingStoryLocal(item: PendingStory): () => void {
  commit({ ...state, pending: [...state.pending, item] })
  return () => {
    commit({ ...state, pending: state.pending.filter((p) => p.localId !== item.localId) })
  }
}

export function setPendingStatusLocal(localId: string, status: PendingStory["status"]): void {
  commit({
    ...state,
    pending: state.pending.map((p) => (p.localId === localId ? { ...p, status } : p)),
  })
}

/** Tandai ada perubahan story yang sudah dikonfirmasi server. */
export function bumpStoryRevision(): void {
  commit({ ...state, revision: state.revision + 1 })
}

export function removePendingStoryLocal(localId: string): void {
  commit({ ...state, pending: state.pending.filter((p) => p.localId !== localId) })
}

/**
 * Jalankan aksi optimistis: `apply` mengubah overlay dan mengembalikan rollback;
 * bila `request` gagal, rollback dijalankan dan galat dikembalikan ke pemanggil
 * (untuk toast). Tidak pernah mencoba ulang mutasi.
 */
export async function runOptimistic<T>(
  apply: () => () => void,
  request: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  const rollback = apply()
  try {
    const value = await request()
    return { ok: true, value }
  } catch (error) {
    rollback()
    return { ok: false, error }
  }
}
