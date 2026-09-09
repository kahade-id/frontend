/**
 * Kahade — label & ikon kategori notifikasi (SATU sumber untuk daftar & detail).
 *
 * API mengirim enum `TRANSAKSI | PROMOSI | INFORMASI`; komponen
 * <NotificationListItem> memakai kategorinya sendiri (order/promo/system/…).
 * Nilai asing dari backend jatuh ke "system"/label apa adanya — tidak crash.
 */
import type { NotificationCategory as UiCategory } from "@/components/ui/notification-list-item"
import { mapValue } from "@/lib/has-own"

/**
 * Peta kategori API (query enum) → kategori UI komponen (ikon).
 * TRANSAKSI → Receipt, PROMOSI → Megaphone, INFORMASI → Bell.
 */
export const NOTIFICATION_UI_CATEGORY: Record<string, UiCategory> = {
  TRANSAKSI: "order",
  PROMOSI: "promo",
  INFORMASI: "system",
}

/** Label Indonesia untuk enum kategori API. */
export const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  TRANSAKSI: "Transaksi",
  PROMOSI: "Promosi",
  INFORMASI: "Informasi",
}

export function notificationUiCategory(category: string | null | undefined): UiCategory {
  return mapValue(NOTIFICATION_UI_CATEGORY, category ?? "", "system")
}

export function notificationCategoryLabel(category: string | null | undefined): string {
  if (!category) return "Notifikasi"
  return mapValue(NOTIFICATION_CATEGORY_LABELS, category, category)
}
