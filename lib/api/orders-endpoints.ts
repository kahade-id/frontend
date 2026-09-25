/**
 * orders-endpoints.ts — endpoint CRUD order, pembayaran (PIN/QRIS), status
 * pengiriman, riwayat, statistik. (R2 #97: pecahan facade orders.ts.)
 *
 * Keputusan non-obvious yang dipindah dari header lama:
 *   - Tidak ada `retry` di POST/PUT: pay/complete/cancel tidak idempoten.
 *     GET list/detail memakai `retry: 1` untuk toleransi jaringan seluler.
 */
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { LOCAL_CONSTRAINTS } from "@/lib/api/local-constraints"
import {
  AMOUNT_LIMITS,
  assertDtoConstraints,
  assertValidAmount,
} from "@/lib/financial"
import {
  asRecord,
  invalidResponse,
  pickBoolean,
  pickString,
  readEntity,
  readPage,
} from "@/lib/api/response"
import { http, seg } from "@/lib/api/client"
import { getSessionRevision } from "@/lib/api/session"
import { onQueryCacheInvalidation } from "@/lib/query-cache"
import {
  normalizeCounterpartValidation,
  normalizeFeeBreakdown,
  normalizeOrder,
  numberField,
  toAmount,
  type AverageDurations,
  type Dispute,
  type ListOrdersQuery,
  type Order,
  type OrderHistoryEntry,
  type OrderStatus,
  type OrderSummary,
  type PageQuery,
  type PaymentStatus,
  type QrisPayment,
} from "@/lib/api/orders-shared"
import type {
  CalculateFeeDto,
  CancelOrderDto,
  ConfirmOrderDto,
  CreateOrderDto,
  PayOrderDto,
  SubmitDisputeDto,
  UpdateShippingDto,
  ValidateCounterpartDto,
} from "@/lib/api/types"

export function calculateFee(dto: CalculateFeeDto, signal?: AbortSignal) {
  return http
    .post<unknown, CalculateFeeDto>("/v1/orders/calculate-fee", dto, {
      auth: "required",
      signal,
    })
    .then((raw) => {
      // M-02: response fee di-CAST dulu — kini dinormalisasi; angka inti yang
      // tidak lengkap melempar PARSE (lebih jujur daripada NaN di kartu uang).
      const fee = normalizeFeeBreakdown(raw)
      if (!fee) throw invalidResponse("fee-breakdown")
      return fee
    })
}

export function validateCounterpart(dto: ValidateCounterpartDto) {
  return http
    .post<unknown, ValidateCounterpartDto>("/v1/orders/validate-counterpart", dto, {
      auth: "required",
    })
    .then(normalizeCounterpartValidation)
}

// ------------------------------------------------------------------
// CRUD & lifecycle
// ------------------------------------------------------------------

/**
 * C-06 (audit escrow 2026-09-24): `idempotencyKey` opsional dari PEMANGGIL.
 * Layar membuat SATU kunci per formulir dan memakainya ulang untuk semua
 * percobaan manual pengguna (mis. tekan lagi setelah timeout) — tanpa ini,
 * transport membuat kunci baru per attempt dan `createOrder` sukses-di-server
 * yang timeout-di-klien berlipat jadi dua order. Kunci disimpan sampai hasil
 * final diketahui, lalu layar membuat kunci baru untuk kiriman berikutnya.
 */
export function createOrder(dto: CreateOrderDto, idempotencyKey?: string) {
  assertDtoConstraints(dto, API_CONSTRAINTS.CreateOrderDto)
  assertValidAmount(dto.orderValue, AMOUNT_LIMITS.order)
  return http.post<Order & Record<string, unknown>, CreateOrderDto>("/v1/orders", dto, {
    auth: "required",
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  }).then((raw) => normalizeOrder(readEntity<Order & Record<string, unknown>>(raw, "order")))
}

