/**
 * Kahade — SATU sumber kategori sengketa & alasan pembatalan order (G-12).
 *
 * Sebelumnya `DISPUTE_CATEGORIES` dan `CANCEL_REASONS` hidup lokal di
 * `app/order/[id].tsx`. Enum backend berubah → layar lain yang menampilkan
 * nilai yang sama (mis. detail sengketa) tertinggal. Di sini keduanya ditipe
 * dari DTO yang di-generate (`SubmitDisputeDto["category"]`, `CancelReason`)
 * sehingga drift enum gagal di `tsc`.
 */
import type { SubmitDisputeDto } from "@/lib/api/types"
import type { CancelReason } from "@/lib/api/orders"
import type { ReasonOption } from "@/components/ui/reason-picker"

export type DisputeCategoryValue = SubmitDisputeDto["category"]

/** Kategori sengketa — wajib di backend (SubmitDisputeDto.category). */
export const DISPUTE_CATEGORIES: readonly { value: DisputeCategoryValue; label: string }[] = [
  { value: "ITEM_NOT_RECEIVED", label: "Barang tidak diterima" },
  { value: "ITEM_NOT_AS_DESCRIBED", label: "Tidak sesuai deskripsi" },
  { value: "DAMAGED_ITEM", label: "Barang rusak" },
  { value: "WRONG_ITEM", label: "Barang salah" },
  { value: "SERVICE_NOT_RENDERED", label: "Jasa tidak dijalankan" },
  { value: "PAYMENT_ISSUE", label: "Masalah pembayaran" },
  { value: "FRAUD", label: "Indikasi penipuan" },
  { value: "OTHER", label: "Lainnya" },
]

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategoryValue, string> = Object.fromEntries(
  DISPUTE_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<DisputeCategoryValue, string>

/** Alasan pembatalan order (CancelOrderDto.reason) untuk <ReasonPicker>. */
export const CANCEL_REASONS: readonly (ReasonOption & { code: CancelReason })[] = [
  { code: "CHANGED_MIND", label: "Berubah pikiran" },
  { code: "WRONG_DETAILS", label: "Detail pesanan salah" },
  { code: "DUPLICATE_ORDER", label: "Pesanan ganda" },
  { code: "MUTUAL_AGREEMENT", label: "Kesepakatan bersama" },
  { code: "COUNTERPART_UNRESPONSIVE", label: "Lawan transaksi tidak merespons" },
  { code: "OTHER", label: "Lainnya", other: true },
]
