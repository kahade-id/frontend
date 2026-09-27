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
 * Counter versi store — dipakai sebagai snapshot `useSyncExternalStore`
 * (angka stabil secara referensi), BUKAN hasil `resolve…` yang membangun
 * object baru tiap panggilan dan bisa memicu loop render.
 */
let storeVersion = 0

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

function getVersion() {
  return storeVersion
}

function getServerVersion() {
  return 0
}

function emit() {
  storeVersion += 1
  for (const listener of listeners) listener()
}

// Revisi sesi berubah (logout/login) → reset override agar tidak bocor antar akun.
let sessionRevision = getSessionRevision()
subscribeSession(() => {
  if (sessionRevision === getSessionRevision()) return
  sessionRevision = getSessionRevision()
  overrides.clear()
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
  emit()
  return resolveShowcaseCommentLike(commentId, base)
}

/** Hook reaktif untuk satu komentar. */
export function useShowcaseCommentLike(
  commentId: string,
  base?: { isLiked?: boolean; likeCount?: number },
): ShowcaseCommentLikeState {
  // Snapshot berupa angka versi (stabil) — object hasil resolve dibangun
  // lewat useMemo agar referentially stable antar render.
  const version = useSyncExternalStore(subscribe, getVersion, getServerVersion)
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
  emit()
}
