/**
 * Kahade — domain `badges` (lencana profil publik & milik saya).
 */
import { http } from "@/lib/api/client"

export type Badge = {
  id: string
  code: string
  name: string
  description?: string
  iconUrl?: string | null
  category?: string
  earnedAt?: string | null
  progress?: { current: number; target: number }
}

/** Respons daftar — array polos ATAU {data, meta} (spec tanpa schema; UNVERIFIED). */
export type BadgeListResponse =
  | Badge[]
  | { data: Badge[]; meta?: { page: number; limit: number; total: number; totalPages: number } }

export function readBadgeList(body: BadgeListResponse | null | undefined): Badge[] {
  if (!body) return []
  return Array.isArray(body) ? body : (body.data ?? [])
}

/** GET /v1/badges?page&limit — semua lencana yang tersedia (katalog). */
export function listAllBadges(query?: { page?: number; limit?: number }) {
  return http.get<BadgeListResponse>("/v1/badges", { query, auth: "required", retry: 1 })
}

/** GET /v1/badges/my?page&limit — lencana yang sudah diraih user. */
export function listMyBadges(query?: { page?: number; limit?: number }) {
  return http.get<BadgeListResponse>("/v1/badges/my", { query, auth: "required", retry: 1 })
}
