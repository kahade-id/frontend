/**
 * orders-shared.ts — bentuk data domain order: tipe respons (UNVERIFIED, lihat
 * catatan di facade), normalizer respons → tipe aman, dan helper status.
 *
 * R2 (audit ronde-2, butir #97): dipisah dari facade `orders.ts` (dulu 1.633
 * baris) — murni data shape, TANPA endpoint.
 */
import {
  asRecord,
  invalidResponse,
  pickBoolean,
  pickNumber,
  pickString,
  pickUserId,
} from "@/lib/api/response"
import { hasOwn } from "@/lib/has-own"
import type { CancelOrderDto, CreateOrderDto } from "@/lib/api/types"

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
  /**
   * I-05 (audit end-to-end): spek `GET /v1/orders` menyediakan filter rentang
   * (`from`/`to`) dan urutan (`sortBy`/`sortOrder`) yang dulu tidak diekspos
   * klien sama sekali. String tanggal ISO; opsional.
   */
  from?: string
  to?: string
  sortBy?: string
  sortOrder?: "ASC" | "DESC"
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
  // M-53 (audit end-to-end 2026-09-24, issue #77): `REFUNDED`/`EXPIRED` ADA di
  // `OrderStatusFilter` dan enum backend — dulu tidak punya chip, transaksi
  // yang direfund/kedaluwarsa tidak bisa difilter.
  "REFUNDED",
  "EXPIRED",
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
  /**
   * I-03 (audit end-to-end 2026-09-24): status SEBELUM alias A-08 dipetakan.
   * Gerbang aksi legacy (`canProcess` yang hanya berlaku di backend lama saat
   * status masih `PAID`) tidak bisa dibedakan dari `PROCESSING` hasil mapping
   * `PAID → PROCESSING` — tanpa jejak ini tombol "Mulai proses" (`POST
   * /orders/{id}/process`) mustahil muncul untuk backend legacy. Hanya untuk
   * LOGIKA gerbang; tampilan tetap memakai `status`.
   */
  rawStatus?: string
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
  /**
   * M-49 (audit end-to-end, issue #67): penanda order SUDAH dinilai — dipakai
   * guard anti-rating-ganda di `app/rate/[orderId].tsx`. Whitelist normalize
   * tanpa field ini membuat guard mustahil aktif (user bisa kirim ulasan dua
   * kali). Boolean strict (pickBoolean) — bukan truthy string.
   */
  rated?: boolean
  isRated?: boolean
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
  const orderValueRaw = record.orderValue ?? record.order_value ?? record.value
  // I-04 (audit end-to-end): nilai uang yang ADA tapi tidak sah (desimal/NaN)
  // TIDAK lagi dijadikan 0 diam-diam — angka palsu di kartu order adalah
  // cacat nominal. Tidak ada = 0 (daftar lama yang memang mengosongkan).
  const orderValue = orderValueRaw == null ? 0 : toAmount(orderValueRaw)
  if (orderValue === undefined) throw invalidResponse("order.orderValue")
  const deliveryDeadlineDays =
    toAmount(record.deliveryDeadlineDays ?? record.delivery_deadline_days) ?? 0
  return {
    id,
    title: typeof record.title === "string" ? record.title : "",
    description: typeof record.description === "string" ? record.description : "",
    orderType: (pickString(record, ["orderType", "order_type"]) ?? "OTHER") as OrderType,
    status,
    rawStatus: rawStatus || undefined,
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
    // M-49 (audit end-to-end, issue #67): penanda sudah-dinilai DIPERTAHANKAN
    // (boolean strict) — guard rating ganda di layar bergantung padanya.
    rated: pickBoolean(record, ["rated", "is_rated", "alreadyRated", "already_rated"]) ?? undefined,
    isRated: pickBoolean(record, ["isRated", "is_rated"]) ?? undefined,
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
  /**
   * I-02 (audit end-to-end 2026-09-24): respons TANPA sinyal apa pun (objek
   * kosong/null setelah dibuka) — status pemeriksaan TIDAK DIKETAHUI. Versi
   * lama memaksanya menjadi `notFound` ("user tidak ditemukan") yang tetap
   * sebuah vonis; layar memetakan flag ini ke state "error" (coba lagi).
   */
  unknown?: boolean
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
   * ditampilkan.
   *
   * I-02 (audit end-to-end): respons tanpa APA PUN sinyal kini `unknown: true`
   * (status tidak diketahui → layar "coba lagi"), bukan `notFound` — versi
   * lama memaksakan vonis "user tidak ditemukan" untuk objek kosong.
   */
  const noSignals =
    explicit === undefined && !userRecord && !blocked && !statusBlocked && !reason
  const notFound =
    notFoundFlag === true ||
    userExists === false ||
    status === "NOT_FOUND" ||
    (noSignals ? false : false)

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
    unknown: noSignals || undefined,
  }
}

/**
 * B-13 (audit escrow 2026-09-24): statistik (`trustScore` dsb.) kini memakai
 * kebijakan yang SAMA dengan `pickNumber` — nilai salah tipe terlihat sebagai
 * `undefined`, bukan diam-diam dikoersi. Koersi string numerik hanya ada di
 * `toAmount` untuk field uang (dokumen pemisahannya ada di pemanggil).
 */
export function numberField(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
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
  /**
   * M-06 (audit end-to-end 2026-09-24): flag boolean hasil pembacaan strict
   * (alias `is_paid|paid` / `is_expired|expired`, angka 0/1). `isPaid` juga
   * true bila `status` sudah `PAID` — dipakai hook QRIS (issue #8).
   */
  isPaid?: boolean
  isExpired?: boolean
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
  /**
   * M-19 (audit end-to-end, issue #63/#66/#101): status & fee IKUT tipe —
   * keduanya memang dihasilkan `normalizeInvoice` tapi hilang dari deklarasi,
   * sehingga layar tidak bisa memakainya tanpa cast. `status` bisa "" (B-14).
   */
  status?: string
  fee?: FeeBreakdown
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

export function toAmount(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^-?\d+$/.test(value.trim())
        ? Number(value.trim())
        : undefined
  return typeof n === "number" && Number.isSafeInteger(n) ? n : undefined
}

