/**
 * Kahade — <OrderExtensionCard> permintaan perpanjangan tenggat (§9.6 Card,
 * §13 tanggal eksplisit, §10 konfirmasi = Dialog).
 *
 * Untuk `GET/POST /v1/orders/{id}/extensions` (RequestExtensionDto:
 * extensionDays, reason) dan `PUT .../extensions/{extId}` (RespondExtensionDto:
 * action APPROVE|REJECT, note). Penjual yang terlambat meminta tambahan
 * hari; pembeli menyetujui/menolak.
 *
 * Anatomi:
 *   header  : "Permintaan dari Anda/{nama}" + Badge status
 *   tenggat : "Tenggat saat ini -> tenggat baru" dengan tanda panah, dan
 *             angka hari tambahan yang menonjol (Sofia Sans 600, bukan Mono:
 *             "+3 hari" menyatu dengan kalimat §3.1)
 *   alasan  : teks pemohon
 *   catatan : balasan penanggap (bila sudah direspons)
 *   aksi    : penanggap + PENDING -> [Tolak ghost] [Setujui primary]
 *
 * Keputusan non-obvious:
 *   - Tanggal lama dan baru ditampilkan berdampingan lengkap ("3 Sep 2026" ->
 *     "6 Sep 2026"), BUKAN hanya "+3 hari": §13 menuntut tanggal eksplisit,
 *     dan pembeli memutuskan berdasar TANGGAL baru, bukan selisih.
 *   - Menyetujui memperpanjang masa dana tertahan di escrow -> pemanggil
 *     WAJIB Dialog konfirmasi (§10); komponen hanya memanggil `onApprove`.
 *   - `requestedByMe` menyembunyikan aksi (server menolak respons sendiri).
 */
import { ArrowRight } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatDate } from "@/lib/format"

export type OrderExtensionStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"

export const ORDER_EXTENSION_LABELS: Record<OrderExtensionStatus, string> = {
  PENDING: "Menunggu persetujuan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  EXPIRED: "Kedaluwarsa",
}

const STATUS_TONE: Record<OrderExtensionStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  EXPIRED: "neutral",
}

export type OrderExtensionCardLabels = {
  fromYou: string
  from: (name: string) => string
  currentDeadline: string
  newDeadline: string
  extraDays: (n: number) => string
  reason: string
  responseNote: string
  approve: string
  reject: string
  status: Record<OrderExtensionStatus, string>
}

const DEFAULT_LABELS: OrderExtensionCardLabels = {
  fromYou: "Permintaan perpanjangan dari Anda",
  from: (name) => `Permintaan perpanjangan dari ${name}`,
  currentDeadline: "Tenggat saat ini",
  newDeadline: "Tenggat baru",
  extraDays: (n) => `+${n} hari`,
  reason: "Alasan",
  responseNote: "Catatan tanggapan",
  approve: "Setujui",
  reject: "Tolak",
  status: ORDER_EXTENSION_LABELS,
}

export type OrderExtensionCardProps = Omit<ViewProps, "children"> & {
  extensionDays: number
  currentDeadline: Date | number | string
  reason?: string
  status: OrderExtensionStatus | string
  requestedByMe: boolean
  requesterName?: string
  /** Catatan dari penanggap (bila sudah direspons) */
  responseNote?: string
  /** Sudah diformat (§13) */
  requestedAt?: string
  onApprove?: () => void
  onReject?: () => void
  approving?: boolean
  rejecting?: boolean
  labels?: Partial<OrderExtensionCardLabels>
  className?: string
}

export function addDays(d: Date | number | string, days: number): Date {
  const base = d instanceof Date ? new Date(d.getTime()) : new Date(d)
  base.setDate(base.getDate() + days)
  return base
}

export function OrderExtensionCard({
  extensionDays,
  currentDeadline,
  reason,
  status,
  requestedByMe,
  requesterName,
  responseNote,
  requestedAt,
  onApprove,
  onReject,
  approving = false,
  rejecting = false,
  labels,
  className,
  ...rest
}: OrderExtensionCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels, status: { ...DEFAULT_LABELS.status, ...labels?.status } }
  const known = status in STATUS_TONE
  const st = (known ? status : "PENDING") as OrderExtensionStatus
  const pending = st === "PENDING"
  const busy = approving || rejecting
  const newDeadline = addDays(currentDeadline, extensionDays)
  const title = requestedByMe ? t.fromYou : t.from(requesterName ?? "")

  return (
    <Card variant="elevated" className={cn("gap-4", className)} accessibilityLabel={title} {...rest}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-[2px]">
          <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
            {title}
          </Text>
          {requestedAt ? (
            <Text variant="caption" tone="tertiary" className="tabular-nums">
              {requestedAt}
            </Text>
          ) : null}
        </View>
        <Badge tone={STATUS_TONE[st]} dot>
          {known ? t.status[st] : status}
        </Badge>
      </View>

      <View className="flex-row items-center gap-3 rounded-sm border border-border bg-surface px-4 py-3">
        <View className="flex-1 gap-[2px]">
          <Text variant="caption" tone="tertiary">
            {t.currentDeadline}
          </Text>
          <Text variant="body" weight={500} tone="secondary">
            {formatDate(currentDeadline)}
          </Text>
        </View>
        <View className="items-center gap-[2px]">
          <Icon icon={ArrowRight} size="sm" />
          <Text variant="caption" weight={600} tone="primary">
            {t.extraDays(extensionDays)}
          </Text>
        </View>
        <View className="flex-1 items-end gap-[2px]">
          <Text variant="caption" tone="tertiary">
            {t.newDeadline}
          </Text>
          <Text variant="body" weight={600} tone="primary">
            {formatDate(newDeadline)}
          </Text>
        </View>
      </View>

      {reason ? (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {t.reason}
          </Text>
          <Text variant="body" tone="primary">
            {reason}
          </Text>
        </View>
      ) : null}

      {!pending && responseNote ? (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {t.responseNote}
          </Text>
          <Text variant="body" tone="primary">
            {responseNote}
          </Text>
        </View>
      ) : null}

      {pending && !requestedByMe && (onApprove || onReject) ? (
        <View className="flex-row gap-3">
          {onReject ? (
            <View className="flex-1">
              <Button variant="ghost" onPress={onReject} loading={rejecting} disabled={busy && !rejecting}>
                {t.reject}
              </Button>
            </View>
          ) : null}
          {onApprove ? (
            <View className="flex-1">
              <Button variant="primary" onPress={onApprove} loading={approving} disabled={busy && !approving}>
                {t.approve}
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}
