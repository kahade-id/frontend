import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { assertDtoConstraints } from "@/lib/financial"
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
import { readPage, readEntity } from "@/lib/api/response"
import { AMOUNT_LIMITS, assertValidAmount } from "@/lib/financial"
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

/**
 * Lifecycle escrow — SATU sumber kebenaran untuk status order.
 * Nilai & label/tone diturunkan dari `components/ui/order-status-badge.tsx`
 * (kontrak display design system; endpoint orders: create → pay → process →
 * shipping → delivery-proof → confirm → complete, cabang cancel/dispute).
 * `(string & {})` menjaga toleransi nilai baru dari backend tanpa crash.
 *
 * Jangan definisikan ulang union ini di file lain: layar memakai tipe dari
 * sini, komponen badge mengimpor ulang (re-export) tipe ini.
 */
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED"
  | "REFUNDED"
  | "EXPIRED"
  | (string & {}) // toleransi nilai baru dari backend tanpa runtime error

/**
 * Gerbang aksi escrow — turunan langsung dari state machine di atas, bukan
 * daftar yang boleh ditulis ulang per layar.
 *
 * Sebelumnya `app/order/[id].tsx` (array) dan `app/extension/[orderId].tsx`
 * (Set) masing-masing punya salinan `EXTENDABLE_STATUSES`. Dua salinan berarti
 * tombol "Perpanjang" di detail order bisa muncul untuk status yang layar
 * perpanjangan sendiri tolak — pengguna menekan tombol lalu menemui layar
 * tanpa aksi. Satu status baru dari backend hanya boleh diputuskan di sini.
 */

/** Sengketa hanya masuk akal setelah dana benar-benar masuk escrow. */
export function isDisputable(status: OrderStatus): boolean {
  return ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(status)
}

/** Perpanjangan tenggat hanya selama pekerjaan berjalan (belum diterima pembeli). */
export function isExtendable(status: OrderStatus): boolean {
  return ["PAID", "PROCESSING", "SHIPPED"].includes(status)
}

/**
 * Pembatalan masih terbuka selama order belum selesai DAN belum disengketakan
 * (order DISPUTED diselesaikan lewat alur sengketa, bukan tombol batal).
 */
export function isCancellable(status: OrderStatus): boolean {
  return ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(status)
}

/** Transisi "jalur bahagia" berikutnya — dipakai untuk estimasi durasi timeline. */
export function nextOrderStatus(status: OrderStatus): OrderStatus | undefined {
  return {
    PENDING_PAYMENT: "PAID",
    PAID: "PROCESSING",
    PROCESSING: "SHIPPED",
    SHIPPED: "DELIVERED",
    DELIVERED: "COMPLETED",
  }[status as string] as OrderStatus | undefined
}

export type Paginated<T> = {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * OrderLifecycle — filter status API.
 *
 * `GET /v1/orders` mendokumentasikan query `status` sebagai:
 *   "Order status filter (use ACTIVE for all active statuses)"
 * Artinya nilai `ACTIVE` adalah kunci magis backend untuk SEMUA status
 * yang sedang berjalan — layar filter "Aktif" WAJIB mengirim `ACTIVE`,
 * bukan salah satu status spesifik.
 */
export type OrderStatusFilter =
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "REFUNDED"
  | "EXPIRED"
  | (string & {})

export type OrderParty = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
}

/**
 * Nama tampil pihak order, atau `undefined` bila pihaknya tidak ada.
 *
 * `Order.buyer`/`Order.seller` bertipe OPSIONAL karena respons hanya
 * di-cast, bukan divalidasi: backend bisa menghilangkan pihak yang akunnya
 * sudah dihapus. Tanpa helper ini tiap layar menulis
 * `order.seller.fullName ?? order.seller.username`, dan satu deref tanpa
 * penjaga cukup untuk melempar TypeError di tengah render.
 */
export function orderPartyName(party: OrderParty | undefined | null): string | undefined {
  return party?.fullName ?? party?.username
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
  /**
   * Pihak order TIDAK dijamin ada: `getOrder` hanya `readEntity`, dan backend
   * bisa mengembalikan `null`/menghilangkan pihak yang akunnya sudah dihapus.
   * Jadi keduanya opsional — deref tanpa penjaga akan melempar TypeError di
   * tengah render dan menjatuhkan seluruh layar ke error boundary.
   */
  buyer?: OrderParty
  seller?: OrderParty
  /** Peran user yang sedang login pada order ini */
  myRole?: OrderRole
  fee?: FeeBreakdown
  trackingNumber?: string | null
  courierName?: string | null
  createdAt: string
  updatedAt?: string
}

function normalizeOrder(raw: Order & Record<string, unknown>): Order {
  const normalizeParty = (value: unknown): OrderParty | undefined => {
    if (!value || typeof value !== "object") return undefined
    const item = value as Record<string, unknown>
    const id = item.id ?? item.userId
    if (typeof id !== "string") return undefined
    return {
      id,
      username: typeof item.username === "string" ? item.username : "",
      fullName: typeof item.fullName === "string" ? item.fullName : undefined,
      avatarUrl: typeof item.avatarUrl === "string" ? item.avatarUrl : null,
    }
  }
  const id = raw.id ?? raw.orderId
  return {
    ...raw,
    id: typeof id === "string" ? id : "",
    buyer: normalizeParty(raw.buyer),
    seller: normalizeParty(raw.seller),
    myRole: (raw.myRole ?? raw.role) as OrderRole | undefined,
  }
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
  return http.post<FeeBreakdown, CalculateFeeDto>("/v1/orders/calculate-fee", dto, {
    auth: "required",
  })
}

