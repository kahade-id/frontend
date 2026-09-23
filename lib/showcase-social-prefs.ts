/** Account-scoped Etalase preferences. Public bookmark IDs persist locally (max 25),
 * clear at logout, and hydrate only for the matching owner. Likes are session-only. */
import { useCallback, useMemo, useSyncExternalStore } from "react"
import { getSessionRevision, subscribeSession } from "@/lib/api/session"
import { getSecureItem, setSecureItem, deleteSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"
import { invalidateQueryPrefix } from "@/lib/query-cache"

export type ShowcaseLikeState = { isLiked: boolean; likeCount: number }

type SocialPrefs = {
  /** id item yang disimpan pengguna (bookmark). */
  saved: Record<string, true>
  /** state suka terakhir yang DIKETAHUI (nilai final server). */
  likes: Record<string, ShowcaseLikeState>
  /** Naik setiap ada mutasi "etalase saya" (buat/ubah/hapus). */
  feedDirtyVersion: number
}

const EMPTY: SocialPrefs = { saved: {}, likes: {}, feedDirtyVersion: 0 }

let state: SocialPrefs = EMPTY
const listeners = new Set<() => void>()

function emit(next: Partial<SocialPrefs>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

// Snapshot SELECTOR primitif per item (bukan objek state utuh): boolean /
// entry per id identitasnya stabil antar emit yang tidak menyentuh item tsb,
// jadi kartu lain tidak ikut re-render saat satu kartu berubah.

// ------------------------------------------------------------------
// Simpan (bookmark) — bersifat lokal sampai kontrak koleksi ada.
// ------------------------------------------------------------------

export function toggleShowcaseSaved(id: string) {
  const saved = { ...state.saved }
  if (saved[id]) delete saved[id]
  else {
    if (Object.keys(saved).length >= 25) throw new Error("Maksimal 25 karya tersimpan di perangkat ini. Hapus salah satu untuk menyimpan karya lain.")
    saved[id] = true
  }
  emit({ saved })
  persistBookmarks()
}

export function isShowcaseSaved(id: string): boolean {
  return state.saved[id] === true
}

/** `saved` untuk SATU item; stabil: hanya re-render saat nilai item ini toggle. */
export function useShowcaseSaved(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => state.saved[id] === true,
    () => false,
  )
}

// ------------------------------------------------------------------
// Suka — override nilai feed/detail dengan nilai final hasil interaksi.
// ------------------------------------------------------------------

export function setShowcaseLikeState(id: string, like: ShowcaseLikeState) {
  emit({ likes: { ...state.likes, [id]: like } })
}

/** Override suka untuk satu item (undefined = belum pernah berinteraksi sesi ini). */
export function useShowcaseLikeOverride(id: string): ShowcaseLikeState | undefined {
  return useSyncExternalStore(
    subscribe,
    () => state.likes[id],
    () => undefined,
  )
}

/** Pembacaan non-reaktif (handler yang tidak butuh re-render). */
export function getShowcaseLikeOverride(id: string): ShowcaseLikeState | undefined {
  return state.likes[id]
}

// ------------------------------------------------------------------
// Spanduk "feed harus disegarkan" (mutasi dari layar manajemen).
// ------------------------------------------------------------------

export function markShowcaseFeedDirty() {
  invalidateQueryPrefix("showcase-")
  invalidateQueryPrefix("public-showcase:")
  invalidateQueryPrefix("my-showcase")
  emit({ feedDirtyVersion: state.feedDirtyVersion + 1 })
}

/** Versi dirty saat ini — bandingkan dengan snapshot yang disimpan pemanggil. */
export function showcaseFeedDirtyVersion(): number {
  return state.feedDirtyVersion
}

/** Hook kecil untuk handler aksi sosial yang digerbang sesi (audit A-05). */
export function useRequireSessionAction(hasSession: boolean) {
  return useCallback(
    (action: () => void, onGuest: () => void) => {
      if (!hasSession) onGuest()
      else action()
    },
    [hasSession],
  )
}

/** Account state is never inherited by a subsequent login in the same process. */
let sessionRevision = getSessionRevision()
subscribeSession(() => {
  if (sessionRevision === getSessionRevision()) return
  sessionRevision = getSessionRevision()
  bookmarkOwner = null
  hydration = null
  bookmarkQueue = bookmarkQueue.then(() => deleteSecureItem(SecureKeys.showcaseBookmarks)).catch(() => {
    logWarn("showcase:bookmark-clear", new Error("Local bookmark cleanup failed"))
  })
  emit({ saved: {}, likes: {}, feedDirtyVersion: state.feedDirtyVersion + 1 })
})

export function clearShowcaseLikeOverride(id: string) {
  const likes = { ...state.likes }
  delete likes[id]
  emit({ likes })
}

export function useShowcaseDirtyVersion() {
  return useSyncExternalStore(subscribe, showcaseFeedDirtyVersion, () => 0)
}

let bookmarkOwner: string | null = null
let hydration: { owner: string; revision: number; promise: Promise<void> } | null = null
let bookmarkQueue: Promise<void> = Promise.resolve()

export function loadShowcaseBookmarks(owner: string): Promise<void> {
  const revision = getSessionRevision()
  if (hydration?.owner === owner && hydration.revision === revision) return hydration.promise
  const promise = (async () => {
    await bookmarkQueue
    const raw = await getSecureItem(SecureKeys.showcaseBookmarks)
    if (revision !== getSessionRevision()) return
    let ids: unknown = []
    try {
      const record = raw ? JSON.parse(raw) : null
      if (record?.owner === owner) ids = record.ids
    } catch { /* Invalid local data is replaced, never trusted as an API response. */ }
    bookmarkOwner = owner
    const safe = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string" && id.length <= 64).slice(0, 25) : []
    emit({ saved: Object.fromEntries(safe.map((id) => [id, true as const])) })
  })()
  hydration = { owner, revision, promise }
  promise.catch(() => { if (hydration?.promise === promise) hydration = null })
  return promise
}
function persistBookmarks() {
  if (!bookmarkOwner) return
  const revision = getSessionRevision()
  const payload = JSON.stringify({ owner: bookmarkOwner, ids: Object.keys(state.saved) })
  bookmarkQueue = bookmarkQueue.then(async () => {
    if (revision === getSessionRevision()) await setSecureItem(SecureKeys.showcaseBookmarks, payload)
  }).catch(() => logWarn("showcase:bookmark-save", new Error("Local bookmark persistence failed")))
}
export function useShowcaseSavedIds(): string[] {
  const saved = useSyncExternalStore(subscribe, () => state.saved, () => EMPTY.saved)
  return useMemo(() => Object.keys(saved), [saved])
}
