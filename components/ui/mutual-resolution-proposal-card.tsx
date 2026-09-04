/**
 * Kahade — <MutualResolutionProposalCard> (§9.6 Card, §9.1 Button, §3.1 Mono
 * nominal, §2.3 semantic status, §12 Voice & Tone).
 *
 * Satu proposal dari `GET /v1/disputes/{id}/mutual-resolution`: pihak yang
 * mengajukan, pembagian dana (refund ke pembeli vs. rilis ke penjual), pesan,
 * status, dan aksi. Aksi bercabang menurut siapa yang mengajukan:
 *   - proposal LAWAN yang masih PENDING -> "Tolak" (secondary) + "Setuju"
 *     (primary)  -> POST .../{proposalId}/respond
 *   - proposal SAYA yang masih PENDING  -> "Tarik proposal" (ghost)
 *     -> DELETE .../{proposalId}
 *   - status final -> tanpa tombol, Badge saja.
 *
 * Keputusan non-obvious:
 *   - Pembagian dana ditampilkan sebagai DUA baris <KeyValue> ("Kembali ke
 *     pembeli" / "Diterima penjual") + bar proporsi tipis monokrom di bawahnya,
 *     BUKAN persen saja. Uang adalah hal yang disepakati — angka rupiah
 *     harus terbaca langsung tanpa hitung (§1 presisi). Bar hanya bantu visual;
 *     fill `primary` untuk porsi pembeli, track `border-default` sisanya —
 *     tidak ada dua warna (§2.3 semantic disimpan untuk status).
 *   - Tombol "Setuju" adalah aksi final yang memindahkan uang: pemanggil WAJIB
 *     membungkusnya dengan konfirmasi PIN (§9.21) — komponen hanya memanggil
 *     `onAccept`. Label tombol tidak memakai kata "Terima" agar tidak rancu
 *     dengan "penjual menerima dana".
 *   - Proposal kedaluwarsa (`expiresAt`) ditampilkan <Countdown tone
 *     "secondary"> — informasi, bukan alarm.
 *   - Proposal lama (`REJECTED`/`WITHDRAWN`/`EXPIRED`) tetap dirender penuh
 *     tetapi `opacity` tidak diturunkan; pembeda cukup Badge + hilangnya
 *     tombol. Riwayat negosiasi harus tetap terbaca jelas (AA).
 */
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Countdown } from "@/components/ui/countdown"
import { KeyValue } from "@/components/ui/key-value"
import { Amount } from "@/components/ui/amount"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type MutualResolutionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED"

const STATUS_TONE: Record<MutualResolutionStatus, BadgeTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  REJECTED: "neutral",
  WITHDRAWN: "neutral",
  EXPIRED: "neutral",
}

export type MutualResolutionProposalCardLabels = {
  status: Record<MutualResolutionStatus, string>
  proposedByYou: string
  proposedBy: string
  refundToBuyer: string
  releaseToSeller: string
  expiresIn: string
  accept: string
  reject: string
  withdraw: string
}

const DEFAULT_LABELS: MutualResolutionProposalCardLabels = {
  status: {
    PENDING: "Menunggu",
    ACCEPTED: "Disepakati",
    REJECTED: "Ditolak",
    WITHDRAWN: "Ditarik",
    EXPIRED: "Kedaluwarsa",
  },
  proposedByYou: "Usulan Anda",
  proposedBy: "Usulan dari",
  refundToBuyer: "Kembali ke pembeli",
  releaseToSeller: "Diterima penjual",
  expiresIn: "Berakhir dalam",
  accept: "Setuju",
  reject: "Tolak",
  withdraw: "Tarik usulan",
}

