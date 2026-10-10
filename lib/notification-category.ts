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
  // Audit 2026-10-10 (FE-07/FE-24): keluarga yang dulu tak dikenal (→ ikon
  // kategori generik): MILESTONE_* = tahap order; ESCROW_HELD_NO_BANK = dana;
  // SUPPORT_AGENT_REPLY = chat; SYSTEM_/MODERATION_/DATA_EXPORT_/QUESTION_/
  // DIGEST_ = sistem; BADGE_/RANK_ = PROMOSI di backend (bukan sistem).
  if (type.startsWith("ORDER_") || type.startsWith("MILESTONE_")) return "order"
  if (type.startsWith("WALLET_") || type === "ESCROW_HELD_NO_BANK") return "wallet"
  if (type.startsWith("CHAT_") || type === "SUPPORT_AGENT_REPLY") return "chat"
  if (type.startsWith("DISPUTE_")) return "dispute"
  if (type.startsWith("SECURITY_") || type.startsWith("KYC_") || type.startsWith("BUSINESS_VERIFICATION_"))
    return "security"
  if (type.startsWith("REFERRAL_")) return "referral"
  if (
    type.startsWith("VOUCHER_") ||
    type.startsWith("CAMPAIGN_") ||
    type.startsWith("TOPUP_BONUS_") ||
    type.startsWith("SUBSCRIPTION_") ||
    type.startsWith("BADGE_") ||
    type.startsWith("RANK_")
  )
    return "promo"
  if (
    type.startsWith("RATING_") ||
    type.startsWith("SYSTEM_") ||
    type.startsWith("MODERATION_") ||
    type.startsWith("DATA_EXPORT_") ||
    type.startsWith("QUESTION_") ||
    type.startsWith("DIGEST_") ||
    type.startsWith("SUPPORT_TICKET_")
  )
    return "system"
  return null
}

export function notificationCategoryLabel(category: string | null | undefined): string {
  if (!category) return "Notifikasi"
  return mapValue(NOTIFICATION_CATEGORY_LABELS, category, category)
}
