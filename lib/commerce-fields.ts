/**
 * Helper commerce batch 43 — pemetaan tipe produk & field commerce etalase.
 *
 * CR-01 (audit etalase 2026-10-10): `GET /v1/users/me/showcase` SUDAH
 * menyerialkan `productType`, `originalPrice`, `serviceDeadlineDays` untuk
 * pemilik, dan sejak BE-1 juga `originalPriceIdr`, `digitalDeliveryInfo`,
 * `scheduledAt`. Editor kelola-etalase memprefill dari respons itu
 * (`commerceFormFromShowcaseItem`), jatuh ke cache sesi (hasil PATCH) bila
 * server belum mengirimnya, dan HANYA mengirim field yang diubah pengguna
 * (`buildCommercePatch`). Dulu seluruh form (default `LAINNYA` + null) dikirim
 * setiap simpan → tipe produk, harga coret, tenggat jasa, dan jadwal publish
 * ikut terhapus hanya karena pengguna mengganti judul.
 */
import type { OrderType } from "@/components/ui/order-form-selectors"
import type { ProductCommerceFields, ProductType, UpdateProductCommerceDto } from "@/lib/api/commerce"
import { senToIdr } from "@/lib/api/commerce"

/** Bentuk form commerce di editor — cermin `CommerceFormValues` tanpa impor komponen. */
export type CommerceFormLike = {
  productType: ProductType
  originalPriceIdr: number | null
  serviceDeadlineDays: number | null
  digitalDeliveryInfo: string
  scheduledAt: string | null
}

export const EMPTY_COMMERCE_VALUES: CommerceFormLike = {
  productType: "LAINNYA",
  originalPriceIdr: null,
  serviceDeadlineDays: null,
  digitalDeliveryInfo: "",
  scheduledAt: null,
}

const PRODUCT_TYPES: readonly ProductType[] = ["JASA", "FISIK", "DIGITAL", "LAINNYA"]

function asProductType(value: unknown): ProductType | null {
  return typeof value === "string" && (PRODUCT_TYPES as readonly string[]).includes(value) ? (value as ProductType) : null
}

/**
 * Nilai form commerce dari item `GET /me/showcase` (payload mentah).
 * `known=false` bila server tidak mengirim `productType` sama sekali
 * (backend lama) — pemanggil boleh jatuh ke cache sesi.
 *
 * Harga coret: `originalPriceIdr` (BE-1, IDR) diutamakan; `originalPrice`
 * lama dikirim dalam SEN (kontrak PATCH), jadi dikonversi, bukan dipakai apa
 * adanya.
 */
export function commerceFormFromShowcaseItem(item: unknown): { values: CommerceFormLike; known: boolean } {
  const raw = (item ?? {}) as Record<string, unknown>
  const productType = asProductType(raw.productType)
  const known = "productType" in raw && (raw.productType === null || productType !== null)
  if (!known) return { values: EMPTY_COMMERCE_VALUES, known: false }
  const originalPriceIdr =
    typeof raw.originalPriceIdr === "number" && Number.isFinite(raw.originalPriceIdr) && raw.originalPriceIdr > 0
      ? raw.originalPriceIdr
      : senToIdr(raw.originalPrice)
  return {
    known: true,
    values: {
      productType: productType ?? "LAINNYA",
      originalPriceIdr: originalPriceIdr != null && originalPriceIdr > 0 ? originalPriceIdr : null,
      serviceDeadlineDays:
        typeof raw.serviceDeadlineDays === "number" && Number.isFinite(raw.serviceDeadlineDays)
          ? raw.serviceDeadlineDays
          : null,
      digitalDeliveryInfo: typeof raw.digitalDeliveryInfo === "string" ? raw.digitalDeliveryInfo : "",
      scheduledAt: typeof raw.scheduledAt === "string" && raw.scheduledAt ? raw.scheduledAt : null,
    },
  }
}

/** Nilai form dari hasil PATCH (cache sesi). */
export function commerceFormFromFields(fields: ProductCommerceFields): CommerceFormLike {
  return {
    productType: fields.productType ?? "LAINNYA",
    originalPriceIdr: fields.originalPriceIdr,
    serviceDeadlineDays: fields.serviceDeadlineDays,
    digitalDeliveryInfo: fields.digitalDeliveryInfo ?? "",
    scheduledAt: fields.scheduledAt,
  }
}

/**
 * DTO PATCH berisi HANYA field yang berubah dari `initial`; `null` bila tidak
 * ada yang berubah (jangan PATCH). Backend memperlakukan field yang tidak
 * dikirim sebagai "biarkan" dan `null` sebagai "hapus" — jadi delta inilah
 * satu-satunya cara menyimpan judul tanpa menyentuh data commerce yang tidak
 * terlihat di form (cache kosong setelah app ditutup).
 */
export function buildCommercePatch(initial: CommerceFormLike, current: CommerceFormLike): UpdateProductCommerceDto | null {
  const dto: UpdateProductCommerceDto = {}
  if (current.productType !== initial.productType) dto.productType = current.productType
  if (current.originalPriceIdr !== initial.originalPriceIdr) dto.originalPriceIdr = current.originalPriceIdr
  if (current.serviceDeadlineDays !== initial.serviceDeadlineDays) dto.serviceDeadlineDays = current.serviceDeadlineDays
  const info = current.digitalDeliveryInfo.trim()
  if (info !== initial.digitalDeliveryInfo.trim()) dto.digitalDeliveryInfo = info === "" ? null : info
  if (current.scheduledAt !== initial.scheduledAt) dto.scheduledAt = current.scheduledAt
  return Object.keys(dto).length === 0 ? null : dto
}

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
