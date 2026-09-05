/**
 * Kahade — domain `search` (pencarian global + saran).
 */
import { http } from "@/lib/api/client"
import type { Order } from "@/lib/api/orders"
import type { UserProfile } from "@/lib/api/users"
import type { WalletTransaction } from "@/lib/api/wallet"

export type GlobalSearchResults = {
  users?: UserProfile[]
  orders?: Array<Order>
  transactions?: WalletTransaction[]
  articles?: Array<{ id: string; slug: string; title: string; snippet?: string }>
  total?: number
}

export function globalSearch(query: { q: string; type?: string; page?: number; limit?: number }) {
  return http.get<GlobalSearchResults>("/v1/search", { query, auth: "required", retry: 1 })
}

export function getSearchSuggestions(query: { q: string }) {
  return http.get<string[]>("/v1/search/suggestions", { query, auth: "required", retry: 1 })
}
