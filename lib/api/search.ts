import { readEntity, invalidResponse, readList } from "@/lib/api/response"
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

export function globalSearch(
  query: { q: string; types?: string; limit?: number },
  signal?: AbortSignal,
) {
  return http
    .get<unknown>("/v1/search", {
      query: { types: "", limit: 20, ...query },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const result = readEntity<GlobalSearchResults>(raw, "results")
      if (![result.users, result.orders, result.transactions, result.articles].some(Array.isArray))
        throw invalidResponse("search.results")
      return result
    })
}

export function getSearchSuggestions(query: { q: string }, signal?: AbortSignal) {
  return http
    .get<string[]>("/v1/search/suggestions", { query, auth: "required", retry: 1, signal })
    .then((raw) => readList<string>(raw, ["suggestions"]))
}
