/**
 * Kahade — <DisputeStatusBadge> + peta status sengketa (§2.3 semantic
 * eksklusif untuk status transaksi, §9.7 Badge, §12 i18n-ready).
 *
 * Pasangan OrderStatusBadge untuk domain `/v1/disputes/*`. SATU tempat yang
 * menerjemahkan status sengketa backend menjadi tone + label, dipakai oleh
 * DisputeCard, header detail sengketa, NotificationListItem, Timeline.
 *
 * Siklus sengketa = enum backend `DisputeStatus` (DP-003, audit 2026-09-26;
 * dulu kosakata UI ditebak dan tak cocok dengan server):
 *
 *   OPEN               warning  baru dibuka, menunggu klaim/bukti kedua pihak
 *   ASSIGNED           info     ditugaskan ke mediator
 *   UNDER_REVIEW       info     sedang ditinjau tim Kahade
 *   WAITING_RESPONSE   warning  menunggu tanggapan salah satu pihak
 *   RESOLVED           success  ada keputusan (arah dana di kartu putusan)
 *   ESCALATED          danger   dieskalasi (indikasi fraud / pelanggaran)
 *
 * Keputusan non-obvious:
 *   - RESOLVED memakai tone `success`: dari sudut pandang produk, sengketa
 *     yang SELESAI adalah hasil baik; arah dana dibaca dari kartu "Hasil
 *     putusan" (DP-005), bukan dari warna. Warna merah untuk "kalah" akan
 *     terasa menghukum (§1 tenang).
 *   - `role` menggeser tone WAITING_RESPONSE: kalau yang ditunggu adalah
 *     USER (respondent), tone warning = "Anda harus bertindak"; kalau user
 *     adalah pihak yang menunggu, info.
 *   - Status asing dari server -> neutral + label apa adanya + console.warn
 *     di dev (pola sama dengan OrderStatusBadge).
 */
import { Badge, type BadgeProps, type BadgeTone } from "@/components/ui/badge"
import { translate } from "@/lib/i18n/translate"

import { DISPUTE_STATUS_LABELS, type DisputeStatus } from "@/lib/labels/status"

export type { DisputeStatus }

/** Posisi user di sengketa ini */
export type DisputeParty = "claimant" | "respondent"

export const DISPUTE_STATUSES: readonly DisputeStatus[] = [
  "OPEN",
  "ASSIGNED",
  "UNDER_REVIEW",
  "WAITING_RESPONSE",
  "RESOLVED",
  "ESCALATED",
]


const BASE_TONE: Record<DisputeStatus, BadgeTone> = {
  OPEN: "warning",
  ASSIGNED: "info",
  UNDER_REVIEW: "info",
  WAITING_RESPONSE: "warning",
  RESOLVED: "success",
  ESCALATED: "danger",
}

export function isDisputeStatus(s: string): s is DisputeStatus {
  return (DISPUTE_STATUSES as readonly string[]).includes(s)
}

export function disputeStatusTone(status: string, party?: DisputeParty): BadgeTone {
  if (!isDisputeStatus(status)) {
    if (__DEV__) console.warn(`[kahade/dispute-status] status tidak dikenal: "${status}"`)
    return "neutral"
  }
  // Klaiman yang menunggu tanggapan lawan hanya menunggu -> info
  if (party === "claimant" && status === "WAITING_RESPONSE") return "info"
  return BASE_TONE[status]
}

/** Sengketa yang masih hidup (belum final) — untuk filter "Aktif" */
export function isDisputeActive(status: string): boolean {
  // DP-003: backend tak punya CLOSED/RESOLVED_* — final = RESOLVED.
  // ESCALATED tetap aktif (masih dalam penanganan).
  return isDisputeStatus(status) && status !== "RESOLVED"
}

export type DisputeStatusBadgeProps = Omit<BadgeProps, "children" | "tone" | "dot"> & {
  status: DisputeStatus | string
  party?: DisputeParty
  /** "sm" di list (dot + caption), "md" di header detail (tanpa dot) */
  size?: "sm" | "md"
  labels?: Partial<Record<DisputeStatus, string>>
}

export function DisputeStatusBadge({
  status,
  party,
  size = "sm",
  labels,
  variant = "soft",
  ...rest
}: DisputeStatusBadgeProps) {
  const label = isDisputeStatus(status) ? labels?.[status] ?? DISPUTE_STATUS_LABELS[status] : status
  return (
    <Badge
      tone={disputeStatusTone(status, party)}
      variant={variant}
      dot={size === "sm"}
      accessibilityLabel={translate("Status sengketa: {x}", { x: label })}
      {...rest}
    >
      {label}
    </Badge>
  )
}
