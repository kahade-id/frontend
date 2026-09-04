/**
 * Kahade — domain `orders` (31 endpoint, tag "orders" di kahade-api-mobile.json).
 *
 * Semua endpoint ini `security: access-token` → `auth: "required"`.
 *
 * Tipe REQUEST (body + query + path) persis dari spec:
 *   - Body: lib/api/types.ts (generated).
 *   - Query `GET /v1/orders`: page?, limit?, status?, role?[BUYER|SELLER|ALL], search?
 *   - Query paginasi WAJIB (`page!`, `limit!`) di: /extensions, /history, /links/my.
 *
 * Tipe RESPONSE: tidak ada di spec — ditulis minimal dan ditandai UNVERIFIED.
 * Enum status order/role/tipe diturunkan dari DTO request (CreateOrderDto,
 * CancelOrderDto) supaya satu sumber; status lifecycle (`OrderStatus`)
 * adalah asumsi umum escrow dan HARUS dicocokkan dengan backend.
 *
 * Keputusan non-obvious:
 *   - `getReceiptHtml()` memakai `responseType: "text"` — endpoint
 *     mengembalikan HTML siap cetak, bukan JSON.
 *   - Tidak ada `retry` di POST/PUT: pay/complete/cancel tidak idempoten.
 *     GET list/detail memakai `retry: 1` untuk toleransi jaringan seluler.
 */
import { http, seg } from "@/lib/api/client"
import type {
  CalculateFeeDto,
  CancelOrderDto,
  ConfirmDeliveryDto,
  ConfirmOrderDto,
  CreateOrderDto,
  CreateOrderLinkDto,
  PayOrderDto,
  RejectDeliveryDto,
  RequestExtensionDto,
  RespondExtensionDto,
  SubmitDeliveryProofDto,
  SubmitDisputeDto,
  UpdateShippingDto,
  ValidateCounterpartDto,
} from "@/lib/api/types"

// ------------------------------------------------------------------
// Enum turunan dari DTO (satu sumber kebenaran: spec)
// ------------------------------------------------------------------

export type OrderRole = CreateOrderDto["role"]
export type OrderType = CreateOrderDto["orderType"]
export type FeeResponsibility = CreateOrderDto["feeResponsibility"]
export type CancelReason = CancelOrderDto["reason"]

/** Query `GET /v1/orders` — persis parameter di spec. */
export type ListOrdersQuery = {
  page?: number
  limit?: number
  status?: string
  role?: "BUYER" | "SELLER" | "ALL"
  search?: string
}

/** Query paginasi wajib (`page!`, `limit!`). */
export type PageQuery = { page: number; limit: number }

// ------------------------------------------------------------------
// Tipe response — UNVERIFIED
// ------------------------------------------------------------------

/** Lifecycle escrow — cocokkan dengan backend sebelum dipakai untuk logika. */
export type OrderStatus =
  | "PENDING_CONFIRMATION"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "IN_PROGRESS"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "REFUNDED"
  | (string & {}) // toleransi nilai baru dari backend tanpa runtime error

export type Paginated<T> = {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export type OrderParty = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
}

export type Order = {
  id: string
  title: string
  description: string
  orderType: OrderType
  status: OrderStatus
  orderValue: number
  feeResponsibility: FeeResponsibility
  deliveryDeadlineDays: number
  deliveryDeadlineAt?: string | null
  buyer: OrderParty
  seller: OrderParty
  /** Peran user yang sedang login pada order ini */
  myRole?: OrderRole
  fee?: FeeBreakdown
  trackingNumber?: string | null
  courierName?: string | null
  createdAt: string
  updatedAt?: string
}

export type FeeBreakdown = {
  orderValue: number
  platformFee: number
  buyerPays: number
  sellerReceives: number
  discount?: number
  voucherCode?: string | null
}

export type CounterpartValidation = {
  valid: boolean
  user?: OrderParty & { kycVerified?: boolean; trustScore?: number }
  reason?: string
}

export type OrderSummary = Record<string, number> & { total?: number }

export type AverageDurations = Record<string, number>

export type PaymentStatus = {
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED" | (string & {})
  paidAt?: string | null
  method?: string | null
}

