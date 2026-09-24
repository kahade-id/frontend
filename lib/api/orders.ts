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

import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { assertDtoConstraints } from "@/lib/financial"
import { hasOwn } from "@/lib/has-own"

import {
  asRecord,
  invalidResponse,
  pickBoolean,
  pickNumber,
  pickString,
  pickUserId,
  readList,
  readPage,
  readEntity,
} from "@/lib/api/response"
import { AMOUNT_LIMITS, assertValidAmount } from "@/lib/financial"
import { http, seg } from "@/lib/api/client"
import { getSessionRevision } from "@/lib/api/session"
import { onQueryCacheInvalidation } from "@/lib/query-cache"
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
  // ── Enum backend (otoritatif) ────────────────────────────────────────────
  // Sumber: parameter `status` pada `/v1/admin/orders` di docs/api/openapi.json
  // — satu-satunya tempat spec mengekspor enum ini; spec mobile hanya menulis
  // "string". Dikonfirmasi pengguna: status nyata mencakup "menunggu
  // konfirmasi" dan "menunggu pembayaran", bukan hanya selesai/dibatalkan.
  | "WAITING_CONFIRMATION"
  | "WAITING_PAYMENT"
  | "PROCESSING"
  | "IN_DELIVERY"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED"
  // ── Alias lama ───────────────────────────────────────────────────────────
  // Union versi sebelumnya ditebak dari nama endpoint (create → pay → process
  // → shipping → delivery-proof) dan TIDAK cocok dengan enum backend, jadi
  // setiap gerbang aksi di layar detail order selalu evaluates false dan
  // tombol Bayar/Kirim/Konfirmasi tidak pernah muncul. Nilai lama dipertahankan
  // HANYA sebagai toleransi tampilan (label + tone tetap ada) supaya data lama
  // di cache tidak tampil sebagai enum mentah; jangan dipakai untuk logika baru.
  | "PENDING_PAYMENT"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
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

/**
 * Sengketa masuk akal sejak dana/order benar-benar berjalan: PAID/PROCESSING
 * sampai barang dinyatakan tiba (IN_DELIVERY), PLUS WAITING_CONFIRMATION
 * (A-05 audit escrow 2026-09-24) — order yang ditahan/ditolak diam-diam
 * penjual tetap butuh kanal klaim ("saya sudah janjian/transfer, penjual
 * tidak merespons"); `SubmitDisputeDto` tidak membatasi status. WAITING_PAYMENT
 * sengaja di luar: dananya belum ada, jadi yang benar adalah membatalkan.
 */
export function isDisputable(status: OrderStatus): boolean {
  return ["WAITING_CONFIRMATION", "PROCESSING", "IN_DELIVERY", "PAID", "SHIPPED", "DELIVERED"].includes(
    status,
  )
}

/**
 * Perpanjangan tenggat hanya selama pekerjaan belum dikirim.
 *
 * F-03 (audit escrow 2026-09-24): versi lama memuat `IN_DELIVERY`/`SHIPPED`
 * (barang sudah di jalan — memperpanjang tenggat kirim tidak ada gunanya) dan
 * tidak memuat alias konsisten `PENDING_PAYMENT`. Kini hanya fase pra-kirim
 * (menunggu pembayaran / pekerjaan berjalan) + alias lamanya.
 */
export function isExtendable(status: OrderStatus): boolean {
  return ["WAITING_PAYMENT", "PENDING_PAYMENT", "PROCESSING", "PAID"].includes(status)
}

/**
 * Pembatalan hanya selama barang BELUM dikirim — sesudahnya penyelesaian dana
 * lewat sengketa (adjudikasi), bukan tombol batal (A-04/A-06 audit escrow
 * 2026-09-24). Versi lama membuka "Batalkan" sampai DELIVERED sehingga dua CTA
 * destruktif (batal + sengketa) tampil berdampingan untuk order yang barangnya
 * sudah di jalan, dengan janji refund penuh yang belum tentu benar.
 * WAITING_CONFIRMATION ikut: order yang belum diterima penjual adalah kasus
 * pembatalan paling umum.
 */
export function isCancellable(status: OrderStatus): boolean {
  return ["WAITING_CONFIRMATION", "WAITING_PAYMENT", "PENDING_PAYMENT", "PROCESSING", "PAID"].includes(
    status,
  )
}

/**
 * Transisi "jalur bahagia" berikutnya — dipakai untuk estimasi durasi timeline.
 *
 * A-01/M-03 (audit escrow 2026-09-24): objek literal sebagai peta membuat
 * `nextOrderStatus("toString")` mengembalikan FUNGSI `Object.prototype` yang
 * lalu dirender React (crash "Functions are not valid as a React child").
 * Peta kini tanpa prototipe + `hasOwn`, dan return type `string | undefined`
 * (bukan `OrderStatus`) karena inputnya memang `(string & {})`.
 *
 * A-08: rantai alias lama (PENDING_PAYMENT → PAID → …) DIHAPUS —
 * `normalizeOrder` memetakan alias ke enum backend sekali di pintu masuk,
 * jadi cukup SATU rantai.
 */
