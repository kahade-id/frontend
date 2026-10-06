/**
 * Kahade — domain `badges` (lencana profil publik & milik saya).
 */

import { readList } from "@/lib/api/response"

import { http } from "@/lib/api/client"

export type Badge = {
  id: string
  code: string
  name: string
  description?: string
  iconUrl?: string | null
  category?: string
  earnedAt?: string | null
  earned?: boolean
  progress?: { current: number; target: number }
}

/** Respons daftar — array polos ATAU {data, meta} (spec tanpa schema; UNVERIFIED). */
export type BadgeListResponse =
  | Badge[]
  | { data: Badge[]; meta?: { page: number; limit: number; total: number; totalPages: number } }

export function readBadgeList(body: BadgeListResponse | null | undefined): Badge[] {
  return readList<Badge>(body, ["badges"])
}

/** GET /v1/badges?page&limit — semua lencana yang tersedia (katalog). */
export function listAllBadges(query?: { page?: number; limit?: number }, signal?: AbortSignal) {
  return http.get<BadgeListResponse>("/v1/badges", { query, auth: "required", retry: 1, signal })
}

/** GET /v1/badges/my?page&limit — lencana yang sudah diraih user. */
export function listMyBadges(query?: { page?: number; limit?: number }, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/badges/my", { query, auth: "required", retry: 1, signal })
    .then((raw) => {
      // P2: backend mengembalikan item tersarang {id, earnedAt, badge:{...}},
      // bukan Badge flat. Normalisasi ke Badge flat + earnedAt.
      const list = readList<Record<string, unknown>>(raw, ["badges"])
      const flat: Badge[] = list.map((item) => {
        const nested = (item.badge ?? item) as Record<string, unknown>
        return {
          id: typeof nested.id === "string" ? nested.id : typeof item.id === "string" ? item.id : "",
          code: typeof nested.code === "string" ? nested.code : "",
          name: typeof nested.name === "string" ? nested.name : "",
          description: typeof nested.description === "string" ? nested.description : undefined,
          iconUrl:
            typeof nested.iconUrl === "string" ? (nested.iconUrl as string) : null,
          category: typeof nested.category === "string" ? nested.category : undefined,
          earnedAt:
            typeof item.earnedAt === "string"
              ? item.earnedAt
              : typeof nested.earnedAt === "string"
                ? (nested.earnedAt as string)
                : null,
          earned: true,
        } satisfies Badge
      })
      // Pertahankan envelope paginasi bila ada.
      if (raw && typeof raw === "object" && !Array.isArray(raw) && "data" in raw) {
        return { ...(raw as Record<string, unknown>), data: flat }
      }
      return flat
    })
}
