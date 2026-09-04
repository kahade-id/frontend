/**
 * Kahade — <DisputeCallLogItem> (§9.17 List Item, §7 ikon, §13 format durasi).
 *
 * Satu baris riwayat panggilan video sengketa dari `GET /v1/disputes/{id}/
 * calls`: siapa yang meminta, hasil (selesai / ditolak / tidak dijawab /
 * dibatalkan), waktu, dan durasi (Mono) bila tersambung.
 *
 * Keputusan non-obvious:
 *   - Ikon mengikuti HASIL, bukan arah: VideoCamera (selesai), PhoneX (ditolak
 *     / tidak dijawab), PhoneSlash (dibatalkan). Arah (masuk/keluar) hanya
 *     muncul di subtitle "Diminta oleh Anda / lawan" — di sengketa, yang
 *     penting adalah apakah mediasi terjadi.
 *   - IconBox `surface` untuk semua hasil, tone teks danger hanya di subtitle
 *     "Ditolak" — panggilan gagal bukan kesalahan sistem dan tidak boleh
 *     terlihat seperti error (§2.3, §12).
 *   - Durasi dirender `formatCountdown` (mm:ss / h:mm:ss) di kolom trailing
 *     Mono — data presisi (§3.1). Tanpa durasi -> "—" agar kolom tetap
 *     sejajar antar baris.
 *   - Panggilan yang sedang berlangsung (`ONGOING`) memakai StatusIndicator
 *     pulse; tap membuka layar panggilan (`onPress`).
 */
import { PhoneSlash, PhoneX, VideoCamera } from "phosphor-react-native"
import { View } from "react-native"

import type { IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Text } from "@/components/ui/text"
import { formatCountdown } from "@/lib/format"

export type DisputeCallOutcome = "COMPLETED" | "REJECTED" | "MISSED" | "CANCELLED" | "ONGOING"

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
  requestedBy: string
}

const DEFAULT_LABELS: DisputeCallLogItemLabels = {
  outcome: {
    COMPLETED: "Panggilan selesai",
    REJECTED: "Ditolak",
    MISSED: "Tidak dijawab",
    CANCELLED: "Dibatalkan",
    ONGOING: "Sedang berlangsung",
  },
  requestedByYou: "Diminta oleh Anda",
  requestedBy: "Diminta oleh",
}

export type DisputeCallLogItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing" | "chevron"> & {
  outcome: DisputeCallOutcome
  /** Apakah user yang meminta panggilan */
  requestedByMe: boolean
  /** Nama pihak lain (pemohon bila bukan saya) */
  counterpartName: string
  /** Sudah diformat pemanggil (§13) */
  timestamp?: string
  /** Detik tersambung — hanya untuk COMPLETED */
  durationSeconds?: number
  labels?: Partial<Omit<DisputeCallLogItemLabels, "outcome">> & { outcome?: Partial<DisputeCallLogItemLabels["outcome"]> }
}

export function DisputeCallLogItem({
  outcome,
  requestedByMe,
  counterpartName,
  timestamp,
  durationSeconds,
  labels,
  onPress,
  inset = true,
  ...rest
}: DisputeCallLogItemProps) {
  const t: DisputeCallLogItemLabels = { ...DEFAULT_LABELS, ...labels, outcome: { ...DEFAULT_LABELS.outcome, ...labels?.outcome } }
  const ongoing = outcome === "ONGOING"
  const failed = outcome === "REJECTED" || outcome === "MISSED"
  const requester = requestedByMe ? t.requestedByYou : `${t.requestedBy} ${counterpartName}`
  const duration = outcome === "COMPLETED" && durationSeconds != null ? formatCountdown(durationSeconds) : "—"

  return (
    <ListItem
      title={t.outcome[outcome]}
      subtitle={
        <Text variant="caption" tone={failed ? "danger" : "secondary"} numberOfLines={1}>
          {[requester, timestamp].filter(Boolean).join(" · ")}
        </Text>
      }
      leading={<IconBox icon={OUTCOME_ICON[outcome]} size="md" variant="surface" active={ongoing} />}
      trailing={
        ongoing ? (
          <StatusIndicator label={t.outcome.ONGOING} tone="success" pulse size="sm" />
        ) : (
          <View className="items-end">
            <Text variant="monoBody" tone={outcome === "COMPLETED" ? "primary" : "disabled"}>
              {duration}
            </Text>
          </View>
        )
      }
      chevron={ongoing && !!onPress}
      onPress={onPress}
      inset={inset}
      accessibilityLabel={[t.outcome[outcome], requester, timestamp, outcome === "COMPLETED" ? `durasi ${duration}` : undefined]
        .filter(Boolean)
        .join(", ")}
      {...rest}
    />
  )
}
