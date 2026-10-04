/**
 * Kahade — domain `commerce` (batch 43, mega-batch 2026-09-28).
 *
 * Seluruh endpoint sisi commerce dari branch `mega/be-commerce` (komit
 * d420cf7, tsc 0, 90/90 test): tipe produk etalase, statistik & badge,
 * buku alamat, cicilan/DP via milestone, trending keywords, voucher seller,
 * booking jasa, SPK ringan, digital delivery, jastip, patungan.
 *
 * Prinsip: normalizer defensif (alias field) seperti domain lain; logika
 * uang/eligibility TIDAK dihitung ulang di klien — nilai server ditampilkan
 * apa adanya.
 */
import { http, seg } from "./client"
import { asRecord, pickBoolean, pickNumber, pickString, readList } from "./response"

// ------------------------------------------------------------------
// Item 1/8: field commerce produk (PATCH /v1/commerce/products/:id)
// ------------------------------------------------------------------

/** Tipe produk etalase — kontrak backend `ProductType`. */
export type ProductType = "JASA" | "FISIK" | "DIGITAL" | "LAINNYA"

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  JASA: "Jasa",
  FISIK: "Barang fisik",
  DIGITAL: "Produk digital",
  LAINNYA: "Lainnya",
}

export type UpdateProductCommerceDto = {
  productType?: ProductType
  /** Harga coret IDR (server mengonversi ke sen). null = hapus. */
  originalPriceIdr?: number | null
  /** Tenggat pengerjaan (hari) — wajib bila JASA. */
  serviceDeadlineDays?: number | null
  /** Info pengiriman digital (produk DIGITAL). */
  digitalDeliveryInfo?: string | null
  /** Jadwal publish (ISO). null = hapus jadwal. */
  scheduledAt?: string | null
}

/**
 * `originalPrice` dari backend berbentuk SEN (bigint → number di JSON).
 * Konversi defensif ke IDR.
 */
export function senToIdr(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value / 100
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    if (Number.isFinite(n)) return n / 100
  }
  return null
}

export type ProductCommerceFields = {
  id: string
  productType: ProductType | null
  /** Harga coret dalam IDR (null bila tidak diatur). */
  originalPriceIdr: number | null
  serviceDeadlineDays: number | null
  digitalDeliveryInfo: string | null
  scheduledAt: string | null
  isActive: boolean | null
}

export function normalizeProductCommerceFields(raw: unknown): ProductCommerceFields | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  const pt = pickString(record, ["productType"])
  return {
    id,
    productType: pt === "JASA" || pt === "FISIK" || pt === "DIGITAL" || pt === "LAINNYA" ? pt : null,
    originalPriceIdr: senToIdr(record.originalPrice),
    serviceDeadlineDays: pickNumber(record, ["serviceDeadlineDays"]) ?? null,
    digitalDeliveryInfo: pickString(record, ["digitalDeliveryInfo"]) ?? null,
    scheduledAt: pickString(record, ["scheduledAt"]) ?? null,
    isActive: pickBoolean(record, ["isActive"]) ?? null,
  }
}

export function updateProductCommerce(showcaseId: string, dto: UpdateProductCommerceDto) {
  return http
    .patch<unknown, UpdateProductCommerceDto>(`/v1/commerce/products/${seg(showcaseId)}`, dto, {
      auth: "required",
    })
    .then(normalizeProductCommerceFields)
}

/** POST /v1/commerce/products/:id/click — catat hit klik (publik). Fire-and-forget. */
export function recordProductClick(showcaseId: string) {
  return http
    .post<{ ok: boolean }>(`/v1/commerce/products/${seg(showcaseId)}/click`, undefined, { auth: "none" })
    .catch(() => ({ ok: false as boolean }))
}

// ------------------------------------------------------------------
// Item 5: statistik produk (pemilik) — GET /v1/commerce/products/:id/stats
// ------------------------------------------------------------------

export type ProductStats = {
  showcaseId: string
  views: number
  saves: number
  likes: number
  shares: number
  clicks: number
  hotViews: number
  purchases: number
  ordersTotal: number
}

export function normalizeProductStats(raw: unknown): ProductStats | null {
  const record = asRecord(raw)
  if (!record) return null
  const showcaseId = pickString(record, ["showcaseId", "id"])
  if (!showcaseId) return null
  return {
    showcaseId,
    views: pickNumber(record, ["views", "viewCount"]) ?? 0,
    saves: pickNumber(record, ["saves", "saveCount"]) ?? 0,
    likes: pickNumber(record, ["likes", "likeCount"]) ?? 0,
    shares: pickNumber(record, ["shares", "shareCount"]) ?? 0,
    clicks: pickNumber(record, ["clicks", "clickCount"]) ?? 0,
    hotViews: pickNumber(record, ["hotViews"]) ?? 0,
    purchases: pickNumber(record, ["purchases"]) ?? 0,
    ordersTotal: pickNumber(record, ["ordersTotal"]) ?? 0,
  }
}

