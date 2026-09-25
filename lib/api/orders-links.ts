/**
 * orders-links.ts — order link (buat, daftar milikku, detail/preview,
 * terima, batalkan). (R2 #97: pecahan facade orders.ts.)
 */
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { AMOUNT_LIMITS, assertDtoConstraints, assertValidAmount } from "@/lib/financial"
import { asRecord, invalidResponse, pickString, readPage } from "@/lib/api/response"
import { http, seg } from "@/lib/api/client"
import {
  normalizeOrder,
  toAmount,
  type FeeResponsibility,
  type Order,
  type OrderLink,
  type OrderRole,
  type OrderType,
  type PageQuery,
} from "@/lib/api/orders-shared"
import type { CreateOrderLinkDto } from "@/lib/api/types"

export function createOrderLink(dto: CreateOrderLinkDto, idempotencyKey?: string) {
  assertDtoConstraints(dto, API_CONSTRAINTS.CreateOrderLinkDto)
  assertValidAmount(dto.orderValue, AMOUNT_LIMITS.order)
  return http
    .post<unknown, CreateOrderLinkDto>("/v1/orders/links", dto, {
      auth: "required",
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    })
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
      // I-04: baris rusak dibuang per-entri (prinsip D-11) — bukan menjatuhkan
      // seluruh daftar tautan.
      return {
        ...page,
        data: page.data.flatMap((item) => {
          try {
            return [normalizeOrderLink(item)]
          } catch {
            return []
          }
        }),
      }
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
  const orderValueRaw = nested.orderValue ?? nested.order_value ?? nested.value
  // I-04 (audit end-to-end): nilai tautan yang ADA tapi tidak sah = PARSE —
  // dulu jatuh `?? 0` dan tautan dibagikan menampilkan "Rp0".
  const orderValue = orderValueRaw == null ? 0 : toAmount(orderValueRaw)
  if (orderValue === undefined) throw invalidResponse("order-link.orderValue")
  // I-11: `creator` dulu sengaja di-drop (`creator: undefined`) sehingga kartu
  // pratinjau selalu menampilkan "—" meski backend mengirim pihak pembuat.
  const creatorRecord =
    asRecord(nested.creator) ?? asRecord(nested.user) ?? asRecord(nested.createdBy)
  const creator = creatorRecord
    ? {
        id: String(creatorRecord.id ?? creatorRecord.userId ?? ""),
        username: typeof creatorRecord.username === "string" ? creatorRecord.username : "",
        fullName: typeof creatorRecord.fullName === "string" ? creatorRecord.fullName : undefined,
        avatarUrl: typeof creatorRecord.avatarUrl === "string" ? creatorRecord.avatarUrl : null,
      }
    : undefined
  return {
    token,
    url: pickString(nested, ["url", "linkUrl", "shareUrl"]) ?? undefined,
    role: (pickString(nested, ["role"]) ?? "SELLER") as OrderRole,
    title: pickString(nested, ["title", "name"]) ?? "",
    description: pickString(nested, ["description", "detail"]) ?? "",
    orderType: (pickString(nested, ["orderType", "order_type"]) ?? "OTHER") as OrderType,
    orderValue,
    deliveryDeadlineDays: toAmount(nested.deliveryDeadlineDays ?? nested.delivery_deadline_days) ?? 0,
    feeResponsibility: (pickString(nested, ["feeResponsibility", "fee_responsibility"]) ??
      "SPLIT") as FeeResponsibility,
    counterpartUsername:
      pickString(nested, ["counterpartUsername", "counterpart_username", "counterpart"]) ?? null,
    status: (pickString(nested, ["status", "state"]) ?? "ACTIVE") as OrderLink["status"],
    creator,
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