/**
 * GET /v1/orders — daftar pesanan (paginated).
 *
 * C-05 (audit): `limit` kini SELALU terkirim (default 20). Sebelumnya pemanggil
 * yang lupa mengisi `limit` membuat `readPage` menghitung paginasi dari panjang
 * data — halaman penuh bisa berarti "masih ada" atau "berhenti" tergantung
 * tebakan, dan halaman terakhir yang kebetulan penuh memicu request kosong.
 */
export function listOrders(query: ListOrdersQuery = {}, signal?: AbortSignal) {
  const page = { page: 1, limit: 20, ...query }
  return http
    .get<unknown>("/v1/orders", { query: page, auth: "required", signal })
    .then((raw) => {
      const result = readPage<Order & Record<string, unknown>>(raw, page, ["orders"])
      const data = result.data
        // I-04: baris dengan uang rusak ikut DIBUANG (prinsip D-11) — satu
        // baris tak sah tidak boleh menjatuhkan seluruh daftar dengan PARSE.
        .flatMap((item) => {
          try {
            return [normalizeOrder(item)]
          } catch {
            return []
          }
        })
        // D-11 (audit escrow 2026-09-24): baris tanpa id dibuang — dulu tampil
        // sebagai kartu valid yang setiap aksinya melempar `seg("")`.
        .filter((order) => order.id !== "")
      return { ...result, data }
    })
}