export function getProductStats(showcaseId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/commerce/products/${seg(showcaseId)}/stats`, { auth: "required", retry: 1, signal })
    .then(normalizeProductStats)
}

// ------------------------------------------------------------------
// Item 7: badge produk — GET /v1/commerce/products/:id/badges (publik)
// ------------------------------------------------------------------

export type ProductBadge = "TERLARIS" | "DISKON"

export type ProductBadges = {
  showcaseId: string
  badges: ProductBadge[]
  completedOrders90d: number
}

export function normalizeProductBadges(raw: unknown): ProductBadges | null {
  const record = asRecord(raw)
  if (!record) return null
  const showcaseId = pickString(record, ["showcaseId", "id"])
  if (!showcaseId) return null
  const rawBadges = Array.isArray(record.badges) ? record.badges : []
  const badges = rawBadges.filter((b): b is ProductBadge => b === "TERLARIS" || b === "DISKON")
  return {
    showcaseId,
    badges,
    completedOrders90d: pickNumber(record, ["completedOrders90d"]) ?? 0,
  }
}

export function getProductBadges(showcaseId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/commerce/products/${seg(showcaseId)}/badges`, { auth: "optional", retry: 1, signal })
    .then(normalizeProductBadges)
}

// ------------------------------------------------------------------
// Item 2: buku alamat — /v1/addresses
// ------------------------------------------------------------------

export type AddressLabel = "RUMAH" | "KANTOR" | "LAINNYA"

export type Address = {
  id: string
  label: AddressLabel
  customLabel: string | null
  recipientName: string
  phone: string
  addressLine: string
  city: string
  province: string | null
  postalCode: string
  isDefault: boolean
  createdAt: string | null
}

export function addressLabelText(a: Pick<Address, "label" | "customLabel">): string {
  if (a.label === "LAINNYA" && a.customLabel) return a.customLabel
  return a.label === "RUMAH" ? "Rumah" : a.label === "KANTOR" ? "Kantor" : "Lainnya"
}

export function normalizeAddress(raw: unknown): Address | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  const label = pickString(record, ["label"])
  return {
    id,
    label: label === "KANTOR" || label === "LAINNYA" ? label : "RUMAH",
    customLabel: pickString(record, ["customLabel"]) ?? null,
    recipientName: pickString(record, ["recipientName"]) ?? "",
    phone: pickString(record, ["phone"]) ?? "",
    addressLine: pickString(record, ["addressLine"]) ?? "",
    city: pickString(record, ["city"]) ?? "",
    province: pickString(record, ["province"]) ?? null,
    postalCode: pickString(record, ["postalCode"]) ?? "",
    isDefault: pickBoolean(record, ["isDefault"]) ?? false,
    createdAt: pickString(record, ["createdAt"]) ?? null,
  }
}

export type CreateAddressDto = {
  label: AddressLabel
  customLabel?: string
  recipientName: string
  phone: string
  addressLine: string
  city: string
  province?: string
  postalCode: string
}

export type UpdateAddressDto = Partial<CreateAddressDto>

export function listAddresses(page = 1, limit = 20, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/addresses", { auth: "required", retry: 1, signal, query: { page, limit } })
    .then((raw) => readList<unknown>(raw, ["addresses", "items", "data"]).map(normalizeAddress).filter((a): a is Address => a !== null))
}

export function createAddress(dto: CreateAddressDto) {
  return http.post<unknown, CreateAddressDto>("/v1/addresses", dto, { auth: "required" }).then(normalizeAddress)
}

export function updateAddress(id: string, dto: UpdateAddressDto) {
  return http
    .patch<unknown, UpdateAddressDto>(`/v1/addresses/${seg(id)}`, dto, { auth: "required" })
    .then(normalizeAddress)
}

export function deleteAddress(id: string) {
  return http.delete<{ message?: string }>(`/v1/addresses/${seg(id)}`, { auth: "required", responseType: "json" })
}

export function setDefaultAddress(id: string) {
  return http
    .post<unknown>(`/v1/addresses/${seg(id)}/set-default`, undefined, { auth: "required" })
    .then(normalizeAddress)
}

// ------------------------------------------------------------------
// Item 3: cicilan/DP via milestone — POST /v1/commerce/installments/orders/:orderId/plan
// ------------------------------------------------------------------

export type CreateInstallmentPlanDto = {
  /** DP persen 0–90 (0 = tanpa DP, langsung cicilan). */
  dpPercent: number
  /** Jumlah cicilan setelah DP (1–12). */
  installmentCount: number
  /** Jarak antar cicilan (hari), default 30. */
  intervalDays?: number
  /** Opt-in eksplisit — wajib true. */
  agreed: boolean
}

/**
 * Jadwal cicilan hasil server — milestone yang dibuat. Bentuk diturunkan
 * dari respons `createMilestones` (server otoritatif; klien tidak menghitung
 * nominal sendiri).
 */
export type InstallmentMilestone = {
  id: string
  title: string
  description: string | null
  amountIdr: number | null
  deadline: string | null
  status: string | null
}

export function normalizeInstallmentMilestone(raw: unknown): InstallmentMilestone | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  return {
    id,
    title: pickString(record, ["title"]) ?? "",
    description: pickString(record, ["description"]) ?? null,
    amountIdr: pickNumber(record, ["amountIdr", "amount"]) ?? null,
    deadline: pickString(record, ["deadline", "deadlineAt"]) ?? null,
    status: pickString(record, ["status"]) ?? null,
  }
}

export function createInstallmentPlan(orderId: string, dto: CreateInstallmentPlanDto) {
  return http
    .post<unknown, CreateInstallmentPlanDto>(`/v1/commerce/installments/orders/${seg(orderId)}/plan`, dto, {
      auth: "required",
    })
    .then((raw) =>
      readList<unknown>(raw, ["milestones", "items", "data"])
        .map(normalizeInstallmentMilestone)
        .filter((m): m is InstallmentMilestone => m !== null),
    )
}