export type QrisPayment = {
  qrString: string
  qrUrl?: string
  expiresAt: string
  amount: number
  paymentTxId?: string
}

export type OrderHistoryEntry = {
  id: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actorId?: string | null
  note?: string | null
  createdAt: string
}

export type OrderExtension = {
  id: string
  extensionDays: number
  reason: string
  status: "PENDING" | "APPROVED" | "REJECTED" | (string & {})
  note?: string | null
  createdAt: string
}

export type DeliveryProof = {
  id: string
  description: string
  fileUrls: string[]
  linkUrls: string[]
  status: "SUBMITTED" | "CONFIRMED" | "REJECTED" | (string & {})
  note?: string | null
  createdAt: string
}

export type OrderLink = {
  token: string
  url?: string
  role: OrderRole
  title: string
  description: string
  orderType: OrderType
  orderValue: number
  deliveryDeadlineDays: number
  feeResponsibility: FeeResponsibility
  counterpartUsername?: string | null
  status: "ACTIVE" | "ACCEPTED" | "CANCELLED" | "EXPIRED" | (string & {})
  creator?: OrderParty
  orderId?: string | null
  expiresAt?: string | null
  createdAt: string
}

export type Invoice = {
  invoiceNumber: string
  order: Order
  issuedAt: string
  items: Array<{ label: string; amount: number }>
  total: number
}

export type Dispute = {
  id: string
  orderId: string
  status: string
  claim: string
  createdAt: string
}

export type MessageResult = { message: string }

// ------------------------------------------------------------------
// Pra-order
// ------------------------------------------------------------------

export function calculateFee(dto: CalculateFeeDto) {
  return http.post<FeeBreakdown, CalculateFeeDto>("/v1/orders/calculate-fee", dto, { auth: "required" })
}

export function validateCounterpart(dto: ValidateCounterpartDto) {
  return http.post<CounterpartValidation, ValidateCounterpartDto>("/v1/orders/validate-counterpart", dto, {
    auth: "required",
  })
}

// ------------------------------------------------------------------
// CRUD & lifecycle
// ------------------------------------------------------------------

export function createOrder(dto: CreateOrderDto) {
  return http.post<Order, CreateOrderDto>("/v1/orders", dto, { auth: "required" })
}

export function listOrders(query: ListOrdersQuery = {}) {
  return http.get<Paginated<Order>>("/v1/orders", { query, auth: "required", retry: 1 })
}

export function getOrder(orderId: string) {
  return http.get<Order>(`/v1/orders/${seg(orderId)}`, { auth: "required", retry: 1 })
}

export function getOrdersSummary() {
  return http.get<OrderSummary>("/v1/orders/summary", { auth: "required", retry: 1 })
}

export function getAverageDurations() {
  return http.get<AverageDurations>("/v1/orders/average-durations", { auth: "required", retry: 1 })
}

export function confirmOrder(orderId: string, dto: ConfirmOrderDto) {
  return http.post<Order, ConfirmOrderDto>(`/v1/orders/${seg(orderId)}/confirm`, dto, { auth: "required" })
}

export function payOrder(orderId: string, dto: PayOrderDto) {
  return http.post<Order, PayOrderDto>(`/v1/orders/${seg(orderId)}/pay`, dto, { auth: "required" })
}

export function payOrderQris(orderId: string) {
  return http.post<QrisPayment>(`/v1/orders/${seg(orderId)}/pay-qris`, undefined, { auth: "required" })
}

export function getPaymentStatus(orderId: string) {
  return http.get<PaymentStatus>(`/v1/orders/${seg(orderId)}/payment-status`, { auth: "required", retry: 1 })
}

/** Penjual mulai mengerjakan/menyiapkan pesanan. */
export function processOrder(orderId: string) {
  return http.post<Order>(`/v1/orders/${seg(orderId)}/process`, undefined, { auth: "required" })
}

export function updateShipping(orderId: string, dto: UpdateShippingDto) {
  return http.put<Order, UpdateShippingDto>(`/v1/orders/${seg(orderId)}/shipping`, dto, { auth: "required" })
}

export function completeOrder(orderId: string) {
  return http.post<Order>(`/v1/orders/${seg(orderId)}/complete`, undefined, { auth: "required" })
}