const NEXT_STATUS_MAP: Record<string, OrderStatus> = Object.assign(Object.create(null), {
  WAITING_CONFIRMATION: "WAITING_PAYMENT",
  WAITING_PAYMENT: "PROCESSING",
  PROCESSING: "IN_DELIVERY",
  IN_DELIVERY: "COMPLETED",
})

export function nextOrderStatus(status: OrderStatus): string | undefined {
  return hasOwn(NEXT_STATUS_MAP, status) ? NEXT_STATUS_MAP[status as string] : undefined
}

export type Paginated<T> = {
  data: T[]
  /** M-01: `total` OPSIONAL — `readPage` memang mengembalikan `undefined` bila server tidak mengirim total. */
  meta: { page: number; limit: number; total?: number; totalPages: number }
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
/**
 * Status yang BOLEH dipakai sebagai filter `GET /v1/orders?status=` — hanya
 * enum backend, tanpa alias lama.
 *
 * Dipisah dari `ORDER_STATUSES` (yang ikut memuat alias lama demi toleransi
 * TAMPILAN) karena menurunkan chip filter dari peta label adalah persis
 * kesalahan yang membuat filter riwayat dompet mengirim nilai tak sah dan
 * ditolak 400 oleh backend. Urutannya = alur hidup order, jadi chip tersusun
 * seperti cerita transaksinya, bukan abjad.
 */
export const ORDER_STATUS_FILTERS = [
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT",
  "PROCESSING",
  "IN_DELIVERY",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[]

/**
 * Status CANONICAL enum backend, urut alur hidup (I-03 audit escrow 2026-09-24:
 * SATU deklarasi — `ORDER_STATUS_FILTERS`, `ORDER_STATUSES` (badge), dan
 * `NEXT_STATUS_MAP` di atas diturunkan/diurutkan dari daftar ini, bukan tiga
 * daftar yang harus disinkronkan manual).
 */
export const ORDER_LIFECYCLE = [
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT",
  "PROCESSING",
  "IN_DELIVERY",
  "COMPLETED",
] as const satisfies readonly OrderStatus[]

/**
 * Alias lama yang masih ditoleransi untuk TAMPILAN data cache (label+tone),
 * bukan untuk logika. `normalizeOrder` sudah memetakan ini ke enum backend —
 * daftar ini hanya cadangan terakhir bila nilai alias lolos tanpa normalisasi.
 */
export const LEGACY_ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "REFUNDED",
  "EXPIRED",
] as const satisfies readonly OrderStatus[]

export type OrderStatusFilter =
  | "ACTIVE"
  | "WAITING_CONFIRMATION"
  | "WAITING_PAYMENT"
  | "PROCESSING"
  | "IN_DELIVERY"
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
  /** A-10: kode voucher order asli — disertakan saat fee dihitung ulang. */
  voucherCode?: string | null
  /** A-03: pembayaran sudah masuk (penanda "WAITING_PAYMENT sudah dibayar"). */
  paidAt?: string | null
  createdAt: string
  updatedAt?: string
}

/**
 * Alias status lama → enum backend canonical (A-08 audit escrow 2026-09-24).
 * Dipetakan SEKALI di `normalizeOrder` sehingga cukup satu rantai status.
 */
const LEGACY_STATUS_ALIASES: Record<string, OrderStatus> = Object.assign(Object.create(null), {
  PENDING_PAYMENT: "WAITING_PAYMENT",
  PAID: "PROCESSING",
  SHIPPED: "IN_DELIVERY",
  DELIVERED: "IN_DELIVERY",
})

/** Pembaca teks toleran untuk field string-atau-null dari server. */
function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  return typeof value === "string" ? value : value == null ? null : String(value)
}

export function normalizeFeeBreakdown(raw: unknown): FeeBreakdown | undefined {
  const src = asRecord(raw)
  if (!src) return undefined
  // M-02: field uang memakai `toAmount` (Rupiah bulat; string numerik diterima,
  // desimal ditolak) — bukan cast bebas yang bisa menghasilkan `NaN`.
  const orderValue = toAmount(src.orderValue ?? src.order_value ?? src.value)
  const platformFee = toAmount(src.platformFee ?? src.platform_fee ?? src.fee ?? src.feeAmount)
  const buyerPays = toAmount(src.buyerPays ?? src.buyer_pays ?? src.totalBuyer ?? src.buyerTotal)
  const sellerReceives = toAmount(
    src.sellerReceives ?? src.seller_receives ?? src.sellerGets ?? src.seller_gets ?? src.totalSeller,
  )
  // Angka inti tidak lengkap → tolak (jangan beri `NaN` ke komponen uang).
  if (
    orderValue === undefined ||
    platformFee === undefined ||
    buyerPays === undefined ||
    sellerReceives === undefined
  )
    return undefined
  const discount = toAmount(src.discount ?? src.discountAmount ?? src.discount_amount ?? src.voucherDiscount)
  return {
    orderValue,
    platformFee,
    buyerPays,
    sellerReceives,
    discount,
    voucherCode: pickString(src, ["voucherCode", "voucher_code", "voucher"]) ?? null,
  }
}