// ------------------------------------------------------------------
// Item 6: trending keywords — /v1/commerce/trends
// ------------------------------------------------------------------

export type SearchTrend = { keyword: string; searchCount: number }

export function normalizeSearchTrend(raw: unknown): SearchTrend | null {
  const record = asRecord(raw)
  if (!record) return null
  const keyword = pickString(record, ["keyword"])
  if (!keyword) return null
  return { keyword, searchCount: pickNumber(record, ["searchCount", "count"]) ?? 0 }
}

/** Catat kata kunci pencarian (disanitasi server, tanpa PII). Best-effort. */
export function recordSearchTrend(keyword: string) {
  const q = keyword.trim()
  if (!q) return Promise.resolve({ ok: true as boolean, recorded: false as boolean })
  return http
    .post<{ ok: boolean; recorded: boolean }, { keyword: string }>(
      "/v1/commerce/trends/record",
      { keyword: q.slice(0, 80) },
      { auth: "none" },
    )
    .catch(() => ({ ok: false as boolean, recorded: false as boolean }))
}

export function getSearchTrends(limit = 10, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/commerce/trends", { auth: "none", retry: 1, signal, query: { limit } })
    .then((raw) =>
      readList<unknown>(raw, ["trends", "items", "data"])
        .map(normalizeSearchTrend)
        .filter((t): t is SearchTrend => t !== null),
    )
}

// ------------------------------------------------------------------
// Item 9: voucher seller — /v1/seller-vouchers
// ------------------------------------------------------------------

export type SellerVoucherType = "NOMINAL" | "PERSEN"

export type SellerVoucher = {
  id: string
  code: string
  name: string
  description: string | null
  voucherType: SellerVoucherType
  discountAmountIdr: number | null
  discountPercent: number | null
  maxDiscountAmountIdr: number | null
  maxUsageTotal: number | null
  maxUsagePerUser: number | null
  minOrderValueIdr: number | null
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  usedCount: number | null
}

export function normalizeSellerVoucher(raw: unknown): SellerVoucher | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  const code = pickString(record, ["code"])
  if (!id || !code) return null
  const voucherType = pickString(record, ["voucherType"])
  return {
    id,
    code,
    name: pickString(record, ["name", "title"]) ?? code,
    description: pickString(record, ["description"]) ?? null,
    voucherType: voucherType === "PERSEN" ? "PERSEN" : "NOMINAL",
    discountAmountIdr: pickNumber(record, ["discountAmountIdr", "discountAmount"]) ?? null,
    discountPercent: pickNumber(record, ["discountPercent"]) ?? null,
    maxDiscountAmountIdr: pickNumber(record, ["maxDiscountAmountIdr", "maxDiscountAmount"]) ?? null,
    maxUsageTotal: pickNumber(record, ["maxUsageTotal"]) ?? null,
    maxUsagePerUser: pickNumber(record, ["maxUsagePerUser"]) ?? null,
    minOrderValueIdr: pickNumber(record, ["minOrderValueIdr", "minOrderValue"]) ?? null,
    validFrom: pickString(record, ["validFrom"]) ?? null,
    validUntil: pickString(record, ["validUntil", "expiresAt"]) ?? null,
    isActive: pickBoolean(record, ["isActive", "active"]) ?? true,
    usedCount: pickNumber(record, ["usedCount", "usageCount"]) ?? null,
  }
}

export type CreateSellerVoucherDto = {
  code: string
  name: string
  description?: string
  voucherType: SellerVoucherType
  discountAmountIdr?: number
  discountPercent?: number
  maxDiscountAmountIdr?: number
  maxUsageTotal?: number
  maxUsagePerUser?: number
  minOrderValueIdr?: number
  validFrom: string
  validUntil: string
}

export function createSellerVoucher(dto: CreateSellerVoucherDto) {
  return http
    .post<unknown, CreateSellerVoucherDto>("/v1/seller-vouchers", dto, { auth: "required" })
    .then(normalizeSellerVoucher)
}

export function listMySellerVouchers(page = 1, limit = 20, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/seller-vouchers/mine", { auth: "required", retry: 1, signal, query: { page, limit } })
    .then((raw) =>
      readList<unknown>(raw, ["vouchers", "items", "data"])
        .map(normalizeSellerVoucher)
        .filter((v): v is SellerVoucher => v !== null),
    )
}

export type SellerVoucherValidation = {
  valid: boolean
  code: string | null
  name: string | null
  /** Nominal diskon IDR dari server. */
  discountIdr: number | null
  message: string | null
}

export function validateSellerVoucher(code: string, orderValueIdr: number, sellerId: string) {
  return http
    .post<unknown, { code: string; orderValueIdr: number; sellerId: string }>(
      "/v1/seller-vouchers/validate",
      { code, orderValueIdr, sellerId },
      { auth: "required" },
    )
    .then((raw) => {
      const record = asRecord(raw) ?? {}
      return {
        valid: pickBoolean(record, ["valid", "isValid"]) ?? false,
        code: pickString(record, ["code"]) ?? null,
        name: pickString(record, ["name"]) ?? null,
        discountIdr: pickNumber(record, ["discountIdr", "discountAmountIdr", "discountAmount"]) ?? null,
        message: pickString(record, ["message", "reason"]) ?? null,
      } satisfies SellerVoucherValidation
    })
}