export function getOrder(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}`, { auth: "required", retry: 1, signal })
    .then((raw) => {
      const order = normalizeOrder(readEntity<Order & Record<string, unknown>>(raw, "order"))
      // I-06: detail tanpa id bukan order yang sah — dulu tampil normal dengan
      // `id: ""` sehingga setiap aksi di layar melempar "Identitas data tidak
      // valid" (seg("")) di tengah jalan. Lebih jujur gagal di pintu masuk.
      if (!order.id) throw invalidResponse("order.id")
      return order
    })
}

export function getOrdersSummary(signal?: AbortSignal) {
  // D-07 (audit escrow 2026-09-24): divalidasi bentuknya — dulu di-cast
  // mentah sehingga objek error/aneh terbaca sebagai angka ringkasan.
  return http.get<unknown>("/v1/orders/summary", { auth: "required", retry: 1, signal }).then(
    (raw): OrderSummary => {
      const record = asRecord(raw)
      if (!record) throw invalidResponse("orders-summary")
      const side = (value: unknown) => {
        const src = asRecord(value)
        if (!src) return undefined
        const count = numberField(src, ["count", "total", "orders"])
        const totalValue = numberField(src, ["totalValue", "total_value", "value"])
        return count === undefined && totalValue === undefined ? undefined : { count, totalValue }
      }
      return {
        asBuyer: side(record.asBuyer ?? record.as_buyer),
        asSeller: side(record.asSeller ?? record.as_seller),
        inDispute: numberField(record, ["inDispute", "in_dispute", "disputed"]),
        pendingExtensions: numberField(record, ["pendingExtensions", "pending_extensions"]),
      }
    },
  )
}

export function getAverageDurations(signal?: AbortSignal) {
  // D-07: `average-durations` harus `Record<string, number>` (key status →
  // jam). Kunci yang bukan angka finite dibuang; body bukan objek → PARSE.
  return http
    .get<unknown>("/v1/orders/average-durations", { auth: "required", retry: 1, signal })
    .then((raw): AverageDurations => {
      const record = asRecord(raw)
      if (!record) throw invalidResponse("average-durations")
      const src =
        asRecord(record.durations) ?? asRecord(record.data) ?? asRecord(record.result) ?? record
      const clean: AverageDurations = {}
      for (const [key, value] of Object.entries(src)) {
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) clean[key] = value
        else if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()))
          clean[key] = Number(value)
      }
      return clean
    })
}

/**
 * F-05 (audit 2026-09-20): `average-durations` adalah statistik GLOBAL
 * (rata-rata waktu antar-status untuk estimasi timeline) — nilainya berubah
 * harian, bukan per order. Menariknya tiap membuka detail order = kuota &
 * latensi untuk angka yang sama. Cache memori per sesi (TTL 10 menit),
 * di-invalidate otomatis saat revision sesi berubah (login/logout).
 */
const AVERAGE_DURATIONS_TTL_MS = 10 * 60 * 1000
let averageDurationsCache: { revision: number; at: number; value: AverageDurations } | null = null

/**
 * G-05 (audit escrow 2026-09-24): cache TTL 10 menit ini sekarang ikut
 * disapu `invalidateQueryCache` (langganan di bawah) — sebelumnya mutasi uang
 * tidak pernah menyegarkan estimasi timeline, dan hasil parsing yang gagal
 * (envelope error yang lolos, lihat B-04) ikut ter-cache. `getAverageDurations`
 * kini melempar sebelum menulis cache bila bentuknya salah (D-07).
 */
onQueryCacheInvalidation(() => {
  averageDurationsCache = null
})

export async function getAverageDurationsCached(signal?: AbortSignal): Promise<AverageDurations> {
  const revision = getSessionRevision()
  if (
    averageDurationsCache &&
    averageDurationsCache.revision === revision &&
    Date.now() - averageDurationsCache.at < AVERAGE_DURATIONS_TTL_MS
  ) {
    return averageDurationsCache.value
  }
  const value = await getAverageDurations(signal)
  averageDurationsCache = { revision, at: Date.now(), value }
  return value
}

export function confirmOrder(orderId: string, dto: ConfirmOrderDto) {
  return http.post<Order, ConfirmOrderDto>(`/v1/orders/${seg(orderId)}/confirm`, dto, {
    auth: "required",
  })
}

/**
 * C-06 (audit escrow 2026-09-24): `idempotencyKey` opsional dari pemanggil —
 * lihat `createOrder`. Debit PIN ganda karena retry manual = dua kali debit.
 */
export function payOrder(orderId: string, dto: PayOrderDto, idempotencyKey?: string) {
  // R2 (butir #102): PayOrderDto absen dari API_CONSTRAINTS (spec tanpa
  // constraint key) — divalidasi lewat batasan lokal; jangan mengirim PIN
  // yang pasti ditolak backend.
  assertDtoConstraints(dto, LOCAL_CONSTRAINTS.PayOrderDto)
  return http.post<Order, PayOrderDto>(`/v1/orders/${seg(orderId)}/pay`, dto, {
    auth: "required",
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  })
}

export function payOrderQris(orderId: string, idempotencyKey?: string) {
  return http
    .post<unknown>(`/v1/orders/${seg(orderId)}/pay-qris`, undefined, {
      auth: "required",
      // I-07 (audit end-to-end): intent QRIS ganda = dua tagihan untuk satu
    // order saat retry manual — kunci pemanggil (satu per sesi intent).
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    })
    .then((raw) => {
      // D-05: dulu di-cast — `qrString` undefined dirender sebagai QR kosong.
      const qris = normalizeQrisPayment(raw)
      if (!qris) throw invalidResponse("qris-payment")
      return qris
    })
}

/**
 * D-05 (audit escrow 2026-09-24): normalizer intent QRIS — pola yang sama
 * dengan `normalizePaymentStatus`. Tanpa ini `qrString` bisa `undefined` lalu
 * dirender sebagai QR kosong yang gagal dipindai tanpa pesan error.
 * `expiresAt` BOLEH hilang (C-03) — panel menampilkan QR tanpa countdown.
 */
export function normalizeQrisPayment(raw: unknown): QrisPayment | undefined {
  const record = asRecord(raw)
  if (!record) return undefined
  const nested = asRecord(record.payment) ?? asRecord(record.data) ?? record
  const qrString = pickString(nested, ["qrString", "qr_string", "qr", "qrCode", "qr_code"])
  if (!qrString) return undefined
  const amount = toAmount(nested.amount ?? nested.total ?? nested.amountDue)
  return {
    qrString,
    qrUrl: pickString(nested, ["qrUrl", "qr_url", "url"]) ?? undefined,
    expiresAt: pickString(nested, ["expiresAt", "expires_at", "expiredAt", "expiry"]) ?? null,
    amount: amount ?? 0,
    paymentTxId: pickString(nested, ["paymentTxId", "payment_tx_id", "txId", "transactionId"]) ?? undefined,
  }
}

export function getPaymentStatus(orderId: string) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/payment-status`, { auth: "required" })
    .then(normalizePaymentStatus)
}