/**
 * Normalizer `Order` — D-08 (audit escrow 2026-09-24).
 *
 * Versi lama menyebar `...raw` apa adanya: field tak dikenal/salah tipe ikut
 * masuk state (`fee.platformFee` string → `splitFee` menghasilkan `NaN` di
 * angka uang) sehingga tipe `Order` menjadi janji yang tidak ditegakkan.
 * Kini HANYA field yang dikenal yang diambil, dengan koersi yang aman, plus:
 *   - A-07: id numerik diterima sebagai string (dulu dibuang jadi `""`);
 *     entri tanpa id tetap `id: ""` dan DISARING di `listOrders` (D-11).
 *   - A-08: alias lama dipetakan ke enum backend sekali di sini.
 *   - A-10: `voucherCode` disimpan untuk perhitungan fee susulan.
 */
export function normalizeOrder(raw: Order & Record<string, unknown>): Order {
  const normalizeParty = (value: unknown): OrderParty | undefined => {
    if (!value || typeof value !== "object") return undefined
    const item = value as Record<string, unknown>
    const id = item.id ?? item.userId
    if (typeof id !== "string" && typeof id !== "number") return undefined
    return {
      id: String(id),
      username: typeof item.username === "string" ? item.username : "",
      fullName: typeof item.fullName === "string" ? item.fullName : undefined,
      avatarUrl: typeof item.avatarUrl === "string" ? item.avatarUrl : null,
    }
  }
  const record = raw as unknown as Record<string, unknown>
  const rawId = record.id ?? record.orderId
  const id =
    typeof rawId === "string"
      ? rawId
      : typeof rawId === "number" && Number.isFinite(rawId)
        ? String(rawId)
        : ""
  const rawStatus = pickString(record, ["status", "orderStatus"]) ?? ""
  const status = (hasOwn(LEGACY_STATUS_ALIASES, rawStatus)
    ? LEGACY_STATUS_ALIASES[rawStatus]
    : rawStatus) as OrderStatus
  const orderValue = toAmount(record.orderValue ?? record.order_value ?? record.value) ?? 0
  const deliveryDeadlineDays =
    toAmount(record.deliveryDeadlineDays ?? record.delivery_deadline_days) ?? 0
  return {
    id,
    title: typeof record.title === "string" ? record.title : "",
    description: typeof record.description === "string" ? record.description : "",
    orderType: (pickString(record, ["orderType", "order_type"]) ?? "OTHER") as OrderType,
    status,
    orderValue,
    feeResponsibility: (pickString(record, [
      "feeResponsibility",
      "fee_responsibility",
    ]) ?? "SPLIT") as FeeResponsibility,
    deliveryDeadlineDays,
    deliveryDeadlineAt: optionalText(record.deliveryDeadlineAt ?? record.delivery_deadline_at),
    buyer: normalizeParty(record.buyer),
    seller: normalizeParty(record.seller),
    myRole: (pickString(record, ["myRole", "role", "my_role"]) ?? undefined) as OrderRole | undefined,
    fee: normalizeFeeBreakdown(record.fee ?? record.feeBreakdown ?? record.fee_breakdown),
    trackingNumber: optionalText(record.trackingNumber ?? record.tracking_number),
    courierName: optionalText(record.courierName ?? record.courier_name),
    voucherCode: pickString(record, ["voucherCode", "voucher_code", "voucher"]) ?? null,
    paidAt: pickString(record, ["paidAt", "paid_at"]) ?? null,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
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
  user?: OrderParty & {
    kycVerified?: boolean
    trustScore?: number
    completedOrders?: number
    rating?: number
  }
  reason?: string
  /**
   * Backend bilang usernya tidak ada — BEDA dari "ada tapi tidak boleh
   * transaksi". Layar memetakan ini ke state `notFound`, bukan `blocked`.
   */
  notFound?: boolean
}

/**
 * Normalizer `POST /v1/orders/validate-counterpart`.
 *
 * Kenapa ini ada (cacat yang terbukti, bukan pencegahan): respons endpoint ini
 * dulu hanya di-CAST ke `CounterpartValidation` tanpa dinormalisasi, sementara
 * spec tidak mendokumentasikan bentuk respons sama sekali (lihat audit
 * docs/audit-escrow-mendalam-2026-09-24.md §D). Akibatnya bila backend mengirim
 * `{ isValid: true, … }` — atau `{ data: { valid: true } }` — maka `res.valid`
 * menjadi `undefined`, dan `app/create-transaction.tsx` memperlakukan nilai
 * falsy itu sebagai DIBLOKIR:
 *
 *     "Tidak dapat bertransaksi / Pengguna ini tidak tersedia untuk transaksi
 *      dengan Anda."
 *
 * …untuk SEMUA lawan transaksi, termasuk yang sah. Satu field yang namanya
 * berbeda membuat seluruh fitur buat-transaksi mati dengan pesan yang
 * menuduh pengguna lain.
 *
 * Aturan yang dipakai, dan kenapa:
 *   1. Flag valid dibaca dari banyak alias (`valid`, `isValid`, `is_valid`,
 *      `canTransact`, `allowed`).
 *   2. Bila TIDAK ADA flag eksplisit, jangan menyimpulkan "diblokir". Selama
 *      backend mengembalikan profil user dan tidak ada penanda blokir, hasilnya
 *      `valid: true` — server tetap pemutus akhir saat `POST /v1/orders`.
 *      Menolak di klien atas dasar tebakan lebih merusak daripada membiarkan
 *      server menolak dengan alasan yang benar.
 *   3. Penanda blokir eksplisit (`blocked`, `isBlocked`, `status: "BLOCKED"`,
 *      `suspended`) tetap dihormati → `valid: false`.
 *   4. "User tidak ada" dibedakan dari "user diblokir" lewat `notFound`, supaya
 *      copy UI tidak menuduh pemblokiran.
 */
export function normalizeCounterpartValidation(raw: unknown): CounterpartValidation {
  const root = asRecord(raw)
  const nested =
    asRecord(root?.validation) ?? asRecord(root?.result) ?? asRecord(root?.counterpart)
  const record = nested ? { ...root, ...nested } : (root ?? {})

  const userRecord =
    asRecord(record.user) ??
    asRecord(record.counterpart) ??
    asRecord(record.recipient) ??
    asRecord(record.profile)

  // D-10 (audit escrow 2026-09-24): flag `valid` yang JELAS ADA tapi tidak
  // bisa dibaca (mis. `"maybe"`) = respons rusak → PARSE error, BUKAN
  // kesimpulan negatif "pengguna tidak ditemukan" yang menuduh.
  const VALID_KEYS = ["valid", "isValid", "is_valid", "canTransact", "allowed"] as const
  const validKeyPresent = VALID_KEYS.some((key) => record[key] !== undefined)
  const explicit = pickBoolean(record, VALID_KEYS)
  if (validKeyPresent && explicit === undefined) throw invalidResponse("counterpart.valid")

  const blocked =
    pickBoolean(record, ["blocked", "isBlocked", "is_blocked", "suspended", "isSuspended"]) ??
    false
  const status = typeof record.status === "string" ? record.status.toUpperCase() : undefined
  const statusBlocked = status === "BLOCKED" || status === "SUSPENDED" || status === "BANNED"
  const notFoundFlag = pickBoolean(record, ["notFound", "not_found"])
  const userExists = pickBoolean(record, ["userExists", "user_exists", "exists"])
  const reason = pickString(record, ["reason", "message", "detail"])

  /**
   * D-09 (audit escrow 2026-09-24): `notFound` HANYA dari sinyal eksplisit.
   * Versi lama punya tebakan `!userRecord && explicit !== true && …` yang
   * mengklasifikasikan `{valid:false, reason:"Anda diblokir oleh pengguna ini"}`
   * sebagai "tidak ditemukan" — alasan asli dibuang dan pengguna dituduh salah
   * mengetik username. `valid:false` + `reason` = terblokir, dengan alasan
   * ditampilkan; respons tanpa apa pun sama sekali tetap "tidak ditemukan".
   */
  const notFound =
    notFoundFlag === true ||
    userExists === false ||
    status === "NOT_FOUND" ||
    (explicit === undefined && !userRecord && !blocked && !statusBlocked && !reason)

  const id = userRecord ? pickUserId(userRecord) : ""
  const user =
    userRecord && (id || pickString(userRecord, ["username"]))
      ? {
          id,
          username: pickString(userRecord, ["username", "handle"]) ?? "",
          fullName: pickString(userRecord, ["fullName", "full_name", "name"]),
          avatarUrl: pickString(userRecord, ["avatarUrl", "avatar_url", "avatar"]) ?? null,
          kycVerified: pickBoolean(userRecord, ["kycVerified", "isKycVerified", "verified"]),
          trustScore: numberField(userRecord, ["trustScore", "trust_score"]),
          completedOrders: numberField(userRecord, ["completedOrders", "totalOrdersCompleted"]),
          rating: numberField(userRecord, ["rating", "avgRating"]),
        }
      : undefined

  return {
    valid: blocked || statusBlocked ? false : (explicit ?? (Boolean(user) && !notFound)),
    user,
    reason,
    notFound: notFound || undefined,
  }
}

/**
 * B-13 (audit escrow 2026-09-24): statistik (`trustScore` dsb.) kini memakai
 * kebijakan yang SAMA dengan `pickNumber` — nilai salah tipe terlihat sebagai
 * `undefined`, bukan diam-diam dikoersi. Koersi string numerik hanya ada di
 * `toAmount` untuk field uang (dokumen pemisahannya ada di pemanggil).
 */
function numberField(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  return pickNumber(record, keys)
}

/**
 * GET /v1/orders/summary — bentuk ASLI backend (bukan per-status):
 * asBuyer/asSeller = jumlah order aktif per peran + nilai total, inDispute =
 * jumlah order berstatus DISPUTED (sebagai buyer ATAU seller),
 * pendingExtensions = request perpanjangan tenggat yang masih pending.
 */
export type OrderSummary = {
  asBuyer?: { count?: number; totalValue?: number }
  asSeller?: { count?: number; totalValue?: number }
  inDispute?: number
  pendingExtensions?: number
}

export type AverageDurations = Record<string, number>

export type PaymentStatus = {
  /**
   * C-01 (audit escrow 2026-09-24): `UNKNOWN` = respons tidak memuat status
   * yang bisa dibaca — JANGAN disamarkan menjadi `PENDING` (dulu polling QRIS
   * tidak pernah berhenti untuk respons error/tak berbentuk).
   */
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED" | "UNKNOWN" | (string & {})
  paidAt?: string | null
  method?: string | null
}

export type QrisPayment = {
  qrString: string
  qrUrl?: string
  /** C-03: bisa hilang dari respons — panel menampilkan QR tanpa countdown. */
  expiresAt?: string | null
  amount: number
  paymentTxId?: string
}

export type OrderHistoryEntry = {
  id: string
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  actor?: string | null
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
  /** F-06: pihak yang mengajukan — fallback ke peran bila server tidak mengirim. */
  requesterId?: string | null
  createdAt: string
}

export type DeliveryProof = {
  id: string
  description: string
  /**
   * L-01 (audit escrow 2026-09-24): untuk RESPONSE, isinya URL siap tampil
   * (server mengembalikan URL); DTO request `SubmitDeliveryProofDto.fileUrls`
   * yang berisi object key. Satu field untuk dua makna dibedakan di sini lewat
   * `normalizeDeliveryProof` — nilai bukan-URL tidak dijadikan `uri` gambar.
   */
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
  /** B-14: OPSIONAL — nomor asli dari server; klien TIDAK PERNAH mengarang nomor invoice. */
  invoiceNumber?: string
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
        .map(normalizeOrder)
        // D-11 (audit escrow 2026-09-24): baris tanpa id dibuang — dulu tampil
        // sebagai kartu valid yang setiap aksinya melempar `seg("")`.
        .filter((order) => order.id !== "")
      return { ...result, data }
    })
}

