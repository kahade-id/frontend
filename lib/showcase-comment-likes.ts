/**
 * Vote komentar showcase (mega-batch FE-IMP-1, item 48) — PERSISTEN via server.
 *
 * BFE-117 / FAL-009 (fix 2026-10-03): sebelumnya modul ini murni in-memory
 * per sesi ("Backend BELUM punya endpoint like komentar") — angka like/dislike
 * hilang tiap ganti sesi dan tidak pernah terlihat user lain. Kini setiap vote
 * disinkronkan ke POST /v1/showcase/comments/:commentId/like
 * (body { value: 1 | -1 | 0 } → { likes, dislikes, userVote }).
 *
 * Pola: optimistic UI + rollback.
 * - `voteShowcaseComment()` langsung menerapkan hasil optimistis (sinkron,
 *   tanpa menunggu jaringan), lalu menembak server di latar.
 * - Sukses → state diganti nilai otoritatif server.
 * - Gagal → rollback ke nilai sebelum vote (tidak pernah melempar; `onError`
 *   opsional untuk toast/log pemanggil).
 * - Respons basi (vote beruntun) diabaikan via `seq` per commentId.
 *
 * KONTRAK: endpoint TERVERIFIKASI ada di backend-wt-auditfix (2026-10-03):
 * POST /v1/showcase/comments/:commentId/like (lihat docstring
 * `voteShowcaseComment` di lib/api/showcase.ts). Bila server suatu hari
 * 404/belum ada, vote di-rollback otomatis ke nilai semula (fail-closed,
 * bukan angka fiktif).
 */

import { useMemo, useSyncExternalStore } from "react"

import { getSessionRevision, subscribeSession } from "@/lib/api/session"
import {
  voteShowcaseComment as postCommentVote,
  type ShowcaseCommentVoteResult,
  type ShowcaseCommentVoteValue,
} from "@/lib/api/showcase"

/** 1 = suka, -1 = tidak suka, 0 = belum/batal vote. */
export type CommentUserVote = ShowcaseCommentVoteValue

export type ShowcaseCommentVoteState = {
  userVote: CommentUserVote
  likes: number
  dislikes: number
}

/**
 * Base dari server — bentuk baru (likes/dislikes/userVote) didahulukan;
 * field lawas (isLiked/likeCount) tetap didukung sebagai fallback.
 */
export type CommentVoteBase = {
  userVote?: CommentUserVote | null
  likes?: number | null
  dislikes?: number | null
  /** @deprecated fallback bila backend lama belum mengirim userVote. */
  isLiked?: boolean | null
  /** @deprecated fallback bila backend lama belum mengirim likes. */
  likeCount?: number | null
}

type ServerBase = { userVote: CommentUserVote; likes: number; dislikes: number }

type VoteRecord = {
  /** Nilai otoritatif terakhir dari server (respons vote sukses). */
  server: ServerBase | null
  /** Target optimistis yang belum terkonfirmasi; null = tidak ada. */
  pending: CommentUserVote | null
  /** Naik tiap aksi vote — respons dengan seq lebih tua diabaikan. */
  seq: number
}

const records = new Map<string, VoteRecord>()
const listeners = new Set<() => void>()
/**
 * PERF-FIX (state audit): versi per-commentId, bukan satu counter global.
 * Satu vote dulu me-render ulang SEMUA kartu komentar yang ter-mount
 * (render storm O(n)); kini snapshot `useSyncExternalStore` berupa string
 * `${epoch}:${version}` per id — hanya hook untuk commentId yang berubah
 * yang me-render ulang.
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

// Revisi sesi berubah (logout/login) → reset agar tidak bocor antar akun.
let sessionRevision = getSessionRevision()
subscribeSession(() => {
  if (sessionRevision === getSessionRevision()) return
  sessionRevision = getSessionRevision()
  records.clear()
  versions.clear()
  emit()
})

function normCount(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0
    ? Math.floor(raw)
    : undefined
}

/** Normalisasi base campuran (baru + lawas) menjadi ServerBase. */
function normalizeBase(base?: CommentVoteBase): ServerBase {
  const userVote: CommentUserVote =
    base?.userVote === 1 ? 1 : base?.userVote === -1 ? -1 : base?.isLiked === true ? 1 : 0
  return {
    userVote,
    likes: normCount(base?.likes) ?? normCount(base?.likeCount) ?? 0,
    dislikes: normCount(base?.dislikes) ?? 0,
  }
}

function sameBase(a: ServerBase, b: ServerBase): boolean {
  return a.userVote === b.userVote && a.likes === b.likes && a.dislikes === b.dislikes
}

function normalizeResult(res: ShowcaseCommentVoteResult): ServerBase {
  return {
    userVote: res.userVote === 1 ? 1 : res.userVote === -1 ? -1 : 0,
    likes: Math.max(0, Math.floor(res.likes)),
    dislikes: Math.max(0, Math.floor(res.dislikes)),
  }
}

function getRecord(commentId: string): VoteRecord {
  let rec = records.get(commentId)
  if (!rec) {
    rec = { server: null, pending: null, seq: 0 }
    records.set(commentId, rec)
  }
  return rec
}

/**
 * State efektif: base otoritatif (hasil vote sukses > base terbaru dari
 * pemanggil) + delta optimistis bila ada vote yang belum terkonfirmasi.
 */
