/**
 * Kahade — <DisputeStatusBadge> + peta status sengketa (§2.3 semantic
 * eksklusif untuk status transaksi, §9.7 Badge, §12 i18n-ready).
 *
 * Pasangan OrderStatusBadge untuk domain `/v1/disputes/*`. SATU tempat yang
 * menerjemahkan status sengketa backend menjadi tone + label, dipakai oleh
 * DisputeCard, header detail sengketa, NotificationListItem, Timeline.
 *
 * Siklus sengketa (diturunkan dari endpoint: dispute -> claim -> evidence ->
 * messages/call -> mutual-resolution -> keputusan admin):
 *
 *   OPEN                 warning  baru dibuka, menunggu klaim/bukti kedua pihak
 *   AWAITING_RESPONSE    warning  menunggu tanggapan pihak lawan
 *   UNDER_REVIEW         info     sedang ditinjau tim Kahade
 *   MUTUAL_RESOLUTION    info     ada proposal penyelesaian bersama yang aktif
 *   RESOLVED_BUYER       success  diputuskan untuk pembeli (refund)
 *   RESOLVED_SELLER      success  diputuskan untuk penjual (dana dilepas)
 *   RESOLVED_MUTUAL      success  disepakati kedua pihak (split)
 *   CLOSED               neutral  ditutup tanpa keputusan / ditarik
 *   ESCALATED            danger   dieskalasi (indikasi fraud / pelanggaran)
 *
 * Keputusan non-obvious:
 *   - Semua RESOLVED_* memakai tone `success` terlepas siapa yang menang:
 *     dari sudut pandang produk, sengketa yang SELESAI adalah hasil baik;
 *     arah dana dibaca dari label ("untuk pembeli"/"untuk penjual"), bukan
 *     dari warna. Warna merah untuk "kalah" akan terasa menghukum (§1 tenang).
 *   - `role` menggeser tone AWAITING_RESPONSE: kalau yang ditunggu adalah
 *     USER (respondent), tone warning = "Anda harus bertindak"; kalau user
 *     adalah pihak yang menunggu, info.
 *   - Status asing dari server -> neutral + label apa adanya + console.warn
 *     di dev (pola sama dengan OrderStatusBadge).
 */
import { Badge, type BadgeProps, type BadgeTone } from "@/components/ui/badge"

export type DisputeStatus =
  | "OPEN"
  | "AWAITING_RESPONSE"
  | "UNDER_REVIEW"
  | "MUTUAL_RESOLUTION"
  | "RESOLVED_BUYER"
  | "RESOLVED_SELLER"
  | "RESOLVED_MUTUAL"
  | "CLOSED"
  | "ESCALATED"

/** Posisi user di sengketa ini */
export type DisputeParty = "claimant" | "respondent"

export const DISPUTE_STATUSES: readonly DisputeStatus[] = [
  "OPEN",
  "AWAITING_RESPONSE",
  "UNDER_REVIEW",
  "MUTUAL_RESOLUTION",
  "RESOLVED_BUYER",
  "RESOLVED_SELLER",
  "RESOLVED_MUTUAL",
  "CLOSED",
  "ESCALATED",
]

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Sengketa dibuka",
  AWAITING_RESPONSE: "Menunggu tanggapan",
  UNDER_REVIEW: "Ditinjau Kahade",
  MUTUAL_RESOLUTION: "Proposal damai",
  RESOLVED_BUYER: "Selesai — untuk pembeli",
  RESOLVED_SELLER: "Selesai — untuk penjual",
  RESOLVED_MUTUAL: "Selesai — disepakati",
  CLOSED: "Ditutup",
  ESCALATED: "Dieskalasi",
}

const BASE_TONE: Record<DisputeStatus, BadgeTone> = {
  OPEN: "warning",
  AWAITING_RESPONSE: "warning",
  UNDER_REVIEW: "info",
  MUTUAL_RESOLUTION: "info",
  RESOLVED_BUYER: "success",
  RESOLVED_SELLER: "success",
  RESOLVED_MUTUAL: "success",
  CLOSED: "neutral",
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
  if (party === "claimant" && status === "AWAITING_RESPONSE") return "info"
  return BASE_TONE[status]
}

/** Sengketa yang masih hidup (belum final) — untuk filter "Aktif" */
export function isDisputeActive(status: string): boolean {
  return isDisputeStatus(status) && !status.startsWith("RESOLVED_") && status !== "CLOSED"
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
      accessibilityLabel={`Status sengketa: ${label}`}
      {...rest}
    >
      {label}
    </Badge>
  )
}