export function getOrder(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}`, { auth: "required", retry: 1, signal })
    .then((raw) => normalizeOrder(readEntity<Order & Record<string, unknown>>(raw, "order")))
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
  return http.post<Order, PayOrderDto>(`/v1/orders/${seg(orderId)}/pay`, dto, {
    auth: "required",
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  })
}

export function payOrderQris(orderId: string) {
  return http
    .post<unknown>(`/v1/orders/${seg(orderId)}/pay-qris`, undefined, {
      auth: "required",
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
  const paidAt =
    pickString(record, ["paidAt", "paid_at"]) ?? pickString(nested, ["paidAt", "paid_at"]) ?? null

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
    paidAt,
    method: pickString(record, ["method", "paymentMethod"]) ?? pickString(nested, ["method"]) ?? null,
  }
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

/**
 * A-13 (audit escrow 2026-09-24): rilis dana kini punya SATU kontrak —
 * `ConfirmDeliveryDto` (opsional `proofId` berpola `^c[a-z0-9]{24}$`).
 * Versi lama `completeOrder` tanpa body dan `confirmDelivery({proofId})`
 * adalah dua jalur rilis escrow yang tidak konsisten; keduanya kini
 * memakai DTO yang sama sehingga bukti yang direview bisa disertakan.
 */
export function completeOrder(orderId: string, dto: ConfirmDeliveryDto = {}) {
  return http.post<Order, ConfirmDeliveryDto>(`/v1/orders/${seg(orderId)}/complete`, dto, {
    auth: "required",
  })
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
            id: pickString(item, ["id", "historyId"]) ?? `h-${index}-${toStatus}`,
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

export function requestExtension(orderId: string, dto: RequestExtensionDto) {
  return http
    .post<unknown, RequestExtensionDto>(`/v1/orders/${seg(orderId)}/extensions`, dto, {
      auth: "required",
    })
    .then((raw) => normalizeOrderExtension(raw))
}

/**
 * D-03 (audit escrow 2026-09-24): akar sama dengan D-02 — cast polos membuat
 * daftar perpanjangan kosong SENYAP bila backend membungkus dengan kunci
 * `extensions`. Kini `readPage` + normalizer (F-06: `requesterId` dibaca).
 */
export function listExtensions(orderId: string, query: PageQuery, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/extensions`, {
      query,
      auth: "required",
      signal,
    })
    .then((raw) => {
      const page = readPage<OrderExtension & Record<string, unknown>>(raw, query, [
        "extensions",
        "requests",
      ])
      return { ...page, data: page.data.map(normalizeOrderExtension) }
    })
}

