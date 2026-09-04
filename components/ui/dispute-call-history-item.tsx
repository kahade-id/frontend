/**
 * Kahade — <DisputeCallHistoryItem> baris riwayat panggilan video sengketa
 * (§9.17 List Item, §7 ikon, §13 format eksplisit).
 *
 * Untuk `GET /v1/disputes/{id}/calls`. Satu baris = satu percobaan
 * panggilan: siapa yang meminta, hasilnya (selesai / ditolak / tidak
 * dijawab / dibatalkan / berlangsung), waktu, dan durasi.
 *
 * Keputusan non-obvious:
 *   - Dibangun di atas <ListItem> (bukan Card): riwayat panggilan adalah
 *     log padat di dalam detail sengketa; irama 56px konsisten dengan
 *     SecurityLogItem & ActivityLogItem.
 *   - Ikon leading per hasil: PhoneOutgoing (Anda meminta) / PhoneIncoming
 *     (lawan meminta) untuk yang selesai, PhoneX untuk ditolak/tak dijawab,
 *     PhoneSlash untuk dibatalkan, VideoCamera fill untuk berlangsung.
 *     Warna tetap text-tertiary kecuali "berlangsung" (active) — log lama
 *     tidak perlu berteriak (§1).
 *   - Durasi dirender Mono ("12:34") di trailing karena ia data teknis
 *     (§3.1); untuk hasil tanpa durasi trailing berisi label hasil caption.
 *   - `ongoing` boleh membawa `onJoin`: baris jadi interaktif dan chevron
 *     muncul — pemanggil menavigasi ke layar panggilan (Push §10).
 */
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneSlash,
  PhoneX,
  VideoCamera,
} from "phosphor-react-native"

import type { IconComponent } from "@/components/ui/icon"
import { Icon } from "@/components/ui/icon"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { Text } from "@/components/ui/text"
import { formatCountdown } from "@/lib/format"

export type DisputeCallOutcome = "COMPLETED" | "REJECTED" | "MISSED" | "CANCELLED" | "ONGOING"

export const DISPUTE_CALL_LABELS: Record<DisputeCallOutcome, string> = {
  COMPLETED: "Selesai",
  REJECTED: "Ditolak",
  MISSED: "Tidak dijawab",
  CANCELLED: "Dibatalkan",
  ONGOING: "Berlangsung",
}

export type DisputeCallHistoryItemLabels = {
  requestedByYou: string
  requestedBy: (name: string) => string
  withKahade: string
  join: string
  outcome: Record<DisputeCallOutcome, string>
}

const DEFAULT_LABELS: DisputeCallHistoryItemLabels = {
  requestedByYou: "Anda meminta panggilan",
  requestedBy: (name) => `${name} meminta panggilan`,
  withKahade: "Mediator Kahade hadir",
  join: "Gabung",
  outcome: DISPUTE_CALL_LABELS,
}

export type DisputeCallHistoryItemProps = Omit<
  ListItemProps,
  "title" | "subtitle" | "leading" | "trailing" | "chevron"
> & {
  outcome: DisputeCallOutcome | string
  requestedByMe: boolean
  requesterName?: string
  /** Sudah diformat (§13) */
  startedAt: string
  /** Durasi detik — hanya untuk COMPLETED */
  durationSeconds?: number
  /** Mediator Kahade ikut dalam panggilan */
  withMediator?: boolean
  /** Hanya berlaku bila ONGOING */
  onJoin?: () => void
  labels?: Partial<DisputeCallHistoryItemLabels>
}

function iconFor(outcome: DisputeCallOutcome, mine: boolean): IconComponent {
  switch (outcome) {
    case "ONGOING":
      return VideoCamera
    case "REJECTED":
    case "MISSED":
      return PhoneX
    case "CANCELLED":
      return PhoneSlash
    default:
      return mine ? PhoneOutgoing : PhoneIncoming
  }
}

export function DisputeCallHistoryItem({
  outcome,
  requestedByMe,
  requesterName,
  startedAt,
  durationSeconds,
  withMediator = false,
  onJoin,
  labels,
  onPress,
  ...rest
}: DisputeCallHistoryItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels, outcome: { ...DEFAULT_LABELS.outcome, ...labels?.outcome } }
  const known = outcome in DISPUTE_CALL_LABELS
  const oc = (known ? outcome : "COMPLETED") as DisputeCallOutcome
  const ongoing = oc === "ONGOING"

  const title = requestedByMe ? t.requestedByYou : t.requestedBy(requesterName ?? "")
  const subtitle = [startedAt, withMediator ? t.withKahade : undefined].filter(Boolean).join(" · ")
  const outcomeLabel = known ? t.outcome[oc] : outcome

  const trailing =
    oc === "COMPLETED" && durationSeconds != null ? (
      <Text variant="monoBody" tone="secondary">
        {formatCountdown(durationSeconds)}
      </Text>
    ) : (
      <Text variant="caption" tone={ongoing ? "primary" : "tertiary"} weight={ongoing ? 500 : 400}>
        {ongoing && onJoin ? t.join : outcomeLabel}
      </Text>
    )

  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      leading={<Icon icon={iconFor(oc, requestedByMe)} size="md" active={ongoing} />}
      trailing={trailing}
      chevron={ongoing && !!onJoin}
      onPress={ongoing ? onJoin ?? onPress : onPress}
      accessibilityLabel={`${title}, ${outcomeLabel}, ${subtitle}`}
      {...rest}
    />
  )
}