export type MutualResolutionProposalCardProps = Omit<ViewProps, "children"> & {
  proposer: { name: string; avatar?: AvatarProps["source"] }
  /** Apakah user sendiri yang mengajukan */
  isMine: boolean
  /** Total dana yang tertahan di escrow */
  totalAmount: number
  /** Porsi yang dikembalikan ke pembeli; sisanya dirilis ke penjual */
  refundAmount: number
  message?: string
  status: MutualResolutionStatus
  /** Sudah diformat pemanggil (§13) */
  createdAt?: string
  expiresAt?: Date | number
  onExpire?: () => void
  onAccept?: () => void
  onReject?: () => void
  onWithdraw?: () => void
  /** Sedang mengirim respons/withdraw */
  busy?: boolean
  labels?: Partial<Omit<MutualResolutionProposalCardLabels, "status">> & {
    status?: Partial<MutualResolutionProposalCardLabels["status"]>
  }
  className?: string
}

export function MutualResolutionProposalCard({
  proposer,
  isMine,
  totalAmount,
  refundAmount,
  message,
  status,
  createdAt,
  expiresAt,
  onExpire,
  onAccept,
  onReject,
  onWithdraw,
  busy = false,
  labels,
  className,
  ...rest
}: MutualResolutionProposalCardProps) {
  const t: MutualResolutionProposalCardLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    status: { ...DEFAULT_LABELS.status, ...labels?.status },
  }
  const safeTotal = Math.max(totalAmount, 0)
  const refund = Math.min(Math.max(refundAmount, 0), safeTotal)
  const release = safeTotal - refund
  const refundPct = safeTotal > 0 ? Math.round((refund / safeTotal) * 100) : 0
  const pending = status === "PENDING"

  return (
    <Card
      variant="elevated"
      padded
      accessibilityLabel={`${isMine ? t.proposedByYou : `${t.proposedBy} ${proposer.name}`}, ${t.status[status]}, ${t.refundToBuyer} ${refund} rupiah, ${t.releaseToSeller} ${release} rupiah`}
      className={cn("gap-4", className)}
      {...rest}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Avatar source={proposer.avatar} name={proposer.name} size="xs" />
          <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
            {isMine ? (
              t.proposedByYou
            ) : (
              <>
                <Text variant="inherit" tone="tertiary">
                  {t.proposedBy}{" "}
                </Text>
                {proposer.name}
              </>
            )}
          </Text>
        </View>
        <Badge tone={STATUS_TONE[status]} variant="soft" dot={pending}>
          {t.status[status]}
        </Badge>
      </View>

      <View className="gap-2">
        <KeyValue label={t.refundToBuyer} value={<Amount value={refund} size="body" />} />
        <KeyValue label={t.releaseToSeller} value={<Amount value={release} size="body" />} />
        {/* Bar proporsi: monokrom, hanya bantu visual */}
        <View
          className="h-1 w-full flex-row overflow-hidden rounded-full bg-border"
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: refundPct, text: `${refundPct}% ke pembeli` }}
        >
          <View className="h-full rounded-full bg-primary" style={{ width: `${refundPct}%` }} />
        </View>
      </View>

      {message ? (
        <Text variant="body" tone="secondary">
          {message}
        </Text>
      ) : null}

      {createdAt || (pending && expiresAt != null) ? (
        <View className="flex-row items-center justify-between gap-3">
          {createdAt ? (
            <Text variant="caption" tone="tertiary" className="tabular-nums">
              {createdAt}
            </Text>
          ) : (
            <View />
          )}
          {pending && expiresAt != null ? (
            <Countdown until={expiresAt} prefix={t.expiresIn} tone="secondary" onComplete={onExpire} />
          ) : null}
        </View>
      ) : null}

      {pending && !isMine && (onAccept || onReject) ? (
        <View className="flex-row gap-3">
          {onReject ? (
            <View className="flex-1">
              <Button variant="secondary" onPress={onReject} disabled={busy}>
                {t.reject}
              </Button>
            </View>
          ) : null}
          {onAccept ? (
            <View className="flex-1">
              <Button variant="primary" onPress={onAccept} loading={busy}>
                {t.accept}
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}

      {pending && isMine && onWithdraw ? (
        <Button variant="ghost" onPress={onWithdraw} loading={busy}>
          {t.withdraw}
        </Button>
      ) : null}
    </Card>
  )
}
