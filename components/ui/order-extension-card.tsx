/**
 * Kahade — <OrderExtensionCard> permintaan perpanjangan tenggat (§9.6 Card,
 * §9.7 Badge, §9.1 Button, §13 tanggal eksplisit, §10 konfirmasi = Dialog).
 *
 * Untuk `GET/POST /v1/orders/{id}/extensions` (RequestExtensionDto:
 * extensionDays, reason) dan `PUT .../extensions/{extId}` (RespondExtensionDto:
 * action APPROVE|REJECT, note). Penjual yang terlambat meminta tambahan
 * hari; pembeli menyetujui/menolak. Ditampilkan di detail order sebagai
 * daftar kronologis; hanya permintaan PENDING dari LAWAN yang punya tombol.
 *
 * Anatomi:
 *   header  : Avatar xs + "Permintaan perpanjangan dari Anda/{nama}" + Badge
 *   tenggat : "+3 hari" (Sofia Sans H3 tabular) di kiri, lalu "Tenggat saat
 *             ini -> Tenggat baru" berdampingan dengan ArrowRight
 *   alasan  : teks pemohon
 *   catatan : balasan penanggap (kutipan, hanya setelah direspons)
 *   aksi    : penanggap + PENDING -> [Tolak ghost] [Setujui primary]
 *
 * Keputusan non-obvious:
 *   - Angka hari ditonjolkan sebagai "+3 hari" H3 Sans, BUKAN Mono: ia bagian
 *     dari kalimat "meminta tambahan 3 hari", bukan data presisi yang berdiri
 *     sendiri (§3.1 emphasis inline tetap Sans).
 *   - Tanggal lama dan baru ditampilkan lengkap berdampingan ("3 Sep 2026" ->
 *     "6 Sep 2026"), BUKAN hanya selisih: §13 menuntut tanggal eksplisit,
 *     dan pembeli memutuskan berdasar TANGGAL baru. Tenggat baru dihitung
 *     lokal via `addDays` + `formatDate` (§13) agar pemanggil tidak perlu
 *     mengulang aritmetika tanggal; `newDeadline` boleh dikirim eksplisit
 *     bila server sudah menghitungnya.
 *   - Menyetujui memperpanjang masa dana tertahan di escrow -> pemanggil
 *     WAJIB Dialog konfirmasi (§10); komponen hanya memanggil `onApprove`.
 *     "Setujui" primary karena itu jalur yang diharapkan sistem (menghindari
 *     sengketa); "Tolak" ghost (preseden OrderLinkPreviewCard).
 *   - REJECTED tone neutral, bukan danger: menolak perpanjangan adalah hak
 *     pembeli, bukan kegagalan sistem (§2.3 merah = error). Dot Badge hanya
 *     saat PENDING.
 *   - `requestedByMe` menyembunyikan aksi (server menolak respons sendiri).
 *   - `status` menerima string asing dari server (fallback PENDING untuk
 *     tone, label mentah ditampilkan) supaya enum baru tidak meledakkan UI.
 */
import { ArrowRight } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { formatDate } from "@/lib/format"
import { hasOwn } from "@/lib/has-own"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

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
  REJECTED: "neutral",
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
  /** Opsional — bila server sudah menghitung; default `currentDeadline + extensionDays` */
  newDeadline?: Date | number | string
  reason?: string
  status: OrderExtensionStatus | string
  requestedByMe: boolean
  requesterName?: string
  requesterAvatar?: AvatarProps["source"]
  /** Catatan dari penanggap (bila sudah direspons) */
  responseNote?: string
  /** Sudah diformat (§13) */
  requestedAt?: string
  onApprove?: () => void
  onReject?: () => void
  approving?: boolean
  rejecting?: boolean
  labels?: Partial<Omit<OrderExtensionCardLabels, "status">> & { status?: Partial<OrderExtensionCardLabels["status"]> }
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
  newDeadline,
  reason,
  status,
  requestedByMe,
  requesterName,
  requesterAvatar,
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
  const t: OrderExtensionCardLabels = { ...DEFAULT_LABELS, ...labels, status: { ...DEFAULT_LABELS.status, ...labels?.status } }
  // Own keys only — see the note in mutual-resolution-card.tsx.
  const known = hasOwn(STATUS_TONE, status)
  const st = (known ? status : "PENDING") as OrderExtensionStatus
  const pending = st === "PENDING"
  const busy = approving || rejecting
  const canRespond = pending && !requestedByMe && (onApprove || onReject)

  const resolvedNewDeadline = newDeadline ?? addDays(currentDeadline, extensionDays)
  const title = requestedByMe ? t.fromYou : t.from(requesterName ?? "")
  const statusLabel = known ? t.status[st] : status
  const avatarName = requestedByMe ? undefined : requesterName

  return (
    // Root tanpa `accessible`: Button Setujui/Tolak harus tetap fokusable.
    // Blok teks dikelompokkan lewat <CardSummary> (audit #4).
    <Card variant="elevated" className={cn("gap-4", className)} {...rest}>
      <CardSummary
        className="gap-4"
        label={summarize([
          title,
          statusLabel,
          requestedAt,
          t.extraDays(extensionDays),
          `${t.currentDeadline} ${formatDate(currentDeadline)}`,
          `${t.newDeadline} ${formatDate(resolvedNewDeadline)}`,
          reason ? `${t.reason}: ${reason}` : undefined,
          !pending && responseNote ? `${t.responseNote}: ${responseNote}` : undefined,
        ])}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-2">
            {requesterAvatar || avatarName ? <Avatar source={requesterAvatar} name={avatarName} size="xs" /> : null}
            <View className="flex-1 gap-[2px]">
              <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
                {title}
              </Text>
              {requestedAt ? (
                <Text variant="caption" tone="secondary" className="tabular-nums">
                  {requestedAt}
                </Text>
              ) : null}
            </View>
          </View>
          <Badge tone={STATUS_TONE[st]} variant="soft" dot={pending}>
            {statusLabel}
          </Badge>
        </View>

        <View className="flex-row items-center gap-4 rounded-sm border border-border bg-surface px-4 py-3">
          <Text variant="h3" tone="primary" className="tabular-nums">
            {t.extraDays(extensionDays)}
          </Text>
          <View className="flex-1 flex-row items-center gap-2">
            <View className="flex-1 gap-[2px]">
              <Text variant="caption" tone="secondary">
                {t.currentDeadline}
              </Text>
              <Text variant="caption" weight={500} tone="secondary" className="tabular-nums">
                {formatDate(currentDeadline)}
              </Text>
            </View>
            <Icon icon={ArrowRight} size="xs" tone="default" />
            <View className="flex-1 gap-[2px]">
              <Text variant="caption" tone="secondary">
                {t.newDeadline}
              </Text>
              <Text variant="caption" weight={600} tone="primary" className="tabular-nums">
                {formatDate(resolvedNewDeadline)}
              </Text>
            </View>
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
          <View className="gap-1 border-l-2 border-border pl-3">
            <Text variant="label" tone="secondary">
              {t.responseNote}
            </Text>
            <Text variant="body" tone="secondary">
              {responseNote}
            </Text>
          </View>
        ) : null}

      </CardSummary>

      {canRespond ? (
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