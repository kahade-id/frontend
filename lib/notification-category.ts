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

/**
 * CN-010: peta tipe presisi backend (NotificationType) → kategori UI.
 * Backend meruntuhkan chat/keamanan/KYC ke INFORMASI dan dompet/sengketa ke
 * TRANSAKSI; memakai `type` mengembalikan ikon yang tepat (chat, wallet,
 * dispute, security, referral, promo) alih-alih tiga generik.
 * Return `null` bila tipe tak dikenal — pemanggil fallback ke kategori.
 */
export function notificationTypeUiCategory(type: string | null | undefined): UiCategory | null {
  if (!type) return null
  if (type.startsWith("ORDER_")) return "order"
  if (type.startsWith("WALLET_")) return "wallet"
  if (type.startsWith("CHAT_")) return "chat"
  if (type.startsWith("DISPUTE_")) return "dispute"
  if (type.startsWith("SECURITY_") || type.startsWith("KYC_") || type.startsWith("BUSINESS_VERIFICATION_"))
    return "security"
  if (type.startsWith("REFERRAL_")) return "referral"
  if (
    type.startsWith("VOUCHER_") ||
    type.startsWith("CAMPAIGN_") ||
    type.startsWith("TOPUP_BONUS_") ||
    type.startsWith("SUBSCRIPTION_")
  )
    return "promo"
  if (type.startsWith("RATING_") || type.startsWith("BADGE_") || type.startsWith("RANK_"))
    return "system"
  return null
}

export function notificationCategoryLabel(category: string | null | undefined): string {
  if (!category) return "Notifikasi"
  return mapValue(NOTIFICATION_CATEGORY_LABELS, category, category)
}
