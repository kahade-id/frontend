import { readEntity, invalidResponse, readList } from "@/lib/api/response"
/**
 * Kahade — domain `search` (pencarian global + saran).
 */
import { http } from "@/lib/api/client"
import { normalizeOrder, type Order } from "@/lib/api/orders"
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
      // Production accepts only users, orders, and transactions. An empty
      // `types` query is rejected with SEARCH_INVALID_TYPES.
      query: { types: "users,orders,transactions", limit: 20, ...query },
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const result = readEntity<Record<string, unknown>>(raw, "results")
      if (![result.users, result.orders, result.transactions, result.articles].some(Array.isArray))
        throw invalidResponse("search.results")
      return {
        ...result,
        users: (Array.isArray(result.users) ? result.users : []).map((item) => {
          const user = item as Record<string, unknown>
          return {
            ...user,
            id: String(user.id ?? user.userId ?? ""),
            verified: user.verified ?? user.isKycVerified,
          }
        }),
        orders: (Array.isArray(result.orders) ? result.orders : []).map((item) =>
          normalizeOrder(item as Order & Record<string, unknown>),
        ),
        transactions: (Array.isArray(result.transactions) ? result.transactions : []).map((item) => {
          const transaction = item as Record<string, unknown>
          return {
            ...transaction,
            id: String(transaction.id ?? transaction.txId ?? ""),
            referenceId: transaction.referenceId ?? transaction.reference_id,
          } as WalletTransaction
        }),
      } as GlobalSearchResults
    })
}

export function getSearchSuggestions(query: { q: string }, signal?: AbortSignal) {
  return http
    .get<string[]>("/v1/search/suggestions", { query, auth: "required", retry: 1, signal })
    .then((raw) => readList<string>(raw, ["suggestions"]))
}
