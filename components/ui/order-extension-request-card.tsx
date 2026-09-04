/**
 * Kahade — <OrderExtensionRequestCard> (§9.6 Card, §9.7 Badge, §9.1 Button,
 * §13 format tanggal, §12 Voice & Tone).
 *
 * Satu permintaan perpanjangan tenggat dari `GET /v1/orders/{id}/extensions`
 * (`RequestExtensionDto`: extensionDays + reason; `RespondExtensionDto`:
 * APPROVE|REJECT + note). Ditampilkan di detail order sebagai daftar
 * kronologis; hanya permintaan PENDING dari LAWAN yang punya tombol.
 *
 * Keputusan non-obvious:
 *   - Angka hari ditonjolkan sebagai "+3 hari" (Sofia Sans H3 tabular, BUKAN
 *     Mono): ini bagian dari kalimat "meminta tambahan 3 hari", bukan data
 *     presisi yang berdiri sendiri (§3.1 emphasis inline tetap Sans).
 *   - Tenggat lama -> baru ditampilkan berdampingan dengan panah (ArrowRight)
 *     supaya user langsung melihat konsekuensinya tanpa menghitung tanggal.
 *     Pemanggil mengirim string yang sudah diformat (§13).
 *   - Tombol: "Tolak" secondary + "Setujui" primary — setuju adalah jalur
 *     yang diharapkan sistem (menghindari sengketa), maka primary. Catatan
 *     respons (`responseNote`) dirender sebagai kutipan kecil di bawah Badge
 *     hasil.
 *   - Status REJECTED tone neutral, bukan danger: penolakan perpanjangan
 *     adalah hak, bukan kesalahan (§2.3 merah = error/gagal sistem).
 */
import { ArrowRight } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type ExtensionStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"

const STATUS_TONE: Record<ExtensionStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "neutral",
  EXPIRED: "neutral",
}

export type OrderExtensionRequestCardLabels = {
  status: Record<ExtensionStatus, string>
  requestedByYou: string
  requestedBy: string
  days: (n: number) => string
  reason: string
  currentDeadline: string
  newDeadline: string
  approve: string
  reject: string
  responseNote: string
}

const DEFAULT_LABELS: OrderExtensionRequestCardLabels = {
  status: { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak", EXPIRED: "Kedaluwarsa" },
  requestedByYou: "Anda meminta perpanjangan",
  requestedBy: "meminta perpanjangan",
  days: (n) => `+${n} hari`,
  reason: "Alasan",
  currentDeadline: "Tenggat saat ini",
  newDeadline: "Tenggat baru",
  approve: "Setujui",
  reject: "Tolak",
  responseNote: "Catatan",
}

export type OrderExtensionRequestCardProps = Omit<ViewProps, "children"> & {
  requester: { name: string; avatar?: AvatarProps["source"] }
  isMine: boolean
  extensionDays: number
  reason: string
  status: ExtensionStatus
  /** Sudah diformat pemanggil (§13) */
  currentDeadline: string
  newDeadline: string
  createdAt?: string
  responseNote?: string
  onApprove?: () => void
  onReject?: () => void
  busy?: boolean
  labels?: Partial<Omit<OrderExtensionRequestCardLabels, "status">> & { status?: Partial<OrderExtensionRequestCardLabels["status"]> }
  className?: string
}

export function OrderExtensionRequestCard({
  requester,
  isMine,
  extensionDays,
  reason,
  status,
  currentDeadline,
  newDeadline,
  createdAt,
  responseNote,
  onApprove,
  onReject,
  busy = false,
  labels,
  className,
  ...rest
}: OrderExtensionRequestCardProps) {
  const t: OrderExtensionRequestCardLabels = { ...DEFAULT_LABELS, ...labels, status: { ...DEFAULT_LABELS.status, ...labels?.status } }
  const pending = status === "PENDING"
  const canRespond = pending && !isMine && (onApprove || onReject)

  return (
    <Card
      variant="elevated"
      padded
      accessibilityLabel={`${isMine ? t.requestedByYou : `${requester.name} ${t.requestedBy}`} ${t.days(extensionDays)}, ${t.status[status]}`}
      className={cn("gap-4", className)}
      {...rest}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Avatar source={requester.avatar} name={requester.name} size="xs" />
          <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
            {isMine ? (
              t.requestedByYou
            ) : (
              <>
                <Text variant="inherit" weight={600} tone="primary">
                  {requester.name}
                </Text>{" "}
                {t.requestedBy}
              </>
            )}
          </Text>
        </View>
        <Badge tone={STATUS_TONE[status]} variant="soft" dot={pending}>
          {t.status[status]}
        </Badge>
      </View>

      <View className="flex-row items-center gap-4">
        <Text variant="h3" tone="primary" className="tabular-nums">
          {t.days(extensionDays)}
        </Text>
        <View className="flex-1 flex-row items-center gap-2">
          <View className="flex-1 gap-0.5">
            <Text variant="caption" tone="tertiary">
              {t.currentDeadline}
            </Text>
            <Text variant="caption" weight={500} tone="secondary" className="tabular-nums">
              {currentDeadline}
            </Text>
          </View>
          <Icon icon={ArrowRight} size="xs" tone="default" />
          <View className="flex-1 gap-0.5">
            <Text variant="caption" tone="tertiary">
              {t.newDeadline}
            </Text>
            <Text variant="caption" weight={600} tone="primary" className="tabular-nums">
              {newDeadline}
            </Text>
          </View>
        </View>
      </View>

      <View className="gap-1">
        <Text variant="caption" tone="tertiary">
          {t.reason}
        </Text>
        <Text variant="body" tone="secondary">
          {reason}
        </Text>
      </View>

      {responseNote ? (
        <View className="gap-1 border-l-2 border-border pl-3">
          <Text variant="caption" tone="tertiary">
            {t.responseNote}
          </Text>
          <Text variant="body" tone="secondary">
            {responseNote}
          </Text>
        </View>
      ) : null}

      {createdAt ? (
        <Text variant="caption" tone="tertiary" className="tabular-nums">
          {createdAt}
        </Text>
      ) : null}

      {canRespond ? (
        <View className="flex-row gap-3">
          {onReject ? (
            <View className="flex-1">
              <Button variant="secondary" onPress={onReject} disabled={busy}>
                {t.reject}
              </Button>
            </View>
          ) : null}
          {onApprove ? (
            <View className="flex-1">
              <Button variant="primary" onPress={onApprove} loading={busy}>
                {t.approve}
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}
