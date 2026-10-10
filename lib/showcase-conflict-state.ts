/**
 * Kahade — state server dari respons 409 suka/simpan (RK-01, audit etalase
 * 2026-10-10).
 *
 * Backend kini menyertakan `errors.data` pada SHOWCASE_ALREADY_LIKED /
 * SHOWCASE_NOT_LIKED (`{ liked, likeCount }`) dan SHOWCASE_ALREADY_SAVED /
 * SHOWCASE_NOT_SAVED (`{ saved, saveCount }`). Dengan itu balapan dua tap
 * tidak perlu GET detail tambahan — state final langsung dari server.
 * Tanpa data (backend lama) → null, pemanggil memakai jalur lama.
 */
import { isApiError } from "@/lib/api/errors"

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null
}

export function likeStateFromConflict(err: unknown): { isLiked: boolean; likeCount: number } | null {
  if (!isApiError(err) || !err.data) return null
  const likeCount = count(err.data.likeCount)
  if (typeof err.data.liked !== "boolean" || likeCount === null) return null
  return { isLiked: err.data.liked, likeCount }
}

export function saveStateFromConflict(err: unknown): { saved: boolean; saveCount: number } | null {
  if (!isApiError(err) || !err.data) return null
  const saveCount = count(err.data.saveCount)
  if (typeof err.data.saved !== "boolean" || saveCount === null) return null
  return { saved: err.data.saved, saveCount }
}