export function deactivateSellerVoucher(id: string) {
  return http.patch<unknown>(`/v1/seller-vouchers/${seg(id)}/deactivate`, undefined, { auth: "required" })
}

// ------------------------------------------------------------------
// Item 10: booking jasa — /v1/commerce/service-slots
// ------------------------------------------------------------------

export type ServiceSlot = {
  id: string
  showcaseId: string
  slotDate: string
  startTime: string
  endTime: string
  capacity: number
  bookedCount: number
  remaining: number | null
  note: string | null
  isActive: boolean
}

export function normalizeServiceSlot(raw: unknown): ServiceSlot | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  const capacity = pickNumber(record, ["capacity"]) ?? 1
  const bookedCount = pickNumber(record, ["bookedCount"]) ?? 0
  return {
    id,
    showcaseId: pickString(record, ["showcaseId"]) ?? "",
    slotDate: pickString(record, ["slotDate"]) ?? "",
    startTime: pickString(record, ["startTime"]) ?? "",
    endTime: pickString(record, ["endTime"]) ?? "",
    capacity,
    bookedCount,
    remaining: pickNumber(record, ["remaining"]) ?? Math.max(0, capacity - bookedCount),
    note: pickString(record, ["note"]) ?? null,
    isActive: pickBoolean(record, ["isActive"]) ?? true,
  }
}

export type CreateServiceSlotDto = {
  showcaseId: string
  /** Tanggal slot (YYYY-MM-DD, WIB). */
  slotDate: string
  /** Jam mulai HH:mm. */
  startTime: string
  /** Jam selesai HH:mm. */
  endTime: string
  capacity?: number
  note?: string
}

export function createServiceSlot(dto: CreateServiceSlotDto) {
  return http
    .post<unknown, CreateServiceSlotDto>("/v1/commerce/service-slots", dto, { auth: "required" })
    .then(normalizeServiceSlot)
}

export function listServiceSlots(showcaseId: string, from?: string, page = 1, limit = 50, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/commerce/service-slots/showcase/${seg(showcaseId)}`, {
      auth: "optional",
      retry: 1,
      signal,
      query: { ...(from ? { from } : {}), page, limit },
    })
    .then((raw) =>
      readList<unknown>(raw, ["slots", "items", "data"]).map(normalizeServiceSlot).filter((s): s is ServiceSlot => s !== null),
    )
}

export function deleteServiceSlot(id: string) {
  return http.delete<{ id?: string }>(`/v1/commerce/service-slots/${seg(id)}`, { auth: "required", responseType: "json" })
}

export type SlotBooking = {
  id: string
  slotId: string
  userId: string
  status: string | null
  createdAt: string | null
  /**
   * Poin 2 (2026-10-04): order escrow yang dibayar untuk booking ini —
   * pintu masuk sengketa/retur hanya tampil bila terisi.
   */
  orderId: string | null
  slot?: ServiceSlot | null
}

export function normalizeSlotBooking(raw: unknown): SlotBooking | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  return {
    id,
    slotId: pickString(record, ["slotId"]) ?? "",
    userId: pickString(record, ["userId"]) ?? "",
    status: pickString(record, ["status"]) ?? null,
    createdAt: pickString(record, ["createdAt"]) ?? null,
    orderId: pickString(record, ["orderId"]) ?? null,
    slot: asRecord(record.slot) ? normalizeServiceSlot(record.slot) : null,
  }
}

export function bookServiceSlot(id: string) {
  return http
    .post<unknown>(`/v1/commerce/service-slots/${seg(id)}/book`, undefined, { auth: "required" })
    .then(normalizeSlotBooking)
}

export function listMySlotBookings(page = 1, limit = 20, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/commerce/service-slots/bookings/mine", { auth: "required", retry: 1, signal, query: { page, limit } })
    .then((raw) =>
      readList<unknown>(raw, ["bookings", "items", "data"])
        .map(normalizeSlotBooking)
        .filter((b): b is SlotBooking => b !== null),
    )
}

export function cancelSlotBooking(bookingId: string) {
  return http.post<unknown>(`/v1/commerce/service-slots/bookings/${seg(bookingId)}/cancel`, undefined, { auth: "required" })
}

// ------------------------------------------------------------------
// Item 11: SPK ringan — /v1/commerce/agreements
// ------------------------------------------------------------------

export type AgreementStatus = "DRAFT" | "WAITING_COUNTERPART" | "AGREED" | "CANCELLED"

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  DRAFT: "Draf",
  WAITING_COUNTERPART: "Menunggu pihak lain",
  AGREED: "Disetujui kedua pihak",
  CANCELLED: "Dibatalkan",
}

export type OrderAgreement = {
  id: string
  orderId: string
  text: string
  status: AgreementStatus
  createdBy: string | null
  sellerAgreedAt: string | null
  buyerAgreedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export function normalizeOrderAgreement(raw: unknown): OrderAgreement | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  const status = pickString(record, ["status"])
  return {
    id,
    orderId: pickString(record, ["orderId"]) ?? "",
    text: pickString(record, ["text"]) ?? "",
    status: status === "AGREED" || status === "CANCELLED" || status === "DRAFT" ? status : "WAITING_COUNTERPART",
    createdBy: pickString(record, ["createdBy"]) ?? null,
    sellerAgreedAt: pickString(record, ["sellerAgreedAt"]) ?? null,
    buyerAgreedAt: pickString(record, ["buyerAgreedAt"]) ?? null,
    createdAt: pickString(record, ["createdAt"]) ?? null,
    updatedAt: pickString(record, ["updatedAt"]) ?? null,
  }
}

export function createAgreement(orderId: string, text: string) {
  return http
    .post<unknown, { orderId: string; text: string }>("/v1/commerce/agreements", { orderId, text }, { auth: "required" })
    .then(normalizeOrderAgreement)
}

export function getAgreement(orderId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/commerce/agreements/orders/${seg(orderId)}`, { auth: "required", retry: 1, signal })
    .then(normalizeOrderAgreement)
}

