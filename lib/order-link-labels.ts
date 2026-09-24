/**
 * Kahade — label & tone status tautan order (SATU sumber untuk daftar tautan
 * `app/order-links.tsx` dan halaman terima tautan `app/order-link/[token].tsx`).
 *
 * Sebelumnya dua layar memutuskan sendiri: daftar memakai tabel lokal
 * (`EXPIRED` = warning, `ACCEPTED` = info) sementara kartu pratinjau memakai
 * tabel internalnya (`EXPIRED` = danger, `ACCEPTED` = neutral). Tautan yang
 * sama karena itu bisa tampil kuning di satu layar dan merah di layar lain.
 *
 * Nilai tone di sini SENGAJA mengikuti `components/ui/order-link-preview-card`
 * karena komponen library adalah acuan yang tidak boleh diubah dari layar.
 * Status asing dari backend ditampilkan apa adanya dengan tone netral.
 */
import type { BadgeTone } from "@/components/ui/badge"
import type { OrderLinkStatus } from "@/components/ui/order-link-preview-card"
import { hasOwn } from "@/lib/has-own"
import { translate } from "@/lib/i18n/translate"

export const ORDER_LINK_STATUS_LABELS: Record<OrderLinkStatus, string> = {
  ACTIVE: "Aktif",
  ACCEPTED: "Sudah diterima",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
}

const ORDER_LINK_STATUS_TONE: Record<OrderLinkStatus, BadgeTone> = {
  ACTIVE: "success",
  ACCEPTED: "neutral",
  CANCELLED: "neutral",
  EXPIRED: "danger",
}

/**
 * `status in LABELS` also matches inherited keys — "toString" would be treated
 * as a known status and render the function itself as the badge label, which
 * React rejects ("Functions are not valid as a React child"). Own keys only.
 */
export function isOrderLinkStatus(status: string): status is OrderLinkStatus {
  return hasOwn(ORDER_LINK_STATUS_LABELS, status)
}

/**
 * Status tautan yang dikenal komponen; nilai ASING → `undefined`.
 *
 * F-05 (audit escrow 2026-09-24): versi lama memetakan nilai asing ke
 * `EXPIRED` — status `PENDING`/baru dari backend tampil "Kedaluwarsa"
 * (pengguna mengira tautannya mati dan tidak mencoba membukanya). Sekarang
 * status asing TIDAK dipaksa ke salah satu status; pemanggil membiarkan kartu
 * tanpa status khusus dan memakai `orderLinkStatusMeta` untuk label netral.
 */
export function orderLinkStatus(status: string): OrderLinkStatus | undefined {
  return isOrderLinkStatus(status) ? status : undefined
}

/**
 * Label + tone untuk Badge.
 *
 * J-04 (audit escrow 2026-09-24): nilai asing TIDAK dirender apa adanya
 * (teks server mentah sebagai label badge bisa berupa enum Inggris acak) —
 * label generik + tone netral.
 */
export function orderLinkStatusMeta(status: string): { label: string; tone: BadgeTone } {
  return isOrderLinkStatus(status)
    ? { label: ORDER_LINK_STATUS_LABELS[status], tone: ORDER_LINK_STATUS_TONE[status] }
    : { label: translate("Status tidak dikenal"), tone: "neutral" }
}