export function normalizeOrderExtension(raw: unknown): OrderExtension {
  const item = asRecord(raw) ?? {}
  return {
    id: pickString(item, ["id", "extensionId"]) ?? "",
    extensionDays: toAmount(item.extensionDays ?? item.extension_days ?? item.days) ?? 0,
    reason: pickString(item, ["reason", "note"]) ?? "",
    status: (pickString(item, ["status", "state"]) ?? "PENDING") as OrderExtension["status"],
    note: pickString(item, ["note", "rejectReason", "reject_reason"]) ?? null,
    requesterId: pickString(item, ["requesterId", "requester_id", "requestedBy", "userId"]) ?? null,
    createdAt: pickString(item, ["createdAt", "created_at"]) ?? "",
  }
}

export function respondExtension(orderId: string, extensionId: string, dto: RespondExtensionDto) {
  return http
    .put<unknown, RespondExtensionDto>(
      `/v1/orders/${seg(orderId)}/extensions/${seg(extensionId)}`,
      dto,
      { auth: "required" },
    )
    .then((raw) => normalizeOrderExtension(raw))
}

// ------------------------------------------------------------------
// Bukti pengiriman
// ------------------------------------------------------------------

export function submitDeliveryProof(orderId: string, dto: SubmitDeliveryProofDto) {
  return http
    .post<unknown, SubmitDeliveryProofDto>(`/v1/orders/${seg(orderId)}/delivery-proof`, dto, {
      auth: "required",
    })
    .then((raw) => normalizeDeliveryProof(raw))
}

