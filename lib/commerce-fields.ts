/**
 * Helper commerce batch 43 — pemetaan tipe produk & cache field commerce.
 *
 * Cache in-memory: backend belum mengekspos productType/harga coret/jadwal
 * publish lewat GET showcase mana pun (hanya PATCH /v1/commerce/products/:id
 * yang mengembalikannya), jadi nilai yang baru di-PATCH di sesi ini disimpan
 * di sini agar editor kelola-etalase bisa prefill tanpa menebak.
 */
import type { OrderType } from "@/components/ui/order-form-selectors"
import type { ProductCommerceFields, ProductType } from "@/lib/api/commerce"

/** productType etalase → orderType checkout (prefill; server tetap otoritatif). */
export function productTypeToOrderType(productType: ProductType | null | undefined): OrderType {
  switch (productType) {
    case "JASA":
      return "SERVICE"
    case "FISIK":
      return "PHYSICAL_GOODS"
    case "DIGITAL":
      return "DIGITAL_GOODS"
    default:
      return "OTHER"
  }
}

/** Resi/ongkir hanya relevan untuk barang fisik. */
export function needsShippingAddress(productType: ProductType | null | undefined): boolean {
  return productType === "FISIK"
}

const commerceCache = new Map<string, ProductCommerceFields>()

export function getCommerceFieldsCache(showcaseId: string): ProductCommerceFields | null {
  return commerceCache.get(showcaseId) ?? null
}

export function setCommerceFieldsCache(showcaseId: string, fields: ProductCommerceFields): void {
  commerceCache.set(showcaseId, fields)
}

/**
 * Hitung persen diskon dari harga coret vs harga jual — murni tampilan
 * (angka server ditampilkan apa adanya; ini hanya derivasi presentasi).
 */
export function discountPercentOf(originalPriceIdr: number | null, salePriceIdr: number | null | undefined): number | null {
  if (originalPriceIdr == null || salePriceIdr == null || originalPriceIdr <= 0 || salePriceIdr <= 0) return null
  if (originalPriceIdr <= salePriceIdr) return null
  return Math.round(((originalPriceIdr - salePriceIdr) / originalPriceIdr) * 100)
}