/**
 * Normalizer `GET /v1/orders/{orderId}/payment-status`.
 *
 * `app/order/[id].tsx` mem-polling endpoint ini tiap 3 detik dan berhenti hanya
 * bila `status` ∈ {PAID, EXPIRED, FAILED, CANCELLED}. Bila backend menaruh
 * statusnya di `paymentStatus`/`payment.status`, versi lama membaca `undefined`
 * — polling tidak pernah berhenti dan layar tidak pernah tahu pembayaran sudah
 * masuk. Alias di bawah menutup itu.
 *
 * C-01 (audit escrow 2026-09-24): status tak dikenal/tiada TIDAK lagi
 * di-default `PENDING` (dulu respons error/tak berbentuk mengunci polling QRIS
 * 15 menit) — hasilnya `UNKNOWN` dan polling berhenti; UI menawarkan "Cek
 * status sekarang".
 *
 * C-02: flag boolean (`paid`/`isPaid`/`expired`/…) dan `paidAt` ikut dibaca
 * sebagai sinyal terminal — bukti pembayaran non-standar tidak lagi diabaikan.
 */
export function normalizePaymentStatus(raw: unknown): PaymentStatus {
  const record = asRecord(raw) ?? {}
  const nested =
    asRecord(record.payment) ?? asRecord(record.data) ?? asRecord(record.result) ?? record
  const pick = (keys: readonly string[]) =>
    pickBoolean(record, keys) ?? pickBoolean(nested, keys)
  const rawStatus =
    pickString(record, ["status", "paymentStatus", "payment_status"]) ??
    pickString(nested, ["status", "paymentStatus", "payment_status"])
  const paidFlag = pick(["paid", "isPaid", "is_paid"])
  const expiredFlag = pick(["expired", "isExpired", "is_expired"])
  const failedFlag = pick(["failed", "isFailed", "is_failed"])
  const cancelledFlag = pick(["cancelled", "canceled", "isCancelled", "isCanceled"])
  const deeper = asRecord(nested.payment) ?? asRecord(nested.transaction) ?? null
  const paidAt =
    pickString(record, ["paidAt", "paid_at"]) ??
    pickString(nested, ["paidAt", "paid_at"]) ??
    pickString(deeper, ["paidAt", "paid_at"]) ??
    null

  let status = rawStatus?.toUpperCase()
  if (!status || status === "PENDING") {
    // Flag boolean / paidAt mengalahkan "PENDING" dan default kosong.
    if (paidFlag === true || paidAt) status = "PAID"
    else if (expiredFlag === true) status = "EXPIRED"
    else if (failedFlag === true) status = "FAILED"
    else if (cancelledFlag === true) status = "CANCELLED"
    else if (!status) status = "UNKNOWN"
  }

  return {
    status: status as PaymentStatus["status"],
    // M-06 (audit end-to-end, issue #8): field boolean diisi dari hasil
    // pembacaan strict di atas (dulu `isPaid`/`isExpired` dijanjikan tipe tapi
    // TIDAK PERNAH ikut return → `res.isPaid` selalu undefined di layar).
    isPaid: paidFlag === true || status === "PAID",
    isExpired: expiredFlag === true || status === "EXPIRED",
    paidAt,
    method: pickString(record, ["method", "paymentMethod"]) ?? pickString(nested, ["method"]) ?? null,
  }
}

