/**
 * Like komentar (mega-batch FE-IMP-1, item 48) — store LOKAL per sesi.
 *
 * Backend saat ini BELUM punya endpoint like komentar (dan tidak ada kontrak
 * di docs API frontend/current client). Seperti like item sebelum kontraknya
 * ada (lib/showcase-social-prefs.ts), like komentar disimpan sebagai override
 * di memori sesi ini: satu map `commentId → isLiked`, dikombinasikan dengan
 * `likeCount`/`isLiked` bila suatu hari backend mengirimkannya defensif via
 * parseShowcaseComment.
 *
 * TIDAK ada server sync di sini — saat backend menambah kontrak (mis.
 * POST/DELETE /v1/showcase/comments/:id/like), modul inilah yang dipasang
 * sinkronisasinya. Optimistic-only + fail-open: toggle tidak pernah melempar.
 */

import { useMemo, useSyncExternalStore } from "react"

import { getSessionRevision, subscribeSession } from "@/lib/api/session"

export type ShowcaseCommentLikeState = { isLiked: boolean; likeCount: number }

/** Override isLiked per commentId untuk sesi berjalan. */
const overrides = new Map<string, boolean>()
const listeners = new Set<() => void>()
/**
 * PERF-FIX (state audit): versi per-commentId, bukan satu counter global.
 * Satu toggle like dulu menaikkan `storeVersion` global sehingga SEMUA kartu
 * komentar yang ter-mount me-render ulang (render storm O(n) per like).
 * Kini snapshot `useSyncExternalStore` berupa string `${epoch}:${version}` per
 * id — hanya hook untuk commentId yang berubah yang melihat snapshot berbeda
 * dan me-render ulang.
 */
const versions = new Map<string, number>()
/** Naik setiap reset global (logout/login, clear manual) — membatalkan semua snapshot. */
let epoch = 0

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

function getVersionFor(commentId: string): string {
  return `${epoch}:${versions.get(commentId) ?? 0}`
}

function getServerVersionFor() {
  return "0:0"
}

function emit(commentId?: string) {
  if (commentId === undefined) epoch += 1
  else versions.set(commentId, (versions.get(commentId) ?? 0) + 1)
  for (const listener of listeners) listener()
}

// Revisi sesi berubah (logout/login) → reset override agar tidak bocor antar akun.
let sessionRevision = getSessionRevision()
subscribeSession(() => {
  if (sessionRevision === getSessionRevision()) return
  sessionRevision = getSessionRevision()
  overrides.clear()
  versions.clear()
  emit()
})

/**
 * Resolusi state like efektif: override sesi menang atas nilai server (base),
 * delta ±1 diterapkan pada baseCount. Nilai negatif tidak mungkin.
 */
export function resolveShowcaseCommentLike(
  commentId: string,
  base?: { isLiked?: boolean; likeCount?: number },
): ShowcaseCommentLikeState {
  const override = overrides.get(commentId)
  const isLiked = override ?? base?.isLiked ?? false
  const baseCount =
    typeof base?.likeCount === "number" && Number.isFinite(base.likeCount) && base.likeCount >= 0
      ? Math.floor(base.likeCount)
      : 0
  const likeCount =
    baseCount + (override === true ? 1 : override === false && base?.isLiked ? -1 : 0)
  return { isLiked, likeCount: Math.max(0, likeCount) }
}

/** Toggle like komentar (optimistis, lokal sesi ini). */
export function toggleShowcaseCommentLike(
  commentId: string,
  base?: { isLiked?: boolean; likeCount?: number },
): ShowcaseCommentLikeState {
  const current = resolveShowcaseCommentLike(commentId, base)
  overrides.set(commentId, !current.isLiked)
  emit(commentId)
  return resolveShowcaseCommentLike(commentId, base)
}

/** Hook reaktif untuk satu komentar. */
export function useShowcaseCommentLike(
  commentId: string,
  base?: { isLiked?: boolean; likeCount?: number },
): ShowcaseCommentLikeState {
  // Snapshot berupa versi per-commentId (stabil) — object hasil resolve dibangun
  // lewat useMemo agar referentially stable antar render. Hanya commentId yang
  // di-toggle yang melihat snapshot berubah (PERF-FIX: dulu versi global).
  const version = useSyncExternalStore(
    subscribe,
    () => getVersionFor(commentId),
    getServerVersionFor,
  )
  const isLiked = base?.isLiked ?? false
  const likeCount = base?.likeCount ?? 0
  return useMemo(
    () => resolveShowcaseCommentLike(commentId, { isLiked, likeCount }),
    [commentId, isLiked, likeCount, version],
  )
}

/** Reset manual (dipakai test). */
export function clearShowcaseCommentLikes() {
  overrides.clear()
  versions.clear()
  emit()
}
