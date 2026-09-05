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

export function listAllBadges() {
  return http.get<Badge[]>("/v1/badges", { auth: "required", retry: 1 })
}

export function listMyBadges() {
  return http.get<Badge[]>("/v1/badges/my", { auth: "required", retry: 1 })
}