/** Penjual mulai mengerjakan/menyiapkan pesanan. */
export function processOrder(orderId: string) {
  return http.post<Order>(`/v1/orders/${seg(orderId)}/process`, undefined, { auth: "required" })
}

export function updateShipping(orderId: string, dto: UpdateShippingDto) {
  // I-09 (audit end-to-end): aturan generated (`trackingNumber` min 3,
  // `courierName` min 2) ditegakkan di klien — dulu lolos ke jaringan dan
  // kembali 400 di tengah alur kirim.
  assertDtoConstraints(dto, API_CONSTRAINTS.UpdateShippingDto)
  return http.put<Order, UpdateShippingDto>(`/v1/orders/${seg(orderId)}/shipping`, dto, {
    auth: "required",
  })
}

/**
 * I-08 (audit end-to-end 2026-09-24): `POST /v1/orders/{id}/complete` di
 * spesifikasi TANPA `requestBody` — komentar A-13 lama mengklaim rilis dana
 * membawa `ConfirmDeliveryDto`, padahal body `{}`/`{proofId}` hanya sah di
 * `/delivery-proof/confirm`. Kirim tanpa body mengikuti kontrak; validator
 * strict backend tidak lagi berpeluang menolak rilis dana dengan 400.
 */
export function completeOrder(orderId: string, idempotencyKey?: string) {
  // R2 (audit ronde-2, butir #17): pelepasan dana berlindung idempotensi
  // (pola C-06 createOrder/payOrder) — aman bila backend mengabaikan header.
  return http.post<Order>(`/v1/orders/${seg(orderId)}/complete`, undefined, {
    auth: "required",
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  })
}

export function cancelOrder(orderId: string, dto: CancelOrderDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.CancelOrderDto)
  return http.post<Order, CancelOrderDto>(`/v1/orders/${seg(orderId)}/cancel`, dto, {
    auth: "required",
  })
}

export function submitDispute(orderId: string, dto: SubmitDisputeDto) {
  return http.post<Dispute, SubmitDisputeDto>(`/v1/orders/${seg(orderId)}/dispute`, dto, {
    auth: "required",
  })
}

/**
 * D-02 (audit escrow 2026-09-24): dulu di-cast ke `Paginated<T>` — bila
 * backend membungkus dengan kunci `history`, `.data` `undefined` dan riwayat
 * (audit transisi status escrow) lenyap SENYAP dari detail order. Kini
 * `readPage` dengan alias kunci + normalizer entri (A-02: `toStatus`/`actor`
 * dipaksa string agar kunci prototipe tidak lolos ke render).
 */
export function getOrderHistory(orderId: string, query: PageQuery, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/history`, {
      query,
      auth: "required",
      signal,
    })
    .then((raw) => {
      const page = readPage<OrderHistoryEntry & Record<string, unknown>>(raw, query, [
        "history",
        "entries",
      ])
      return {
        ...page,
        data: page.data.map((entry, index): OrderHistoryEntry => {
          const item = asRecord(entry) ?? {}
          const toStatus = pickString(item, ["toStatus", "to_status", "status"]) ?? ""
          return {
            // I-13: id sintetis memuat nomor halaman — indeks terulang tiap
            // halaman membuat id `h-0-…` tabrakan saat digabung (kunci React +
            // mergeById menimpa entri).
            id: pickString(item, ["id", "historyId"]) ?? `h-${query.page}-${index}-${toStatus}`,
            fromStatus: (pickString(item, ["fromStatus", "from_status"]) ?? null) as OrderStatus | null,
            toStatus: toStatus as OrderStatus,
            actor: pickString(item, ["actor", "actorRole", "actor_role"]) ?? null,
            actorId: pickString(item, ["actorId", "actor_id", "userId"]) ?? null,
            note: pickString(item, ["note", "reason"]) ?? null,
            createdAt: pickString(item, ["createdAt", "created_at"]) ?? "",
          }
        }),
      }
    })
}

// ------------------------------------------------------------------
// Perpanjangan deadline
// ------------------------------------------------------------------