export function agreeAgreement(orderId: string) {
  return http
    .post<unknown>(`/v1/commerce/agreements/orders/${seg(orderId)}/agree`, undefined, { auth: "required" })
    .then(normalizeOrderAgreement)
}

export function cancelAgreement(orderId: string) {
  return http
    .post<unknown>(`/v1/commerce/agreements/orders/${seg(orderId)}/cancel`, undefined, { auth: "required" })
    .then(normalizeOrderAgreement)
}

// ------------------------------------------------------------------
// Item 12: digital delivery — /v1/commerce/digital-assets
// ------------------------------------------------------------------

export type DigitalAssetType = "FILE" | "LINK" | "LICENSE"

export const DIGITAL_ASSET_TYPE_LABELS: Record<DigitalAssetType, string> = {
  FILE: "File",
  LINK: "Tautan",
  LICENSE: "Kode lisensi",
}

export type DigitalAsset = {
  id: string
  showcaseId: string
  assetType: DigitalAssetType
  /** FILE=fileKey upload, LINK=URL, LICENSE=kode lisensi. */
  payload: string
  label: string | null
  sortOrder: number | null
}

export function normalizeDigitalAsset(raw: unknown): DigitalAsset | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  const assetType = pickString(record, ["assetType"])
  return {
    id,
    showcaseId: pickString(record, ["showcaseId"]) ?? "",
    assetType: assetType === "LINK" || assetType === "LICENSE" ? assetType : "FILE",
    payload: pickString(record, ["payload"]) ?? "",
    label: pickString(record, ["label"]) ?? null,
    sortOrder: pickNumber(record, ["sortOrder"]) ?? null,
  }
}

export type CreateDigitalAssetDto = {
  showcaseId: string
  assetType: DigitalAssetType
  payload: string
  label?: string
}

export function createDigitalAsset(dto: CreateDigitalAssetDto) {
  return http
    .post<unknown, CreateDigitalAssetDto>("/v1/commerce/digital-assets", dto, { auth: "required" })
    .then(normalizeDigitalAsset)
}

