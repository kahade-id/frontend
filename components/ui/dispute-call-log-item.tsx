/**
 * Kahade — <DisputeCallLogItem> (§9.17 List Item, §7 ikon, §13 format durasi).
 *
 * Satu baris riwayat panggilan video sengketa dari `GET /v1/disputes/{id}/
 * calls`: siapa yang meminta, hasil (selesai / ditolak / tidak dijawab /
 * dibatalkan / berlangsung), waktu, kehadiran mediator, dan durasi (Mono)
 * bila tersambung.
 *
 * Keputusan non-obvious:
 *   - Dibangun di atas <ListItem> (bukan Card): riwayat panggilan adalah log
 *     padat di dalam detail sengketa; irama 56px konsisten dengan
 *     SecurityLogItem, ActivityLogItem, KycHistoryListItem.
 *   - Ikon mengikuti HASIL, bukan arah: VideoCamera (selesai/berlangsung),
 *     PhoneX (ditolak / tidak dijawab), PhoneSlash (dibatalkan). Arah
 *     (masuk/keluar) hanya muncul di subtitle "Diminta oleh Anda / {nama}" —
 *     di sengketa, yang penting adalah apakah mediasi terjadi.
 *   - IconBox `surface` untuk semua hasil; hanya "berlangsung" yang `active`.
 *     Panggilan gagal BUKAN kesalahan sistem, jadi tidak ada merah sama
 *     sekali (§2.3, §12) — log lama tidak perlu berteriak (§1).
 *   - Durasi dirender `formatCountdown` (mm:ss / h:mm:ss) di kolom trailing
 *     Mono — data presisi (§3.1). Tanpa durasi -> "—" (tone disabled) agar
 *     kolom tetap sejajar antar baris.
 *   - `ONGOING` memakai StatusIndicator pulse di trailing; bila `onJoin`
 *     diberikan baris jadi interaktif + chevron dan label berubah "Gabung" —
 *     pemanggil menavigasi ke layar panggilan (Push §10).
 *   - `outcome` menerima string asing dari server (fallback COMPLETED untuk
 *     ikon, label mentah tetap ditampilkan) supaya enum baru di backend tidak
 *     meledakkan UI.
 */
import { PhoneSlash, PhoneX, VideoCamera } from "phosphor-react-native"
import { View } from "react-native"

import type { IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { formatCountdown } from "@/lib/format"

export type DisputeCallOutcome = "COMPLETED" | "REJECTED" | "MISSED" | "CANCELLED" | "ONGOING"

export const DISPUTE_CALL_LABELS: Record<DisputeCallOutcome, string> = {
  COMPLETED: "Panggilan selesai",
  REJECTED: "Ditolak",
  MISSED: "Tidak dijawab",
  CANCELLED: "Dibatalkan",
  ONGOING: "Sedang berlangsung",
}

const OUTCOME_ICON: Record<DisputeCallOutcome, IconComponent> = {
  COMPLETED: VideoCamera,
  REJECTED: PhoneX,
  MISSED: PhoneX,
  CANCELLED: PhoneSlash,
  ONGOING: VideoCamera,
}

export type DisputeCallLogItemLabels = {
  outcome: Record<DisputeCallOutcome, string>
  requestedByYou: string
  requestedBy: (name: string) => string
  withMediator: string
  join: string
}

const DEFAULT_LABELS: DisputeCallLogItemLabels = {
  outcome: DISPUTE_CALL_LABELS,
  requestedByYou: "Diminta oleh Anda",
  requestedBy: (name) => `Diminta oleh ${name}`,
  withMediator: "Mediator Kahade hadir",
  join: "Gabung",
}

export type DisputeCallLogItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing" | "chevron"> & {
  outcome: DisputeCallOutcome | string
  /** Apakah user yang meminta panggilan */
  requestedByMe: boolean
  /** Nama pihak lain (pemohon bila bukan saya) */
  counterpartName: string
  /** Sudah diformat pemanggil (§13) */
  timestamp?: string
  /** Detik tersambung — hanya untuk COMPLETED */
  durationSeconds?: number
  /** Mediator Kahade ikut dalam panggilan */
  withMediator?: boolean
  /** Hanya berlaku bila ONGOING — membuka layar panggilan */
  onJoin?: () => void
  labels?: Partial<Omit<DisputeCallLogItemLabels, "outcome">> & { outcome?: Partial<DisputeCallLogItemLabels["outcome"]> }
}

export function DisputeCallLogItem({
  outcome,
  requestedByMe,
  counterpartName,
  timestamp,
  durationSeconds,
  withMediator = false,
  onJoin,
  labels,
  onPress,
  inset = true,
  ...rest
}: DisputeCallLogItemProps) {
  const t: DisputeCallLogItemLabels = { ...DEFAULT_LABELS, ...labels, outcome: { ...DEFAULT_LABELS.outcome, ...labels?.outcome } }
  const known = outcome in DISPUTE_CALL_LABELS
  const oc = (known ? outcome : "COMPLETED") as DisputeCallOutcome
  const ongoing = oc === "ONGOING"
  const completed = oc === "COMPLETED"

  const title = known ? t.outcome[oc] : outcome
  const requester = requestedByMe ? t.requestedByYou : t.requestedBy(counterpartName)
  const subtitleText = [requester, timestamp, withMediator ? t.withMediator : undefined].filter(Boolean).join(" · ")
  const duration = completed && durationSeconds != null ? formatCountdown(durationSeconds) : "—"
  const handlePress = ongoing ? onJoin ?? onPress : onPress

  return (
    <ListItem
      title={title}
      subtitle={
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {subtitleText}
        </Text>
      }
      leading={<IconBox icon={OUTCOME_ICON[oc]} size="md" variant="surface" active={ongoing} />}
      trailing={
        ongoing ? (
          <StatusIndicator label={onJoin ? t.join : t.outcome.ONGOING} tone="success" pulse size="sm" />
        ) : (
          <View className="items-end">
            <Text variant="monoBody" tone={completed ? "primary" : "disabled"}>
              {duration}
            </Text>
          </View>
        )
      }
      chevron={ongoing && !!onJoin}
      onPress={handlePress}
      inset={inset}
      accessibilityLabel={summarize([title, subtitleText, completed ? `durasi ${duration}` : undefined])}
      {...rest}
    />
  )
}