/**
 * D-01 (audit escrow 2026-09-24): dulu `http.get<DeliveryProof[]>` cast polos —
 * bentuk `{proofs:[…]}`/`{data:[…]}` menjatuhkan SELURUH layar bukti
 * pengiriman ("ps is not iterable") dan escrow macet di IN_DELIVERY.
 * Kini `readList` + `normalizeDeliveryProof` (M-02: status dipaksa string
 * berhuruf besar agar "rejected" yang ejaannya beda tidak dianggap pending).
 */
export function listDeliveryProofs(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/delivery-proof`, {
      auth: "required",
      signal,
    })
    .then((raw) =>
      readList<unknown>(raw, ["deliveryProofs", "proofs"]).map(normalizeDeliveryProof),
    )
}

/**
 * M-02/L-01 (audit escrow 2026-09-24): normalizer bukti pengiriman.
 *   - `status` di-trim + uppercase (kasus salah eja paling lazim: case).
 *   - `fileUrls` dipertahankan apa adanya (URL siap tampil dari server);
 *     pemetaan "bukan URL = jangan dirender sebagai gambar" ada di layar.
 */
export function normalizeDeliveryProof(raw: unknown): DeliveryProof {
  const item = asRecord(raw) ?? {}
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v !== "") : []
  return {
    id: pickString(item, ["id", "proofId"]) ?? "",
    description: pickString(item, ["description", "note", "notes"]) ?? "",
    fileUrls: stringArray(item.fileUrls ?? item.file_urls ?? item.urls ?? item.files),
    linkUrls: stringArray(item.linkUrls ?? item.link_urls ?? item.links),
    status: (pickString(item, ["status", "state"]) ?? "SUBMITTED").trim().toUpperCase() as DeliveryProof["status"],
    note: pickString(item, ["note", "rejectReason", "reject_reason", "rejectionNote"]) ?? null,
    createdAt: pickString(item, ["createdAt", "created_at"]) ?? "",
  }
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
  return http
    .post<unknown, RejectDeliveryDto>(`/v1/orders/${seg(orderId)}/delivery-proof/reject`, dto, {
      auth: "required",
    })
    .then((raw) => normalizeDeliveryProof(raw))
}

// ------------------------------------------------------------------
// Order via Link
// ------------------------------------------------------------------

export function createOrderLink(dto: CreateOrderLinkDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.CreateOrderLinkDto)
  assertValidAmount(dto.orderValue, AMOUNT_LIMITS.order)
  return http
    .post<unknown, CreateOrderLinkDto>("/v1/orders/links", dto, { auth: "required" })
    .then((raw) => normalizeOrderLink(raw))
}

/**
 * D-04 (audit escrow 2026-09-24): akar sama dengan D-02/D-03 — cast polos
 * membuat daftar tautan kosong SENYAP dan pengguna membuat tautan ganda.
 */
export function listMyOrderLinks(query: PageQuery, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/orders/links/my", {
      query,
      auth: "required",
      signal,
    })
    .then((raw) => {
      const page = readPage<OrderLink & Record<string, unknown>>(raw, query, [
        "links",
        "orderLinks",
      ])
      return { ...page, data: page.data.map(normalizeOrderLink) }
    })
}

/**
 * D-06 (audit escrow 2026-09-24): `OrderLink` dinormalisasi — `token` adalah
 * identitas navigasi & pembayaran (`seg(undefined)` melempar di tengah aksi
 * Terima) sehingga TANPA token bukan tautan yang sah → PARSE error di pintu
 * masuk, bukan kegagalan diam-diam di tombol.
 */
export function normalizeOrderLink(raw: unknown): OrderLink {
  const item = asRecord(raw)
  if (!item) throw invalidResponse("order-link")
  const nested = asRecord(item.link) ?? asRecord(item.data) ?? item
  const token = pickString(nested, ["token", "linkToken", "link_token", "slug"])
  if (!token) throw invalidResponse("order-link.token")
  const orderValue = toAmount(nested.orderValue ?? nested.order_value ?? nested.value)
  return {
    token,
    url: pickString(nested, ["url", "linkUrl", "shareUrl"]) ?? undefined,
    role: (pickString(nested, ["role"]) ?? "SELLER") as OrderRole,
    title: pickString(nested, ["title", "name"]) ?? "",
    description: pickString(nested, ["description", "detail"]) ?? "",
    orderType: (pickString(nested, ["orderType", "order_type"]) ?? "OTHER") as OrderType,
    orderValue: orderValue ?? 0,
    deliveryDeadlineDays: toAmount(nested.deliveryDeadlineDays ?? nested.delivery_deadline_days) ?? 0,
    feeResponsibility: (pickString(nested, ["feeResponsibility", "fee_responsibility"]) ??
      "SPLIT") as FeeResponsibility,
    counterpartUsername:
      pickString(nested, ["counterpartUsername", "counterpart_username", "counterpart"]) ?? null,
    status: (pickString(nested, ["status", "state"]) ?? "ACTIVE") as OrderLink["status"],
    creator: undefined,
    orderId: pickString(nested, ["orderId", "order_id"]) ?? null,
    expiresAt: pickString(nested, ["expiresAt", "expires_at"]) ?? null,
    createdAt: pickString(nested, ["createdAt", "created_at"]) ?? "",
  }
}

export function getOrderLink(token: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/links/${seg(token)}`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => normalizeOrderLink(raw))
}

