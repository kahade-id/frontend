/**
 * Kahade — domain `products`/`inventory` (GAP-D G251–G275): katalog & stok.
 *
 * Backend: /v1/products (katalog), /v1/inventory (stok seller),
 * /v1/admin/inventory (moderasi). Product TERPISAH dari showcase (G251).
 *
 * KONTRAK UANG (koreksi audit integrasi 2026-09-27 — laporan tim D sempat
 * mengklaim sen, tetapi implementasi backend memakai RUPIAH di boundary API):
 * - Request & response memakai `priceRupiah` (number, rupiah bulat).
 * - Server mengonversi ke sen (BigInt) hanya di database (`priceSen`).
 * - Pengecualian: `POST /v1/inventory/pre-checkout` mengembalikan
 *   `currentPriceSen` (string, sen) agar klien bisa membandingkan harga
 *   terkini tanpa artefak float.
 * Jangan memakai `formatIdrSen` untuk produk — pakai `formatRupiah`.
 */
import { http } from "@/lib/api/client"
import { readList, readPage } from "@/lib/api/response"
import type { BadgeTone } from "@/components/ui/badge"

export type ProductStatus = "DRAFT" | "ACTIVE" | "OUT_OF_STOCK" | "ARCHIVED"
export type ProductModerationStatus = "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED"

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: "Draf",
  ACTIVE: "Aktif",
  OUT_OF_STOCK: "Stok habis",
  ARCHIVED: "Diarsipkan",
}

export const PRODUCT_MODERATION_LABEL: Record<ProductModerationStatus, string> = {
  PENDING: "Menunggu moderasi",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  FLAGGED: "Ditandai",
}

export type ProductVariant = {
  id: string
  sku: string
  attributes: Record<string, string>
  /** Rupiah (number). Null → ikut harga produk induk. */
  priceRupiah?: number | null
  quantityAvailable: number
  quantityReserved: number
  lowStockThreshold: number
}

export type Product = {
  id: string
  sku: string
  sellerId: string
  name: string
  description?: string | null
  category: string
  status: ProductStatus
  moderationStatus: ProductModerationStatus
  requiresBusinessVerification: boolean
  /** Rupiah (number) — kontrak backend, BUKAN sen. */
  priceRupiah: number
  quantityAvailable: number
  quantityReserved: number
  lowStockThreshold: number
  weightGrams?: number | null
  imageFileKeys: string[]
  variants: ProductVariant[]
  createdAt: string
  updatedAt: string
}

export type StockMovement = {
  id: string
  productId: string
  variantId?: string | null
  type: string
  source: string
  actorId: string
  actorRole: string
  reason?: string | null
  ref?: string | null
  quantityChange: number
  beforeAvailable: number
  afterAvailable: number
  beforeReserved: number
  afterReserved: number
  createdAt: string
}

export type PreCheckoutLine = { sku: string; qty: number }
/** Hasil `POST /v1/inventory/pre-checkout` — shape persis backend. */
export type PreCheckoutLineResult = {
  sku: string
  found: boolean
  purchasable: boolean
  /** Harga terkini server dalam SEN (string) — aman untuk BigInt. */
  currentPriceSen: string | null
  requestedQty: number
  availableQty: number | null
  sufficient: boolean
  message: string
}
export type PreCheckoutResult = {
  lines: PreCheckoutLineResult[]
  allOk: boolean
  policy: string
}

export type CatalogQuery = {
  page?: number
  limit?: number
  category?: string
  q?: string
  /** Rupiah (number) — kontrak backend, BUKAN sen. */
  minPriceRupiah?: number
  maxPriceRupiah?: number
  inStockOnly?: boolean
  verifiedBusinessOnly?: boolean
}

export function listCatalog(query?: CatalogQuery, signal?: AbortSignal) {
  const q = {
    page: query?.page ?? 1, limit: query?.limit ?? 20, category: query?.category, q: query?.q,
    minPriceRupiah: query?.minPriceRupiah, maxPriceRupiah: query?.maxPriceRupiah,
    inStockOnly: query?.inStockOnly, verifiedBusinessOnly: query?.verifiedBusinessOnly,
  }
  return http
    .get<unknown>("/v1/products", { query: q, auth: "optional", signal })
    .then((raw) => readPage<Product>(raw, q, ["products", "items"]))
}

export function getProduct(id: string, signal?: AbortSignal) {
  return http.get<Product>(`/v1/products/${id}`, { auth: "optional", signal })
}

export function listMyProducts(query?: { page?: number; limit?: number; q?: string; status?: ProductStatus }, signal?: AbortSignal) {
  const q = { page: query?.page ?? 1, limit: query?.limit ?? 20, q: query?.q, status: query?.status }
  return http
    .get<unknown>("/v1/products/seller/mine", { query: q, auth: "required", signal })
    .then((raw) => readPage<Product>(raw, q, ["products", "items"]))
}

export type UpsertProductBody = {
  sku: string
  name: string
  description?: string
  category: string
  /** Rupiah (number, bulat) — server mengonversi ke sen. */
  priceRupiah: number
  quantityAvailable?: number
  lowStockThreshold?: number
  weightGrams?: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  requiresBusinessVerification?: boolean
  attributesSchema?: Record<string, string[]>
  imageFileKeys?: string[]
}

export function createProduct(body: UpsertProductBody) {
  return http.post<Product, UpsertProductBody>("/v1/products", body, { auth: "required" })
}