export function listSellerDigitalAssets(showcaseId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/commerce/digital-assets/showcase/${seg(showcaseId)}/seller`, { auth: "required", retry: 1, signal })
    .then((raw) =>
      readList<unknown>(raw, ["assets", "items", "data"])
        .map(normalizeDigitalAsset)
        .filter((a): a is DigitalAsset => a !== null),
    )
}

export function deleteDigitalAsset(id: string) {
  return http.delete<{ message?: string }>(`/v1/commerce/digital-assets/${seg(id)}`, { auth: "required", responseType: "json" })
}

/** Buyer: aset hanya terlihat SETELAH order berbayar (server fail-closed bila belum). */
export function listBuyerDigitalAssets(showcaseId: string, signal?: AbortSignal) {
  return http
    .get<unknown>(`/v1/commerce/digital-assets/showcase/${seg(showcaseId)}`, { auth: "required", retry: 1, signal })
    .then((raw) =>
      readList<unknown>(raw, ["assets", "items", "data"])
        .map(normalizeDigitalAsset)
        .filter((a): a is DigitalAsset => a !== null),
    )
}

// ------------------------------------------------------------------
// Item 13: jastip — /v1/jastip
// ------------------------------------------------------------------

/**
 * Selaras enum backend `JastipTripStatus` (DRAFT|OPEN|CLOSED|COMPLETED|CANCELLED).
 *
 * ESI-009 (audit integrasi 2026-09-30): `FAILED` adalah inventaris FE yang
 * tak pernah dikirim backend — dihapus; `CANCELLED` resmi backend
 * ditambahkan. Sebelumnya trip CANCELLED dinormalisasi paksa ke "DRAFT"
 * (tampil sebagai "Draf", menyesatkan).
 */
export type JastipTripStatus = "DRAFT" | "OPEN" | "CLOSED" | "COMPLETED" | "CANCELLED"
/**
 * Selaras enum backend `JastipParticipantStatus`
 * (JOINED|PRICE_LOCKED|PAID|REFUNDED|REFUND_REQUIRED|COMPLETED|CANCELLED).
 *
 * ESI-011 (audit integrasi 2026-09-30): `REFUND_REQUIRED` (fail-closed —
 * peserta berhak atas refund) & `COMPLETED` ditambahkan; sebelumnya tampil
 * sebagai enum mentah.
 */
export type JastipParticipantStatus =
  | "JOINED"
  | "PRICE_LOCKED"
  | "PAID"
  | "REFUNDED"
  | "REFUND_REQUIRED"
  | "COMPLETED"
  | "CANCELLED"

export const JASTIP_TRIP_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draf",
  OPEN: "Dibuka",
  CLOSED: "Ditutup",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
}

export const JASTIP_PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  JOINED: "Bergabung",
  PRICE_LOCKED: "Harga dikunci",
  PAID: "Sudah bayar",
  REFUNDED: "Dana kembali",
  REFUND_REQUIRED: "Perlu refund",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
}

export type JastipItem = {
  id: string
  name: string
  estimatedPriceIdr: number | null
  note: string | null
}

export type JastipParticipant = {
  id: string
  buyerId: string
  itemSummary: string
  goodsAmountIdr: number | null
  jastipFeeIdr: number | null
  shippingCostIdr: number | null
  totalLockedIdr: number | null
  priceLockedAt: string | null
  orderId: string | null
  status: JastipParticipantStatus
  createdAt: string | null
}

export function normalizeJastipParticipant(raw: unknown): JastipParticipant | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  const status = pickString(record, ["status"]) ?? "JOINED"
  return {
    id,
    buyerId: pickString(record, ["buyerId"]) ?? "",
    itemSummary: pickString(record, ["itemSummary"]) ?? "",
    goodsAmountIdr: pickNumber(record, ["goodsAmountIdr"]) ?? null,
    jastipFeeIdr: pickNumber(record, ["jastipFeeIdr"]) ?? null,
    shippingCostIdr: pickNumber(record, ["shippingCostIdr"]) ?? null,
    totalLockedIdr: pickNumber(record, ["totalLockedIdr"]) ?? null,
    priceLockedAt: pickString(record, ["priceLockedAt"]) ?? null,
    orderId: pickString(record, ["orderId"]) ?? null,
    status:
      status === "JOINED" ||
      status === "PRICE_LOCKED" ||
      status === "PAID" ||
      status === "REFUNDED" ||
      status === "REFUND_REQUIRED" ||
      status === "COMPLETED" ||
      status === "CANCELLED"
        ? (status as JastipParticipantStatus)
        : "JOINED",
    createdAt: pickString(record, ["createdAt"]) ?? null,
  }
}

export type JastipTrip = {
  id: string
  hostId: string
  title: string
  description: string | null
  orderDeadline: string | null
  slotTotal: number | null
  status: JastipTripStatus
  items: JastipItem[]
  participants: JastipParticipant[]
  createdAt: string | null
}

export function normalizeJastipTrip(raw: unknown): JastipTrip | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  const status = pickString(record, ["status"]) ?? "DRAFT"
  const items = (Array.isArray(record.items) ? record.items : [])
    .map((it) => {
      const r = asRecord(it)
      if (!r) return null
      return {
        id: pickString(r, ["id"]) ?? "",
        name: pickString(r, ["name"]) ?? "",
        estimatedPriceIdr: pickNumber(r, ["estimatedPriceIdr"]) ?? null,
        note: pickString(r, ["note"]) ?? null,
      } satisfies JastipItem
    })
    .filter((i): i is JastipItem => i !== null)
  return {
    id,
    hostId: pickString(record, ["hostId"]) ?? "",
    title: pickString(record, ["title"]) ?? "",
    description: pickString(record, ["description"]) ?? null,
    orderDeadline: pickString(record, ["orderDeadline"]) ?? null,
    slotTotal: pickNumber(record, ["slotTotal"]) ?? null,
    status: ["DRAFT", "OPEN", "CLOSED", "COMPLETED", "CANCELLED"].includes(status) ? (status as JastipTripStatus) : "DRAFT",
    items,
    participants: (Array.isArray(record.participants) ? record.participants : [])
      .map(normalizeJastipParticipant)
      .filter((p): p is JastipParticipant => p !== null),
    createdAt: pickString(record, ["createdAt"]) ?? null,
  }
}

export type CreateJastipTripDto = {
  title: string
  description?: string
  orderDeadline: string
  slotTotal?: number
}

export function createJastipTrip(dto: CreateJastipTripDto) {
  return http.post<unknown, CreateJastipTripDto>("/v1/jastip/trips", dto, { auth: "required" }).then(normalizeJastipTrip)
}

export function listMyJastipTrips(page = 1, limit = 20, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/jastip/trips/mine", { auth: "required", retry: 1, signal, query: { page, limit } })
    .then((raw) =>
      readList<unknown>(raw, ["trips", "items", "data"]).map(normalizeJastipTrip).filter((t): t is JastipTrip => t !== null),
    )
}

export function getJastipTrip(id: string, signal?: AbortSignal) {
  return http.get<unknown>(`/v1/jastip/trips/${seg(id)}`, { auth: "required", retry: 1, signal }).then(normalizeJastipTrip)
}

export function openJastipTrip(id: string) {
  return http.post<unknown>(`/v1/jastip/trips/${seg(id)}/open`, undefined, { auth: "required" }).then(normalizeJastipTrip)
}

export function addJastipItem(id: string, dto: { name: string; estimatedPriceIdr?: number; note?: string }) {
  return http
    .post<unknown, { name: string; estimatedPriceIdr?: number; note?: string }>(`/v1/jastip/trips/${seg(id)}/items`, dto, {
      auth: "required",
    })
    .then((raw) => {
      const r = asRecord(raw) ?? {}
      return {
        id: pickString(r, ["id"]) ?? "",
        name: pickString(r, ["name"]) ?? dto.name,
        estimatedPriceIdr: pickNumber(r, ["estimatedPriceIdr"]) ?? dto.estimatedPriceIdr ?? null,
        note: pickString(r, ["note"]) ?? dto.note ?? null,
      } satisfies JastipItem
    })
}

export function joinJastipTrip(id: string, itemSummary: string) {
  return http
    .post<unknown, { itemSummary: string }>(`/v1/jastip/trips/${seg(id)}/join`, { itemSummary }, { auth: "required" })
    .then(normalizeJastipParticipant)
}

export function lockJastipPrice(participantId: string, dto: { goodsAmountIdr: number; jastipFeeIdr: number; shippingCostIdr: number }) {
  return http
    .post<unknown, { goodsAmountIdr: number; jastipFeeIdr: number; shippingCostIdr: number }>(
      `/v1/jastip/participants/${seg(participantId)}/lock-price`,
      dto,
      { auth: "required" },
    )
    .then(normalizeJastipParticipant)
}

export function linkJastipOrder(participantId: string, orderId: string) {
  return http
    .post<unknown, { orderId: string }>(`/v1/jastip/participants/${seg(participantId)}/link-order`, { orderId }, { auth: "required" })
    .then(normalizeJastipParticipant)
}

/**
 * Poin 2 (2026-10-04, unifikasi transaksi escrow): order escrow untuk
 * partisipasi jastip DIBUAT LALU DIDAFTARKAN otomatis — create-transaction
 * memanggil endpoint ini dengan `order.id` segera setelah order terbentuk,
 * TANPA user menempel ID manual (pola lama link-order + BottomSheet dihapus).
 * Kontrak selaras `linkJastipOrder`: body `{ orderId }`, respons = participant.
 */
export function createOrderFromJastipParticipant(participantId: string, orderId: string) {
  return http
    .post<unknown, { orderId: string }>(`/v1/jastip/participants/${seg(participantId)}/create-order`, { orderId }, { auth: "required" })
    .then(normalizeJastipParticipant)
}

export function failJastipTrip(id: string, reason?: string) {
  return http
    .post<unknown, { reason?: string }>(`/v1/jastip/trips/${seg(id)}/fail`, { reason }, { auth: "required" })
    .then(normalizeJastipTrip)
}

// ------------------------------------------------------------------
// Item 14: patungan grup — /v1/patungan
// ------------------------------------------------------------------

/**
 * Selaras enum backend `PatunganStatus`
 * (OPEN|TARGET_REACHED|CONTEST|RELEASED|FAILED|REFUNDED).
 *
 * ESI-010 (audit integrasi 2026-09-30): `FUNDED`/`RELEASE_INITIATED`/
 * `CANCELLED` adalah inventaris FE yang tak pernah dikirim backend —
 * dihapus. `TARGET_REACHED` & `CONTEST` (masa sanggah resmi sebelum
 * pencairan) ditambahkan — sebelumnya fase kritis ini salah tampil.
 */
export type PatunganStatus = "OPEN" | "TARGET_REACHED" | "CONTEST" | "RELEASED" | "FAILED" | "REFUNDED"
/**
 * Selaras enum backend `PatunganParticipantStatus`
 * (PENDING|PAID|REFUNDED|REFUND_REQUIRED|RELEASED).
 *
 * ESI-012 (audit integrasi 2026-09-30): `JOINED`/`CANCELLED` adalah
 * inventaris FE — dihapus; `PENDING` (peserta baru, belum bayar) resmi
 * backend ditambahkan.
 */
export type PatunganParticipantStatus = "PENDING" | "PAID" | "REFUNDED" | "REFUND_REQUIRED" | "RELEASED"
export type PatunganMode = "BAGI_RATA" | "CUSTOM"

export const PATUNGAN_STATUS_LABELS: Record<string, string> = {
  OPEN: "Dibuka",
  TARGET_REACHED: "Target tercapai",
  CONTEST: "Masa sanggah",
  RELEASED: "Dicairkan",
  FAILED: "Gagal",
  REFUNDED: "Dana kembali",
}

export const PATUNGAN_PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu pembayaran",
  PAID: "Sudah bayar",
  REFUNDED: "Dana kembali",
  REFUND_REQUIRED: "Perlu refund",
  RELEASED: "Dicairkan",
}

export type PatunganParticipant = {
  id: string
  userId: string
  amountIdr: number | null
  orderId: string | null
  paidAt: string | null
  status: PatunganParticipantStatus
  createdAt: string | null
}

export function normalizePatunganParticipant(raw: unknown): PatunganParticipant | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  // ESI-012: selaras enum backend; fallback "PENDING" (bukan "JOINED" lama).
  const status = pickString(record, ["status"]) ?? "PENDING"
  const amount = record.amount
  return {
    id,
    userId: pickString(record, ["userId"]) ?? "",
    amountIdr: typeof amount === "number" ? amount / 100 : pickNumber(record, ["amountIdr"]) ?? null,
    orderId: pickString(record, ["orderId"]) ?? null,
    paidAt: pickString(record, ["paidAt"]) ?? null,
    status: ["PENDING", "PAID", "REFUNDED", "REFUND_REQUIRED", "RELEASED"].includes(status)
      ? (status as PatunganParticipantStatus)
      : "PENDING",
    createdAt: pickString(record, ["createdAt"]) ?? null,
  }
}

export type PatunganGroup = {
  id: string
  hostId: string
  title: string
  description: string | null
  status: PatunganStatus
  mode: PatunganMode
  deadlineAt: string | null
  slotTotal: number | null
  inviteCode: string | null
  // Agregat transparan dari server.
  targetAmountIdr: number | null
  totalPaidIdr: number
  remainingIdr: number
  participantCount: number
  paidCount: number
  slotsLeft: number | null
  overfundingIdr: number
  overfundingPerPersonIdr: number
  feeNote: string | null
  participants: PatunganParticipant[]
  releaseInitiatedAt: string | null
  createdAt: string | null
}

export function normalizePatunganGroup(raw: unknown): PatunganGroup | null {
  const record = asRecord(raw)
  if (!record) return null
  const id = pickString(record, ["id"])
  if (!id) return null
  const status = pickString(record, ["status"]) ?? "OPEN"
  return {
    id,
    hostId: pickString(record, ["hostId"]) ?? "",
    title: pickString(record, ["title"]) ?? "",
    description: pickString(record, ["description"]) ?? null,
    status: ["OPEN", "TARGET_REACHED", "CONTEST", "RELEASED", "FAILED", "REFUNDED"].includes(status)
      ? (status as PatunganStatus)
      : "OPEN",
    mode: pickString(record, ["mode"]) === "CUSTOM" ? "CUSTOM" : "BAGI_RATA",
    deadlineAt: pickString(record, ["deadlineAt"]) ?? null,
    slotTotal: pickNumber(record, ["slotTotal"]) ?? null,
    inviteCode: pickString(record, ["inviteCode"]) ?? null,
    targetAmountIdr: pickNumber(record, ["targetAmountIdr"]) ?? null,
    totalPaidIdr: pickNumber(record, ["totalPaidIdr"]) ?? 0,
    remainingIdr: pickNumber(record, ["remainingIdr"]) ?? 0,
    participantCount: pickNumber(record, ["participantCount"]) ?? 0,
    paidCount: pickNumber(record, ["paidCount"]) ?? 0,
    slotsLeft: pickNumber(record, ["slotsLeft"]) ?? null,
    overfundingIdr: pickNumber(record, ["overfundingIdr"]) ?? 0,
    overfundingPerPersonIdr: pickNumber(record, ["overfundingPerPersonIdr"]) ?? 0,
    feeNote: pickString(record, ["feeNote"]) ?? null,
    participants: (Array.isArray(record.participants) ? record.participants : [])
      .map(normalizePatunganParticipant)
      .filter((p): p is PatunganParticipant => p !== null),
    releaseInitiatedAt: pickString(record, ["releaseInitiatedAt"]) ?? null,
    createdAt: pickString(record, ["createdAt"]) ?? null,
  }
}

export type CreatePatunganGroupDto = {
  title: string
  description?: string
  targetAmountIdr: number
  deadlineAt: string
  slotTotal?: number
  mode?: PatunganMode
  perPersonAmountIdr?: number
}

export function createPatunganGroup(dto: CreatePatunganGroupDto) {
  return http
    .post<unknown, CreatePatunganGroupDto>("/v1/patungan/groups", dto, { auth: "required" })
    .then(normalizePatunganGroup)
}

export function listPatunganGroups(status?: PatunganStatus, page = 1, limit = 20, signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/patungan/groups", {
      auth: "optional",
      retry: 1,
      signal,
      query: { ...(status ? { status } : {}), page, limit },
    })
    .then((raw) =>
      readList<unknown>(raw, ["groups", "items", "data"])
        .map(normalizePatunganGroup)
        .filter((g): g is PatunganGroup => g !== null),
    )
}

export function getPatunganGroup(id: string, signal?: AbortSignal) {
  return http.get<unknown>(`/v1/patungan/groups/${seg(id)}`, { auth: "optional", retry: 1, signal }).then(normalizePatunganGroup)
}

export function joinPatunganGroup(id: string, dto: { amountIdr?: number; orderId?: string }) {
  return http
    .post<unknown, { amountIdr?: number; orderId?: string }>(`/v1/patungan/groups/${seg(id)}/join`, dto, { auth: "required" })
    .then(normalizePatunganParticipant)
}

export function linkPatunganOrder(participantId: string, orderId: string) {
  return http
    .post<unknown, { orderId: string }>(`/v1/patungan/participants/${seg(participantId)}/link-order`, { orderId }, { auth: "required" })
    .then(normalizePatunganParticipant)
}

/**
 * Poin 2 (2026-10-04, unifikasi transaksi escrow): order escrow untuk
 * iuran patungan DIBUAT LALU DIDAFTARKAN otomatis — create-transaction
 * memanggil endpoint ini dengan `order.id` segera setelah order terbentuk,
 * TANPA user menempel ID manual (pola lama link-order + BottomSheet dihapus).
 * Kontrak selaras `linkPatunganOrder`: body `{ orderId }`, respons = participant.
 */
export function createOrderFromPatunganParticipant(participantId: string, orderId: string) {
  return http
    .post<unknown, { orderId: string }>(`/v1/patungan/participants/${seg(participantId)}/create-order`, { orderId }, { auth: "required" })
    .then(normalizePatunganParticipant)
}

export function initiatePatunganRelease(id: string) {
  return http
    .post<unknown>(`/v1/patungan/groups/${seg(id)}/initiate-release`, undefined, { auth: "required" })
    .then(normalizePatunganGroup)
}
