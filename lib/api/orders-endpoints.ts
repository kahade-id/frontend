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
import { API_TIMEOUT_INTERACTIVE_MS } from "@/lib/api/config"
import { isApiError } from "@/lib/api/errors"
import {
  deviceLocationOnlyBody,
  withDeviceLocation,
  type WithDeviceLocation,
} from "@/lib/api/device-location"
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
  BuyerLocation,
  CalculateFeeDto,
  CancelOrderDto,
  ConfirmOrderDto,
  CreateOrderDto,
  LocationDto,
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
export async function createOrder(dto: CreateOrderDto, idempotencyKey?: string) {
  assertDtoConstraints(dto, API_CONSTRAINTS.CreateOrderDto)
  assertValidAmount(dto.orderValue, AMOUNT_LIMITS.order)
  // Lokasi presisi aksi sensitif (kontrak lintas tim 2026-09-27): diambil
  // tepat sebelum request dikirim, setelah validasi lolos.
  const body = await withDeviceLocation(dto)
  // Lokasi presisi buyer (kontrak backend BuyerLocationDto): dipakai ulang
  // dari hasil capture di atas — SATU pengambilan lokasi untuk dua field,
  // tanpa prompt izin ganda. Izin ditolak/gagal → field tidak dikirim
  // (backend nullable) dan transaksi TETAP JALAN.
  const buyerLocation = toBuyerLocation(body.deviceLocation ?? null)
  if (buyerLocation) {
    ;(body as WithDeviceLocation<CreateOrderDto> & { buyerLocation?: BuyerLocation }).buyerLocation =
      buyerLocation
  }
  return http.post<Order & Record<string, unknown>, WithDeviceLocation<CreateOrderDto>>(
    "/v1/orders",
    body,
    {
      auth: "required",
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    },
  ).then((raw) => normalizeOrder(readEntity<Order & Record<string, unknown>>(raw, "order")))
}

/**
 * Petakan hasil capture lokasi aksi ke kontrak `buyerLocation` backend:
 * `{ latitude, longitude, accuracy?, capturedAt? }`. Mengembalikan `null`
 * bila tidak ada lokasi (izin ditolak/gagal) — pemanggil tidak mengirim
 * field sama sekali dalam kasus itu.
 */