export function updateProduct(id: string, body: Partial<UpsertProductBody>) {
  return http.patch<Product, Partial<UpsertProductBody>>(`/v1/products/${id}`, body, { auth: "required" })
}

export function setProductStatus(id: string, status: ProductStatus) {
  return http.post<Product, { status: ProductStatus }>(`/v1/products/${id}/status`, { status }, { auth: "required" })
}

export type UpsertVariantBody = {
  sku: string
  attributes: Record<string, string>
  /** Rupiah (number, bulat) — server mengonversi ke sen. */
  priceRupiah?: number
  quantityAvailable?: number
  lowStockThreshold?: number
  weightGrams?: number
}

export function createVariant(productId: string, body: UpsertVariantBody) {
  return http.post<ProductVariant, UpsertVariantBody>(`/v1/products/${productId}/variants`, body, { auth: "required" })
}

export function updateVariant(variantId: string, body: Partial<UpsertVariantBody>) {
  return http.patch<ProductVariant, Partial<UpsertVariantBody>>(`/v1/products/variants/${variantId}`, body, { auth: "required" })
}

/** G274 — validasi server harga & stok terkini sebelum checkout. */
export function preCheckoutValidate(lines: PreCheckoutLine[], signal?: AbortSignal) {
  return http.post<PreCheckoutResult, { lines: PreCheckoutLine[] }>("/v1/inventory/pre-checkout", { lines }, { auth: "required", signal })
}

export function adjustStock(body: { productId?: string; variantId?: string; deltaAvailable?: number; deltaReserved?: number; reason: string }) {
  return http.post("/v1/inventory/adjust", body, { auth: "required" })
}

export function listStockMovements(query?: { productId?: string; page?: number; limit?: number }, signal?: AbortSignal) {
  const q = { page: query?.page ?? 1, limit: query?.limit ?? 20, productId: query?.productId }
  return http
    .get<unknown>("/v1/inventory/movements", { query: q, auth: "required", signal })
    .then((raw) => readPage<StockMovement>(raw, q, ["movements", "items"]))
}

export function listLowStock(signal?: AbortSignal) {
  return http
    .get<unknown>("/v1/inventory/low-stock", { auth: "required", signal })
    .then((raw) => readList<Product>(raw, ["products", "items"]))
}

/** G265 — baris bulk update, shape persis `BulkUpdateRowDto` backend. */
export type BulkUpdateRow = {
  sku: string
  /** Rupiah (number, bulat). */
  priceRupiah?: number
  /** Set stok tersedia (absolute, bukan delta). */
  setAvailable?: number
  lowStockThreshold?: number
}

export type BulkPreviewRow = {
  sku: string
  name?: string
  ok: boolean
  error?: string
  priceBeforeRupiah?: number
  priceAfterRupiah?: number
  availableBefore?: number
  availableAfter?: number
  reserved?: number
}

export type BulkUpdateResult = {
  dryRun: boolean
  preview: BulkPreviewRow[]
  applied: number
}

export function bulkUpdatePreview(body: { rows: BulkUpdateRow[]; reason?: string }) {
  return http.post<BulkUpdateResult, { rows: BulkUpdateRow[]; dryRun: boolean; reason?: string }>(
    "/v1/inventory/bulk-update",
    { rows: body.rows, dryRun: true, reason: body.reason },
    { auth: "required" },
  )
}

export function bulkUpdateCommit(body: { rows: BulkUpdateRow[]; reason?: string }) {
  return http.post<BulkUpdateResult, { rows: BulkUpdateRow[]; dryRun: boolean; reason?: string }>(
    "/v1/inventory/bulk-update",
    { rows: body.rows, dryRun: false, reason: body.reason },
    { auth: "required" },
  )
}

/**
 * G263 — impor CSV. Backend: header `sku,name,category,price_rupiah,available,
 * low_stock_threshold,status`. Baris invalid → HTTP 422 (`CSV_ROW_ERRORS`).
 * Sukses → `{ created, updated, errors: [] }`.
 */
export function importStockCsv(body: { csv: string }) {
  return http.post<
    { created: number; updated: number; errors: Array<{ row: number; sku?: string; errors: string[] }> },
    { csv: string }
  >("/v1/inventory/import", body, { auth: "required" })
}

export function sellableQty(p: Pick<Product, "quantityAvailable" | "quantityReserved">): number {
  return Math.max(0, (p.quantityAvailable ?? 0) - (p.quantityReserved ?? 0))
}

/**
 * UI-F006 (audit UI/UX 2026-09-27): tone badge SEMANTIK per status produk —
 * Draf/Aktif/Stok habis/Diarsipkan selama ini memakai badge default sehingga
 * tidak terbedakan visual di daftar seller, katalog, dan detail produk.
 * `import type` saja: tidak ada dependensi runtime lib → komponen UI.
 */
export function productStatusBadgeTone(status: ProductStatus): BadgeTone {
  switch (status) {
    case "ACTIVE":
      return "success"
    case "OUT_OF_STOCK":
      return "warning"
    case "DRAFT":
      return "info"
    case "ARCHIVED":
      return "neutral"
  }
}

export function variantLabel(v: Pick<ProductVariant, "attributes">): string {
  return Object.entries(v.attributes ?? {}).map(([k, val]) => `${k}: ${val}`).join(" · ")
}
