/**
 * Kahade — status stok etalase untuk CTA (C06, batch 139).
 *
 * Backend BELUM mengekspos field stok pada item showcase (per 2026-09-28):
 * resolver ini membaca kandidat field secara defensif (`stock`,
 * `stockQty`, `stockQuantity`, `quantity`, `inventoryQty`) sehingga saat
 * backend menambahkannya nanti, UI langsung berfungsi tanpa perubahan kode.
 * Tanpa field itu status = "unknown" (graceful: CTA berperilaku seperti
 * sekarang, tidak ada badge stok).
 */
export type ShowcaseStockStatus = "unknown" | "inStock" | "outOfStock"

const STOCK_KEYS = ["stock", "stockQty", "stockQuantity", "quantity", "inventoryQty"] as const

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
}

/** Resolve status stok dari item — murni, unit-testable. */
export function resolveShowcaseStock(item: unknown): ShowcaseStockStatus {
  const rec = asRecord(item)
  if (!rec) return "unknown"
  for (const key of STOCK_KEYS) {
    const v = rec[key]
    if (typeof v === "number" && Number.isFinite(v)) {
      return v > 0 ? "inStock" : "outOfStock"
    }
  }
  return "unknown"
}

/** True bila CTA transaksi harus dinonaktifkan karena stok habis. */
export function isShowcaseSoldOut(item: unknown): boolean {
  return resolveShowcaseStock(item) === "outOfStock"
}