export function cancelOrder(orderId: string, dto: CancelOrderDto) {
  return http.post<Order, CancelOrderDto>(`/v1/orders/${seg(orderId)}/cancel`, dto, { auth: "required" })
}

export function submitDispute(orderId: string, dto: SubmitDisputeDto) {
  return http.post<Dispute, SubmitDisputeDto>(`/v1/orders/${seg(orderId)}/dispute`, dto, { auth: "required" })
}

export function getOrderHistory(orderId: string, query: PageQuery) {
  return http.get<Paginated<OrderHistoryEntry>>(`/v1/orders/${seg(orderId)}/history`, {
    query,
    auth: "required",
    retry: 1,
  })
}

// ------------------------------------------------------------------
// Perpanjangan deadline
// ------------------------------------------------------------------

export function requestExtension(orderId: string, dto: RequestExtensionDto) {
  return http.post<OrderExtension, RequestExtensionDto>(`/v1/orders/${seg(orderId)}/extensions`, dto, {
    auth: "required",
  })
}

export function listExtensions(orderId: string, query: PageQuery) {
  return http.get<Paginated<OrderExtension>>(`/v1/orders/${seg(orderId)}/extensions`, {
    query,
    auth: "required",
    retry: 1,
  })
}

export function respondExtension(orderId: string, extensionId: string, dto: RespondExtensionDto) {
  return http.put<OrderExtension, RespondExtensionDto>(
    `/v1/orders/${seg(orderId)}/extensions/${seg(extensionId)}`,
    dto,
    { auth: "required" },
  )
}

// ------------------------------------------------------------------
// Bukti pengiriman
// ------------------------------------------------------------------

export function submitDeliveryProof(orderId: string, dto: SubmitDeliveryProofDto) {
  return http.post<DeliveryProof, SubmitDeliveryProofDto>(`/v1/orders/${seg(orderId)}/delivery-proof`, dto, {
    auth: "required",
  })
}

export function listDeliveryProofs(orderId: string) {
  return http.get<DeliveryProof[]>(`/v1/orders/${seg(orderId)}/delivery-proof`, { auth: "required", retry: 1 })
}

export function confirmDelivery(orderId: string, dto: ConfirmDeliveryDto = {}) {
  return http.post<Order, ConfirmDeliveryDto>(`/v1/orders/${seg(orderId)}/delivery-proof/confirm`, dto, {
    auth: "required",
  })
}

export function rejectDelivery(orderId: string, dto: RejectDeliveryDto) {
  return http.post<DeliveryProof, RejectDeliveryDto>(`/v1/orders/${seg(orderId)}/delivery-proof/reject`, dto, {
    auth: "required",
  })
}

// ------------------------------------------------------------------
// Order via Link
// ------------------------------------------------------------------

export function createOrderLink(dto: CreateOrderLinkDto) {
  return http.post<OrderLink, CreateOrderLinkDto>("/v1/orders/links", dto, { auth: "required" })
}

export function listMyOrderLinks(query: PageQuery) {
  return http.get<Paginated<OrderLink>>("/v1/orders/links/my", { query, auth: "required", retry: 1 })
}

export function getOrderLink(token: string) {
  return http.get<OrderLink>(`/v1/orders/links/${seg(token)}`, { auth: "required", retry: 1 })
}

export function acceptOrderLink(token: string) {
  return http.post<Order>(`/v1/orders/links/${seg(token)}/accept`, undefined, { auth: "required" })
}

export function cancelOrderLink(token: string) {
  return http.post<OrderLink | MessageResult>(`/v1/orders/links/${seg(token)}/cancel`, undefined, {
    auth: "required",
  })
}

// ------------------------------------------------------------------
// Dokumen
// ------------------------------------------------------------------

export function getInvoice(orderId: string) {
  return http.get<Invoice>(`/v1/orders/${seg(orderId)}/invoice`, { auth: "required", retry: 1 })
}

/** HTML siap cetak — render di WebView atau kirim ke expo-print. */
export function getReceiptHtml(orderId: string) {
  return http.get<string>(`/v1/orders/${seg(orderId)}/receipt`, {
    auth: "required",
    responseType: "text",
    headers: { Accept: "text/html" },
    retry: 1,
  })
}