/**
 * F-01 (audit escrow 2026-09-24): pratinjau tautan untuk penerima TANPA akun.
 * Order link dirancang untuk lawan yang belum punya akun, tetapi layar terima
 * tautan dulu memanggil endpoint ber-auth — penerima di web tanpa sesi melihat
 * gate login dan alur akuisisi putus. Endpoint publik
 * `GET /v1/deeplinks/order-link/{token}` (`auth:"none"`) dipakai untuk
 * PRATINJAU; login tetap diminta saat menekan "Terima" (`acceptOrderLink`).
 * Bentuk respons deeplink tidak terdokumentasi — pemetaan bersifat toleran dan
 * cukup untuk menampilkan tautan + menerima.
 */
export function previewOrderLink(token: string, signal?: AbortSignal): Promise<OrderLink> {
  return http
    .get<unknown>(`/v1/deeplinks/order-link/${seg(token)}`, {
      auth: "none",
      retry: 1,
      signal,
    })
    .then((raw) => {
      const record = asRecord(raw)
      const linkLike = asRecord(record?.link) ?? asRecord(record?.orderLink) ?? record
      try {
        return normalizeOrderLink(linkLike)
      } catch {
        // Resolusi minimal: token dari pemanggil + status dari respons bila ada.
        return {
          token,
          role: "SELLER" as OrderRole,
          title: "",
          description: "",
          orderType: "OTHER" as OrderType,
          orderValue: 0,
          deliveryDeadlineDays: 0,
          feeResponsibility: "SPLIT" as FeeResponsibility,
          status: (pickString(linkLike ?? {}, ["status", "state"]) ?? "ACTIVE") as OrderLink["status"],
          orderId: pickString(linkLike ?? {}, ["orderId", "order_id"]) ?? null,
          createdAt: "",
        }
      }
    })
}

/** F-04: hasil accept dinormalisasi (dulu cast — `order.id` bisa `undefined`). */
export function acceptOrderLink(token: string) {
  return http
    .post<unknown>(`/v1/orders/links/${seg(token)}/accept`, undefined, { auth: "required" })
    .then((raw) => {
      const record = asRecord(raw)
      const orderLike = asRecord(record?.order) ?? record
      const order = normalizeOrder((orderLike ?? {}) as Order & Record<string, unknown>)
      return order
    })
}

/**
 * D-12 (audit escrow 2026-09-24): hasil `cancel` bisa `OrderLink` (dengan
 * `status` asli server) ATAU `{message}`. Helper ini mengekstrak status final
 * yang TERKONFIRMASI server — pemanggil tidak boleh meng-klaim "CANCELLED"
 * bila server mengirim status lain (mis. tautan sudah diterima).
 */
export type CancelOrderLinkResult = {
  /** Status dari server bila dikirim; `null` = server hanya mengakui lewat pesan. */
  status: OrderLink["status"] | null
  message?: string
}

export function cancelOrderLink(token: string) {
  return http
    .post<unknown>(`/v1/orders/links/${seg(token)}/cancel`, undefined, {
      auth: "required",
    })
    .then((raw): CancelOrderLinkResult => {
      const record = asRecord(raw)
      if (!record) return { status: null }
      const nested = asRecord(record.link) ?? record
      const status = pickString(nested, ["status", "state"])
      return {
        status: (status ?? null) as OrderLink["status"] | null,
        message: pickString(record, ["message", "detail"]) ?? undefined,
      }
    })
}

// ------------------------------------------------------------------
// Dokumen
// ------------------------------------------------------------------

/**
 * Angka uang dari backend: INTEGER Rupiah, atau string numerik bulat polos
 * ("15000", "-5000").
 *
 * B-09 (audit escrow 2026-09-24): desimal DITOLAK — seluruh app (dan
 * `lib/financial.assertValidAmount`) mengasumsikan Rupiah bulat; dulu
 * `1500.5` diterima lalu `formatRupiah` membundarkannya (`Rp1.501`) sehingga
 * angka struk ≠ angka transaksi. Nilai desimal kini terbaca sebagai "tidak
 * ada" (undefined) dan pemanggil memakai fallback eksplisitnya.
 */
