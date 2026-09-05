/**
 * Kahade — API helper: Transaksi / Order
 *
 * Semua endpoint yang dipakai Tab Transaksi:
 *  - getTransactions  : list order user (support filter status + pagination)
 *  - getTransactionDetail : detail satu order
 */
import { apiClient } from "@/lib/api/client"
import type { Order, OrderStatus } from "@/lib/types"

export interface TransactionFilter {
  status?: OrderStatus | "all"
  page?: number
  limit?: number
}

export interface TransactionListResponse {
  data: Order[]
  meta: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export async function getTransactions(
  filter: TransactionFilter = {},
): Promise<TransactionListResponse> {
  const params = new URLSearchParams()
  if (filter.status && filter.status !== "all") params.set("status", filter.status)
  if (filter.page) params.set("page", String(filter.page))
  if (filter.limit) params.set("limit", String(filter.limit))

  const query = params.toString() ? `?${params.toString()}` : ""
  return apiClient.get<TransactionListResponse>(`/orders${query}`)
}

export async function getTransactionDetail(orderId: string): Promise<Order> {
  return apiClient.get<Order>(`/orders/${orderId}`)
}