export function validateCounterpart(dto: ValidateCounterpartDto) {
  return http.post<CounterpartValidation, ValidateCounterpartDto>(
    "/v1/orders/validate-counterpart",
    dto,
    {
      auth: "required",
    },
  )
}

// ------------------------------------------------------------------
// CRUD & lifecycle
// ------------------------------------------------------------------

export function createOrder(dto: CreateOrderDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.CreateOrderDto)
  assertValidAmount(dto.orderValue, AMOUNT_LIMITS.order)
  return http.post<Order, CreateOrderDto>("/v1/orders", dto, { auth: "required" })
}

export function listOrders(query: ListOrdersQuery = {}, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/orders", { query, auth: "required", retry: 1, signal })
    .then((raw) => {
      const page = readPage<Order & Record<string, unknown>>(raw, query, ["orders"])
      return { ...page, data: page.data.map(normalizeOrder) }
    })
}

export function getOrder(orderId: string) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}`, { auth: "required", retry: 1 })
    .then((raw) => normalizeOrder(readEntity<Order & Record<string, unknown>>(raw, "order")))
}

export function getOrdersSummary() {
  return http.get<OrderSummary>("/v1/orders/summary", { auth: "required", retry: 1 })
}

export function getAverageDurations() {
  return http.get<AverageDurations>("/v1/orders/average-durations", { auth: "required", retry: 1 })
}

export function confirmOrder(orderId: string, dto: ConfirmOrderDto) {
  return http.post<Order, ConfirmOrderDto>(`/v1/orders/${seg(orderId)}/confirm`, dto, {
    auth: "required",
  })
}

export function payOrder(orderId: string, dto: PayOrderDto) {
  return http.post<Order, PayOrderDto>(`/v1/orders/${seg(orderId)}/pay`, dto, { auth: "required" })
}

export function payOrderQris(orderId: string) {
  return http.post<QrisPayment>(`/v1/orders/${seg(orderId)}/pay-qris`, undefined, {
    auth: "required",
  })
}

export function getPaymentStatus(orderId: string) {
  return http.get<PaymentStatus>(`/v1/orders/${seg(orderId)}/payment-status`, {
    auth: "required",
    retry: 1,
  })
}

/** Penjual mulai mengerjakan/menyiapkan pesanan. */
export function processOrder(orderId: string) {
  return http.post<Order>(`/v1/orders/${seg(orderId)}/process`, undefined, { auth: "required" })
}

export function updateShipping(orderId: string, dto: UpdateShippingDto) {
  return http.put<Order, UpdateShippingDto>(`/v1/orders/${seg(orderId)}/shipping`, dto, {
    auth: "required",
  })
}

export function completeOrder(orderId: string) {
  return http.post<Order>(`/v1/orders/${seg(orderId)}/complete`, undefined, { auth: "required" })
}

export function cancelOrder(orderId: string, dto: CancelOrderDto) {
  return http.post<Order, CancelOrderDto>(`/v1/orders/${seg(orderId)}/cancel`, dto, {
    auth: "required",
  })
}

export function submitDispute(orderId: string, dto: SubmitDisputeDto) {
  return http.post<Dispute, SubmitDisputeDto>(`/v1/orders/${seg(orderId)}/dispute`, dto, {
    auth: "required",
  })
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
  return http.post<OrderExtension, RequestExtensionDto>(
    `/v1/orders/${seg(orderId)}/extensions`,
    dto,
    {
      auth: "required",
    },
  )
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
  return http.post<DeliveryProof, SubmitDeliveryProofDto>(
    `/v1/orders/${seg(orderId)}/delivery-proof`,
    dto,
    {
      auth: "required",
    },
  )
}

export function listDeliveryProofs(orderId: string) {
  return http.get<DeliveryProof[]>(`/v1/orders/${seg(orderId)}/delivery-proof`, {
    auth: "required",
    retry: 1,
  })
}

export function confirmDelivery(orderId: string, dto: ConfirmDeliveryDto = {}) {
  return http.post<Order, ConfirmDeliveryDto>(
    `/v1/orders/${seg(orderId)}/delivery-proof/confirm`,
    dto,
    {
      auth: "required",
    },
  )
}

export function rejectDelivery(orderId: string, dto: RejectDeliveryDto) {
  return http.post<DeliveryProof, RejectDeliveryDto>(
    `/v1/orders/${seg(orderId)}/delivery-proof/reject`,
    dto,
    {
      auth: "required",
    },
  )
}

// ------------------------------------------------------------------
// Order via Link
// ------------------------------------------------------------------

export function createOrderLink(dto: CreateOrderLinkDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.CreateOrderLinkDto)
  assertValidAmount(dto.orderValue, AMOUNT_LIMITS.order)
  return http.post<OrderLink, CreateOrderLinkDto>("/v1/orders/links", dto, { auth: "required" })
}

export function listMyOrderLinks(query: PageQuery) {
  return http.get<Paginated<OrderLink>>("/v1/orders/links/my", {
    query,
    auth: "required",
    retry: 1,
  })
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