export function resolveShowcaseCommentVote(
  commentId: string,
  base?: CommentVoteBase,
): ShowcaseCommentVoteState {
  const nb = normalizeBase(base)
  const rec = getRecord(commentId)
  // Base segar dari list (mis. refetch / perangkat lain) menggantikan hasil
  // server simpanan — kecuali ada vote optimistis yang belum selesai.
  if (rec.pending === null && rec.server !== null && !sameBase(rec.server, nb)) {
    rec.server = null
  }
  const auth = rec.server ?? nb
  const userVote = rec.pending ?? auth.userVote
  const likes = Math.max(
    0,
    auth.likes + (userVote === 1 ? 1 : 0) - (auth.userVote === 1 ? 1 : 0),
  )
  const dislikes = Math.max(
    0,
    auth.dislikes + (userVote === -1 ? 1 : 0) - (auth.userVote === -1 ? 1 : 0),
  )
  return { userVote, likes, dislikes }
}

/**
 * Vote komentar (1 = suka, -1 = tidak suka). Toggle: menekan tombol yang
 * sama membatalkan vote (value 0 ke server).
 *
 * Sinkron: mengembalikan state optimistis LANGSUNG. Sinkronisasi server
 * berjalan di latar — sukses mengganti dengan nilai otoritatif, gagal
 * me-rollback ke nilai sebelum vote. Tidak pernah melempar; kegagalan
 * dilaporkan via `onError` bila diisi.
 */
export function voteShowcaseComment(
  commentId: string,
  value: 1 | -1,
  base?: CommentVoteBase,
  onError?: (err: unknown) => void,
): ShowcaseCommentVoteState {
  const rec = getRecord(commentId)
  const current = resolveShowcaseCommentVote(commentId, base)
  const next: CommentUserVote = current.userVote === value ? 0 : value
  rec.seq += 1
  const seq = rec.seq
  rec.pending = next
  emit(commentId)
  const optimistic = resolveShowcaseCommentVote(commentId, base)

  let request: Promise<ShowcaseCommentVoteResult>
  try {
    request = postCommentVote(commentId, next)
  } catch (err) {
    // Gagal sinkron (mis. tanpa sesi) → rollback langsung.
    if (rec.seq === seq) {
      rec.pending = null
      emit(commentId)
    }
    onError?.(err)
    return resolveShowcaseCommentVote(commentId, base)
  }
  void request.then(
    (res) => {
      if (rec.seq !== seq) return // respons basi — vote lebih baru sudah jalan
      rec.server = normalizeResult(res)
      rec.pending = null
      emit(commentId)
    },
    (err: unknown) => {
      if (rec.seq !== seq) return
      // Rollback: kembali ke nilai otoritatif sebelum vote.
      rec.pending = null
      emit(commentId)
      onError?.(err)
    },
  )
  return optimistic
}

/** Hook reaktif untuk satu komentar (tri-state vote). */
export function useShowcaseCommentVote(
  commentId: string,
  base?: CommentVoteBase,
): ShowcaseCommentVoteState {
  // Snapshot berupa versi per-commentId (stabil) — object hasil resolve
  // dibangun lewat useMemo agar referentially stable antar render.
  const version = useSyncExternalStore(
    subscribe,
    () => getVersionFor(commentId),
    getServerVersionFor,
  )
  const userVote = base?.userVote ?? null
  const likes = base?.likes ?? null
  const dislikes = base?.dislikes ?? null
  const isLiked = base?.isLiked ?? null
  const likeCount = base?.likeCount ?? null
  return useMemo(
    () => resolveShowcaseCommentVote(commentId, { userVote, likes, dislikes, isLiked, likeCount }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commentId, userVote, likes, dislikes, isLiked, likeCount, version],
  )
}

// ── Kompatibilitas mundur (boolean like) ──────────────────────────────
// Dipakai test lama + pemanggil yang hanya peduli suka/tidak. Kini ikut
// tersinkron ke server (bukan lagi in-memory-only).

export type ShowcaseCommentLikeState = { isLiked: boolean; likeCount: number }

function toLikeState(v: ShowcaseCommentVoteState): ShowcaseCommentLikeState {
  return { isLiked: v.userVote === 1, likeCount: v.likes }
}

/** @deprecated pakai resolveShowcaseCommentVote — dipertahankan untuk test lama. */
export function resolveShowcaseCommentLike(
  commentId: string,
  base?: CommentVoteBase,
): ShowcaseCommentLikeState {
  return toLikeState(resolveShowcaseCommentVote(commentId, base))
}

/**
 * @deprecated pakai voteShowcaseComment — dipertahankan untuk test lama.
 * Kini tersinkron ke server (optimistis + rollback), bukan in-memory-only.
 */
export function toggleShowcaseCommentLike(
  commentId: string,
  base?: CommentVoteBase,
): ShowcaseCommentLikeState {
  return toLikeState(voteShowcaseComment(commentId, 1, base))
}

/** @deprecated pakai useShowcaseCommentVote — dipertahankan untuk test lama. */
export function useShowcaseCommentLike(
  commentId: string,
  base?: CommentVoteBase,
): ShowcaseCommentLikeState {
  const v = useShowcaseCommentVote(commentId, base)
  return useMemo(() => toLikeState(v), [v])
}

/** Reset manual (dipakai test). */
export function clearShowcaseCommentLikes() {
  records.clear()
  versions.clear()
  emit()
}