function toBuyerLocation(loc: LocationDto | null): BuyerLocation | null {
  if (
    !loc ||
    typeof loc.latitude !== "number" ||
    typeof loc.longitude !== "number" ||
    !Number.isFinite(loc.latitude) ||
    !Number.isFinite(loc.longitude)
  ) {
    return null
  }
  const out: BuyerLocation = { latitude: loc.latitude, longitude: loc.longitude }
  if (typeof loc.accuracy === "number" && Number.isFinite(loc.accuracy) && loc.accuracy >= 0) {
    out.accuracy = loc.accuracy
  }
  if (typeof loc.timestamp === "string" && loc.timestamp.length > 0) {
    out.capturedAt = loc.timestamp
  }
  return out
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

/**
 * D1-005 (perf 2026-09-29): status order ringan — dipakai poll 15 detik.
 * Klien hanya me-refresh bundle penuh (`getOrder` + riwayat) bila status
 * BERUBAH, bukan setiap tick.
 */
export type OrderStatusLight = {
  orderId: string
  status: string
  updatedAt: string
}

/**
 * GET /v1/orders/:id/status — status ringan order (dipakai sebagai
 * fingerprint polling, mis. layar invoice).
 *
 * PERF-NET (network P2): kontrak RINGAN dipin di sini — endpoint ini HANYA
 * boleh mengembalikan kolom status (`OrderStatusLight`); jangan memperkaya
 * dengan payload berat karena dipoll tiap 15 dtk sebagai pendeteksi
 * perubahan (bukan pembawa data).
 */
export function getOrderStatus(orderId: string, signal?: AbortSignal) {
  return http.get<OrderStatusLight>(`/v1/orders/${seg(orderId)}/status`, {
    auth: "required",
    retry: 1,
    signal,
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
 * PERF-FIX (network P1): invalidasi terarah — estimasi durasi pengiriman
 * hanya relevan untuk keluarga order/transaksi; push chat/promo/showcase
 * tidak perlu membuang cache 10 menit ini (satu request hemat).
 */
const ORDER_FAMILY_PREFIXES = [
  "order",
  "tracking-order",
  "delivery-proof",
  "dispute",
  "milestone",
  "transactions",
  "wallet",
  "escrow",
] as const

onQueryCacheInvalidation((scope) => {
  if (scope !== undefined) {
    const keyTouchesOrders = (key: string): boolean =>
      ORDER_FAMILY_PREFIXES.some((family) => key.startsWith(family) || family.startsWith(key))
    const touchesOrders =
      scope.keys?.some(keyTouchesOrders) === true || scope.prefixes?.some(keyTouchesOrders) === true
    if (!touchesOrders) return
  }
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
export async function payOrder(orderId: string, dto: PayOrderDto, idempotencyKey?: string) {
  // R2 (butir #102): PayOrderDto absen dari API_CONSTRAINTS (spec tanpa
  // constraint key) — divalidasi lewat batasan lokal; jangan mengirim PIN
  // yang pasti ditolak backend.
  assertDtoConstraints(dto, LOCAL_CONSTRAINTS.PayOrderDto)
  const body = await withDeviceLocation(dto)
  return http.post<Order, WithDeviceLocation<PayOrderDto>>(`/v1/orders/${seg(orderId)}/pay`, body, {
    auth: "required",
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  })
}

export async function payOrderQris(orderId: string, idempotencyKey?: string) {
  // BFI-016: endpoint tidak membaca body sama sekali (tidak ada @Body() di
  // controller) — kirim TANPA body. Mengirim { deviceLocation } hanya
  // menambah byte & risiko salah kira kontrak.
  return http
    .post<unknown, undefined>(
      `/v1/orders/${seg(orderId)}/pay-qris`,
      undefined, {
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
  // SEC-404: nominal hilang/tidak-valid (<= 0) = respons malformed → tolak
  // seluruh intent (invalidResponse di pemanggil). JANGAN default ke 0:
  // panel akan mencetak "Rp0" di samping QR yang menagih nominal sebenarnya.
  if (amount == null || amount <= 0) return undefined
  return {
    qrString,
    qrUrl: pickString(nested, ["qrUrl", "qr_url", "url"]) ?? undefined,
    // BFI-135: backend mengirim `expiryTime` (OrderQrisPaymentResult) —
    // tanpa alias ini countdown panel tidak pernah dapat tenggat server.
    expiresAt: pickString(nested, ["expiresAt", "expires_at", "expiredAt", "expired_at", "expiryTime", "expiry_time", "expiry"]) ?? null,
    amount,
    paymentTxId: pickString(nested, ["paymentTxId", "payment_tx_id", "txId", "transactionId"]) ?? undefined,
  }
}

export function getPaymentStatus(orderId: string) {
  // ESI-016: status DANA-direct = `GET /v1/orders/:orderId/dana-payment-status`
  // (didelegasikan ke `DanaDirectPaymentService.getStatus`; kontrak
  // `DanaDirectPayResult`). Endpoint ini KHUSUS DANA-direct (tanpa fallback
  // QRIS lawas) — dipakai polling sheet pembayaran. Untuk verifikasi
  // lintas-kontrak (mis. layar payment/finish) pakai
  // `getCanonicalPaymentStatus` (`/payment-status`: DANA-direct dulu, lalu
  // fallback QRIS lawas).
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/dana-payment-status`, { auth: "required" })
    .then(normalizePaymentStatus)
}

/**
 * SEC-401: `GET /v1/orders/:orderId/payment-status` — endpoint status
 * KANONIS (MFE-004): DANA-direct dulu (`DanaDirectPaymentService.getStatus`,
 * kontrak `DanaDirectPayResult`), fallback ke QRIS lawas bila tidak ada baris
 * DANA-direct. Dipakai layar `payment/finish` untuk verifikasi server-side
 * hasil redirect DANA — status sukses TIDAK PERNAH diturunkan dari query
 * params. Mengembalikan juga `paymentTxId` server agar pemanggil bisa
 * cross-check param URL (bila ada) sebelum mengklaim sukses.
 */
export function getCanonicalPaymentStatus(orderId: string) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/payment-status`, { auth: "required" })
    .then((raw) => {
      const record = asRecord(raw) ?? {}
      const payment =
        asRecord(record.payment) ?? asRecord(record.data) ?? asRecord(record.result) ?? null
      const paymentTxId =
        pickString(payment ?? {}, ["paymentTxId", "payment_tx_id", "txId", "transactionId"]) ??
        undefined
      return { payment: normalizePaymentStatus(raw), paymentTxId }
    })
}

/**
 * payKind backend untuk checkout DANA-direct (kontrak kanonis
 * `DanaDirectPayDto`: QRIS | VA | BALANCE). Dipindahkan ke sini dari
 * `lib/api/subscription-payments.ts` agar alur order memakai pemetaan yang
 * sama — satu sumber kebenaran, bukan dua salinan yang bisa drift.
 */
export type DanaDirectPayKind = "QRIS" | "VA" | "BALANCE"

/**
 * Petakan kode metode UI → { payKind, bankCode } untuk `DanaDirectPayDto`.
 * Kode tak dikenal → lempar (fail-closed): jangan menebak metode bayar.
 *
 * Bentuk kode yang diterima:
 * - "QRIS" → { payKind: "QRIS" }
 * - "VA_BCA" / "VA-BCA" / "VA BCA" → { payKind: "VA", bankCode: "BCA" }
 *   (bank sesuai daftar `DANA_DIRECT_VA_BANKS` backend)
 * - "VA" polos → { payKind: "VA" } (tanpa bankCode; backend memvalidasi
 *   bila bank wajib untuk metode ini)
 * - "DANA" / "BALANCE" / "SALDO_DANA" → { payKind: "BALANCE" }
 */
export function toDanaPayKind(methodCode: string): {
  payKind: DanaDirectPayKind
  bankCode?: string
} {
  const code = methodCode.trim().toUpperCase()
  if (code === "QRIS") return { payKind: "QRIS" }
  if (code === "DANA" || code === "BALANCE" || code === "SALDO_DANA")
    return { payKind: "BALANCE" }
  if (code === "VA") return { payKind: "VA" }
  const va = code.match(/^VA[_ -]?(BCA|BNI|BRI|MANDIRI|CIMB|PERMATA)$/)
  if (va) return { payKind: "VA", bankCode: va[1] }
  throw invalidResponse(`dana-pay-kind:${methodCode}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode Tanpa Wallet Internal (BI-safe) — checkout via DANA (provider utama).
//
// KONTRAK KANONIS (2026-09-30, terverifikasi terhadap backend
// `src/modules/no-wallet/dana-direct-payment.service.ts`):
//   GET  /v1/orders/{id}/payment-methods
//     → { walletEnabled: false, methods: DanaPaymentMethodInfo[] }
//       DanaPaymentMethodInfo = { kind: "QRIS"|"VA"|"BALANCE", label,
//         requiresBankCode, banks? }
//   POST /v1/orders/{id}/payments { payKind, bankCode? } (`DanaDirectPayDto`)
//     → DanaDirectPayResult { paymentTxId, status: PaymentStatus, payKind,
//       escrowAmount, providerFee, grossAmount, paymentCode, qrString,
//       webRedirectUrl, expiryTime }
//   GET  /v1/orders/{id}/dana-payment-status → { payment: DanaDirectPayResult | null }
//        (status = PaymentStatus: PENDING|SUCCESS|FAILED|… — "SUCCESS" dibaca
//        sebagai PAID di `normalizePaymentStatus`)
// Buyer membayar langsung per transaksi; tidak ada top-up.
// Fail-closed: daftar/list tidak bisa diparse → gagal total (bukan diam);
// fallback DANA statis dipakai hanya bila endpoint belum tersedia (404).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metode pembayaran order dari backend (DANA). `code` adalah kunci stabil
 * (mis. "QRIS", "VA_BCA", "DANA") yang dikirim balik ke POST /payments.
 * `category` membedakan cara render: qris | va | bank | ewallet | redirect | wallet.
 */
export type OrderPaymentMethod = {
  id: string
  code: string
  name: string
  category?: string
  logoUrl?: string
  fee?: number
  minAmount?: number
  maxAmount?: number
  enabled: boolean
  recommended?: boolean
  /**
   * Kontrak kanonis backend (`DanaPaymentMethodInfo`): daftar bank untuk
   * metode VA (`banks`) + flag `requiresBankCode`. UI meng-expand metode VA
   * ber-bank menjadi entri per-bank (`VA_BCA`, …) di
   * `resolveCheckoutPaymentMethods` — lapisan API menyimpan apa adanya.
   */
  banks?: string[]
  requiresBankCode?: boolean
}

export async function getOrderPaymentMethods(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderPaymentMethod[]> {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/payment-methods`, {
      auth: "required",
      signal,
    })
    .then((raw) => {
      const methods = normalizeOrderPaymentMethods(raw)
      if (!methods) throw invalidResponse("order-payment-methods")
      return methods
    })
}

/**
 * Normalizer daftar metode — toleran bentuk: array polos, {methods},
 * {data:{methods}}, {items}. Entri TANPA code/name/enabled eksplisit dibuang
 * (fail-closed); `enabled` default true bila absen agar provider yang tidak
 * mengirim flag tidak mengosongkan checkout.
 *
 * KONTRAK KANONIS (2026-09-30, terverifikasi terhadap backend):
 * `GET /v1/orders/{id}/payment-methods` → `{ walletEnabled: false, methods:
 * DanaPaymentMethodInfo[] }` dengan `DanaPaymentMethodInfo = { kind:
 * "QRIS"|"VA"|"BALANCE", label, requiresBankCode, banks? }`. Maka:
 * - `code` dibaca dari `kind` (alias baru) — dulu hanya "code"/"method"/"id"
 *   sehingga SELURUH daftar backend dibuang dan checkout kosong.
 * - `category` diturunkan dari `kind` bila backend tidak mengirimnya:
 *   QRIS→"qris", VA→"va", BALANCE→"ewallet" (render panel yang benar).
 */
export function normalizeOrderPaymentMethods(raw: unknown): OrderPaymentMethod[] | undefined {
  const list = extractMethodList(raw)
  if (!list) return undefined
  const methods: OrderPaymentMethod[] = []
  for (const entry of list) {
    const rec = asRecord(entry)
    if (!rec) continue
    const code = pickString(rec, ["code", "methodCode", "method", "kind", "id"])
    const name = pickString(rec, ["name", "label", "title"])
    if (!code || !name) continue
    const kind = pickString(rec, ["kind"])?.trim().toUpperCase()
    const categoryFromKind =
      kind === "QRIS" ? "qris" : kind === "VA" ? "va" : kind === "BALANCE" ? "ewallet" : undefined
    const banksRaw = rec.banks ?? rec.bankList
    const banks = Array.isArray(banksRaw)
      ? banksRaw.filter((b): b is string => typeof b === "string" && b.trim().length > 0)
      : undefined
    methods.push({
      id: pickString(rec, ["id"]) ?? code,
      code,
      name,
      category: pickString(rec, ["category", "type"]) ?? categoryFromKind,
      logoUrl: pickString(rec, ["logoUrl", "logo_url", "iconUrl", "icon"]) ?? undefined,
      fee: toAmount(rec.fee) ?? undefined,
      minAmount: toAmount(rec.minAmount ?? rec.min_amount) ?? undefined,
      maxAmount: toAmount(rec.maxAmount ?? rec.max_amount) ?? undefined,
      enabled: pickBoolean(rec, ["enabled", "isEnabled", "is_enabled", "active"]) ?? true,
      recommended: pickBoolean(rec, ["recommended", "isRecommended", "is_recommended"]) ?? false,
      banks,
      requiresBankCode:
        pickBoolean(rec, ["requiresBankCode", "requires_bank_code"]) ?? undefined,
    })
  }
  return methods
}

/** Ambil array metode dari berbagai bungkus respons (array polos, {methods}, {data:{methods}}, {items}). */
function extractMethodList(raw: unknown): unknown[] | undefined {
  if (Array.isArray(raw)) return raw
  const record = asRecord(raw)
  if (!record) return undefined
  const data = asRecord(record.data)
  const candidates = [record.methods, record.items, record.paymentMethods, data?.methods]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }
  return undefined
}

/**
 * Intent pembayaran DANA untuk SATU metode: berisi salah satu dari
 * `qrString` (QRIS), `vaNumber` (Virtual Account), atau `redirectUrl`
 * (DANA app / halaman bayar) — dinormalisasi toleran dari respons backend.
 */
export type OrderPaymentIntent = {
  /** Kode metode yang dipakai membuat intent (echo dari pemanggil). */
  method: string
  qrString?: string
  qrUrl?: string
  vaNumber?: string
  vaBankName?: string
  accountName?: string
  redirectUrl?: string
  /** C-03: bisa hilang — panel menampilkan tanpa countdown. */
  expiresAt?: string | null
  amount: number
  paymentTxId?: string
  instructions?: string[]
}

export async function createOrderPayment(
  orderId: string,
  methodCode: string,
  idempotencyKey?: string,
): Promise<OrderPaymentIntent> {
  // KONTRAK KANONIS (2026-09-30, terverifikasi terhadap backend):
  // `POST /v1/orders/{id}/payments` memakai `DanaDirectPayDto` =
  // `{ payKind: "QRIS"|"VA"|"BALANCE", bankCode? }` — BUKAN
  // `{ paymentMethod: "<code>" }` seperti dugaan lama (backend mewajibkan
  // `payKind` → request lama selalu 400). Kode UI ("QRIS", "VA_BCA",
  // "DANA") dipetakan via `toDanaPayKind` (fail-closed).
  // BFI-071/MFE-001: body HANYA { payKind, bankCode? } — `deviceLocation`
  // adalah key non-whitelisted untuk DTO ini dan ValidationPipe global
  // (forbidNonWhitelisted) menolak SELURUH request karenanya (422). Jangan
  // selipkan deviceLocation di sini (kontrak lintas tim 2026-09-27 tidak
  // berlaku untuk endpoint ini); lokasi perangkat dicatat lewat jalur
  // checkout lain (lihat `deviceLocationOnlyBody` untuk endpoint yang
  // kontraknya memang memuatnya), bukan di sini.
  const { payKind, bankCode } = toDanaPayKind(methodCode)
  try {
    const raw = await http.post<unknown, { payKind: DanaDirectPayKind; bankCode?: string }>(
      `/v1/orders/${seg(orderId)}/payments`,
      { payKind, ...(bankCode ? { bankCode } : {}) },
      {
        auth: "required",
        // I-07 (audit end-to-end): intent ganda = dua tagihan untuk satu
        // order saat retry manual — kunci pemanggil (satu per sesi intent).
        ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
      },
    )
    const intent = normalizeOrderPaymentIntent(raw)
    if (!intent) throw invalidResponse("order-payment")
    return { ...intent, method: methodCode }
  } catch (err) {
    // TRANSISI (2026-09-29): backend DANA belum tentu live saat branch ini
    // dipakai — untuk QRIS (satu-satunya metode dengan jalur lama yang
    // terbukti) fallback ke POST /pay-qris supaya checkout tidak mati total.
    // Metode lain TIDAK punya fallback: gagal dengan error asli.
    if (methodCode === "QRIS" && isApiError(err) && err.status === 404) {
      const legacy = await payOrderQris(orderId, idempotencyKey)
      return {
        method: methodCode,
        qrString: legacy.qrString,
        qrUrl: legacy.qrUrl,
        expiresAt: legacy.expiresAt,
        amount: legacy.amount,
        paymentTxId: legacy.paymentTxId,
      }
    }
    throw err
  }
}

/**
 * Normalizer intent pembayaran — bentuk umum; backend boleh menaruh payload
 * di {payment}/{data}/{result} atau root. Tanpa SATU PUN payload yang bisa
 * ditindaklanjuti (qrString/vaNumber/redirectUrl) → undefined (fail-closed,
 * bukan panel kosong).
 */
export function normalizeOrderPaymentIntent(raw: unknown): Omit<OrderPaymentIntent, "method"> | undefined {
  const record = asRecord(raw)
  if (!record) return undefined
  const nested =
    asRecord(record.payment) ?? asRecord(record.data) ?? asRecord(record.result) ?? record
  const qrString = pickString(nested, ["qrString", "qr_string", "qr", "qrCode", "qr_code"])
  const vaNumber = pickString(nested, [
    "vaNumber",
    "va_number",
    "virtualAccount",
    "virtual_account",
    "virtualAccountNumber",
    "accountNumber",
    "account_number",
    // Kontrak no-wallet: VA DANA dikembalikan sebagai `paymentCode`.
    "paymentCode",
    "payment_code",
  ])
  const redirectUrl = pickString(nested, [
    "redirectUrl",
    "redirect_url",
    "paymentUrl",
    "payment_url",
    "deeplink",
    "deepLink",
    // Kontrak no-wallet: otorisasi DANA Balance = `webRedirectUrl`.
    "webRedirectUrl",
    "web_redirect_url",
  ])
  if (!qrString && !vaNumber && !redirectUrl) return undefined
  const instructionsRaw = nested.instructions ?? nested.steps
  const instructions = Array.isArray(instructionsRaw)
    ? instructionsRaw.filter((s): s is string => typeof s === "string")
    : undefined
  const amount = toAmount(
    nested.amount ??
      nested.total ??
      nested.amountDue ??
      // Kontrak kanonis `DanaDirectPayResult` (2026-09-30): buyer membayar
      // `grossAmount` (escrow + fee provider); `escrowAmount` hanya porsi
      // yang masuk escrow. grossAmount diutamakan untuk tampilan tagihan.
      nested.grossAmount ??
      nested.gross_amount ??
      nested.escrowAmount ??
      nested.escrow_amount,
  )
  // SEC-404: nominal hilang/tidak-valid (<= 0) = respons malformed → tolak
  // seluruh intent (invalidResponse di pemanggil). JANGAN default ke 0:
  // panel VA/redirect akan mencetak "Rp0" padahal tagihan nyata bisa berbeda.
  if (amount == null || amount <= 0) return undefined
  return {
    qrString: qrString ?? undefined,
    qrUrl: pickString(nested, ["qrUrl", "qr_url", "url"]) ?? undefined,
    vaNumber: vaNumber ?? undefined,
    vaBankName: pickString(nested, ["vaBankName", "bankName", "bank_name", "bank"]) ?? undefined,
    accountName: pickString(nested, ["accountName", "account_name", "holderName"]) ?? undefined,
    redirectUrl: redirectUrl ?? undefined,
    // Kontrak kanonis (2026-09-30): backend mengirim `expiryTime`.
    expiresAt:
      pickString(nested, [
        "expiresAt",
        "expires_at",
        "expiredAt",
        "expired_at",
        "expiryTime",
        "expiry_time",
        "expiry",
      ]) ?? null,
    amount,
    paymentTxId: pickString(nested, ["paymentTxId", "payment_tx_id", "txId", "transactionId"]) ?? undefined,
    instructions,
  }
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
  // MFE-006: progres refund DANA-direct (async) — backend expose
  // `refundedAmount`/`refundReference` di `DanaDirectPayResult`. Dibaca dari
  // SEMUA level yang mungkin (record/nested/payment), konsisten dengan pola
  // pembacaan field lain di fungsi ini.
  const refundedAmount =
    numberField(nested, ["refundedAmount", "refunded_amount"]) ??
    numberField(record, ["refundedAmount", "refunded_amount"]) ??
    (deeper ? numberField(deeper, ["refundedAmount", "refunded_amount"]) : undefined) ??
    0
  const refundReference =
    pickString(nested, ["refundReference", "refund_reference"]) ??
    pickString(record, ["refundReference", "refund_reference"]) ??
    (deeper ? pickString(deeper, ["refundReference", "refund_reference"]) : undefined) ??
    null

  let status = rawStatus?.toUpperCase()
  // KONTRAK KANONIS (2026-09-30): backend memakai enum Prisma `PaymentStatus`
  // (PENDING|SUCCESS|FAILED|EXPIRED|CANCELLED|REFUNDED), bukan "PAID".
  // Tanpa pemetaan ini, pembayaran DANA yang sukses TIDAK PERNAH memicu
  // `onPaid` — polling berhenti di "SUCCESS" yang tidak dikenal.
  if (status === "SUCCESS") status = "PAID"
  // MFE-006: "REFUNDED" dipertahankan sebagai status terminal sendiri (BUKAN
  // dipetakan ke PAID/FAILED) — buyer harus melihat "dana dikembalikan RpX"
  // + referensi refund, bukan status sukses yang menyesatkan.
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
    // BFI-084: baca info refund aditif secara defensif — semua akses
    // optional. Backend belum mengirim `refund` → null, layar tidak
    // menampilkan apa-apa dan polling tetap jalan normal.
    refund: (() => {
      const refundRec = asRecord(nested.refund) ?? asRecord(record.refund)
      if (!refundRec) return null
      return {
        status: pickString(refundRec, ["refundStatus", "refund_status", "status"]) ?? null,
        amount: toAmount(
          refundRec.refundAmount ?? refundRec.refund_amount ?? refundRec.amount ?? refundRec.amountSen,
        ) ?? null,
        refundedAt: pickString(refundRec, ["refundedAt", "refunded_at", "refundedAtIso"]) ?? null,
        refundReference:
          pickString(refundRec, ["refundReference", "refund_reference", "refundNo", "referenceNo"]) ??
          null,
      }
    })(),
    // MFE-006: progres refund DANA-direct flat (dipakai hook/panel).
    refundedAmount,
    refundReference,
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
 * `/delivery-proof/confirm`. Sejak kontrak lintas tim 2026-09-27, body HANYA
 * boleh membawa `deviceLocation` opsional — validator backend menerimanya.
 */
export async function completeOrder(orderId: string, idempotencyKey?: string) {
  // R2 (audit ronde-2, butir #17): pelepasan dana berlindung idempotensi
  // (pola C-06 createOrder/payOrder) — aman bila backend mengabaikan header.
  // PERF-FIX (network P1): timeout interaktif 10 dtk (bukan 20 dtk) — mutasi
  // tidak pernah di-retry otomatis, jadi gagal cepat + ketuk ulang lebih
  // baik daripada menggantung 20 dtk; idempotency key mencegah ganda.
  const body = await deviceLocationOnlyBody()
  return http.post<Order, { deviceLocation: LocationDto | null }>(
    `/v1/orders/${seg(orderId)}/complete`,
    body,
    {
      auth: "required",
      timeoutMs: API_TIMEOUT_INTERACTIVE_MS,
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    },
  )
}

export async function cancelOrder(orderId: string, dto: CancelOrderDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.CancelOrderDto)
  const body = await withDeviceLocation(dto)
  return http.post<Order, WithDeviceLocation<CancelOrderDto>>(
    `/v1/orders/${seg(orderId)}/cancel`,
    body,
    {
      auth: "required",
    },
  )
}

export async function submitDispute(orderId: string, dto: SubmitDisputeDto) {
  const body = await withDeviceLocation(dto)
  return http.post<Dispute, WithDeviceLocation<SubmitDisputeDto>>(
    `/v1/orders/${seg(orderId)}/dispute`,
    body,
    {
      auth: "required",
    },
  )
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
            // BFI-138: BE mengirim baris mentah OrderStatusHistory —
            // `changedBy` (id user pengubah) & `changedByType` (peran:
            // BUYER/SELLER/ADMIN/SYSTEM). Tanpa alias ini actor selalu null.
            actor: pickString(item, ["actor", "actorRole", "actor_role", "changedByType", "changed_by_type"]) ?? null,
            actorId: pickString(item, ["actorId", "actor_id", "userId", "changedBy", "changed_by"]) ?? null,
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