export function toAmount(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^-?\d+$/.test(value.trim())
        ? Number(value.trim())
        : undefined
  return typeof n === "number" && Number.isSafeInteger(n) ? n : undefined
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

/**
 * Normalisasi invoice yang toleran (spec tanpa schema response).
 *
 * Sebelumnya `getInvoice` me-cast body mentah ke `Invoice`: satu kunci
 * bersarang (`{ invoice: {...} }`), penamaan berbeda (`number`, `lines`,
 * `totalAmount`), atau angka berbentuk string membuat layar melempar di
 * tengah render ("Gagal memuat" tanpa bisa pulih). Sekarang:
 *   - terima `{...}` langsung, `{ invoice: {...} }`, atau `{ data: {...} }`
 *   - fallback nama kunci yang lazim + koersi angka aman
 *   - total jatuh ke jumlah item bila tidak dikirim
 *   - order hilang → placeholder minimal (id terisi) supaya struk tetap
 *     bisa tampil dengan pihak "—"
 * Body yang tidak menyerupai invoice sama sekali tetap melempar
 * `invalidResponse` (PARSE) — lebih jujur daripada struk kosong.
 */
export function normalizeInvoice(raw: unknown, orderId: string): Invoice {
  const top = asRecord(raw)
  const src = asRecord(top?.invoice) ?? asRecord(top?.data) ?? top
  if (!src) throw invalidResponse("invoice")
  const pick = (...keys: string[]): unknown => {
    for (const key of keys) {
      const value = src[key]
      if (value !== undefined && value !== null) return value
    }
    return undefined
  }

  const invoiceNumber = firstString(
    pick("invoiceNumber", "number", "no", "invoiceNo", "invoice_number"),
  )

  const rawItems = pick("items", "lines", "details", "breakdown")
  const items = (Array.isArray(rawItems) ? rawItems : []).map((entry, index) => {
    const item = asRecord(entry) ?? {}
    return {
      label:
        firstString(item.label ?? item.title ?? item.name ?? item.description) ??
        `Item ${index + 1}`,
      // B-09: item non-integer dianggap tidak ada (0) — nilai desimal tidak
      // boleh beredar di struk yang dibaca sebagai dokumen finansial.
      amount: toAmount(item.amount ?? item.value ?? item.price ?? item.total ?? item.subtotal) ?? 0,
    }
  })

  const total =
    toAmount(pick("total", "totalAmount", "grandTotal", "grand_total", "amount")) ??
    items.reduce((sum, item) => sum + item.amount, 0)
  // B-08 (audit escrow 2026-09-24): total negatif = respons kacau (mis. refund
  // dikembalikan sebagai invoice) → TOLAK, jangan dirender sebagai struk sah.
  if (total < 0) throw invalidResponse("invoice.total")
  const issuedAt = firstString(pick("issuedAt", "issued_at", "createdAt", "created_at", "date")) ?? ""

  const rawOrder = pick("order", "orderDetail")
  const orderRecord = asRecord(rawOrder)
  const order: Order =
    orderRecord && (typeof orderRecord.id === "string" || typeof orderRecord.orderId === "string")
      ? normalizeOrder(orderRecord as Order & Record<string, unknown>)
      : {
          id: orderId,
          title: "",
          description: "",
          orderType: "OTHER",
          // B-14: placeholder TANPA status karangan ("UNKNOWN" di luar union) —
          // layar memperlakukannya sebagai "—".
          status: "",
          orderValue: total,
          feeResponsibility: "SPLIT",
          deliveryDeadlineDays: 0,
          createdAt: issuedAt,
        }

  if (!invoiceNumber && items.length === 0 && total === 0) throw invalidResponse("invoice")

  return {
    // B-14 (audit escrow 2026-09-24): nomor invoice TIDAK PERNAH dikarang
    // (`INV-${orderId}` sempat bisa disalin pengguna sebagai dokumen sah).
    invoiceNumber,
    order,
    issuedAt,
    items,
    total,
  }
}

export function getInvoice(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/orders/${seg(orderId)}/invoice`, {
      auth: "required",
      retry: 1,
      signal,
    })
    .then((raw) => normalizeInvoice(raw, orderId))
}

/**
 * HTML siap cetak — render di WebView atau kirim ke expo-print.
 *
 * D-14 (audit escrow 2026-09-24): isi DIVALIDASI sebagai dokumen HTML —
 * halaman error proxy/404 ber-HTML sempat tersimpan jadi "struk" dan dibagikan.
 *
 * L-02: konten DISANITASI (best-effort) sebelum disimpan/dibagikan —
 * `<script>`, `<iframe>`, dan handler `on*=` dibuang; tag skrip mati karena
 * berkas ini dibuka oleh program lain (share sheet/browser) yang tidak bisa
 * kita kendalikan. Untuk arsip yang sah, `getInvoicePdf` (O-04) lebih tepat.
 */
export function getReceiptHtml(orderId: string, signal?: AbortSignal) {
  return http
    .get<string>(`/v1/orders/${seg(orderId)}/receipt`, {
      auth: "required",
      responseType: "text",
      headers: { Accept: "text/html" },
      retry: 1,
      signal,
    })
    .then((html) => {
      if (typeof html !== "string" || !/<(?:!doctype|html|body|div|table)\b/i.test(html))
        throw invalidResponse("receipt")
      return sanitizeReceiptHtml(html)
    })
}

/** L-02: redaksi best-effort konten aktif dari struk HTML sebelum dibagikan. */
export function sanitizeReceiptHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
}

/**
 * O-04 (audit escrow 2026-09-24): `GET /v1/orders/{id}/invoice/pdf` — struk
 * PDF resmi untuk arsip finansial (spec punya endpoint-nya; klien lama hanya
 * memakai receipt HTML). `blob` dipakai karena isinya bukan JSON.
 */
export function getInvoicePdf(orderId: string, signal?: AbortSignal) {
  return http.get<Blob>(`/v1/orders/${seg(orderId)}/invoice/pdf`, {
    auth: "required",
    responseType: "blob",
    headers: { Accept: "application/pdf" },
    signal,
  })
}
