/**
 * Kahade — label kategori tiket bantuan (item mega-batch 125).
 *
 * Enum backend mentah ("PAYMENT", "KYC", …) tidak boleh tampil apa adanya di
 * kartu tiket — satu peta Indonesia di sini, dipakai <SupportTicketCard>,
 * detail tiket, dan form "Hubungi Kami" (dulu peta lokal di app/contact.tsx).
 */
import { hasOwn } from "@/lib/has-own"

export type TicketCategoryValue =
  | "GENERAL"
  | "ORDER"
  | "PAYMENT"
  | "ACCOUNT"
  | "KYC"
  | "TECHNICAL"
  | "OTHER"

export const TICKET_CATEGORY_LABELS: Record<TicketCategoryValue, string> = {
  GENERAL: "Umum",
  ORDER: "Pesanan",
  PAYMENT: "Pembayaran",
  ACCOUNT: "Akun",
  KYC: "Verifikasi",
  TECHNICAL: "Teknis",
  OTHER: "Lainnya",
}

/** Label Indonesia untuk kategori tiket; fallback = nilai mentah (fail-open tampilan). */
export function ticketCategoryLabel(category: string | null | undefined): string {
  if (typeof category !== "string" || !category) return "—"
  return hasOwn(TICKET_CATEGORY_LABELS, category)
    ? TICKET_CATEGORY_LABELS[category as TicketCategoryValue]
    : category
}
