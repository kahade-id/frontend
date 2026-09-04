/**
 * Kahade — <MutualResolutionCard> proposal penyelesaian bersama (§9.6 Card,
 * §3.1 Mono nominal, §9.18 chart monokrom, §10 konfirmasi = Dialog).
 *
 * Untuk `GET/POST /v1/disputes/{id}/mutual-resolution` dan respon
 * `.../{proposalId}/respond` (accept/reject) serta `DELETE` (withdraw own).
 * Satu proposal = pembagian dana yang ditahan escrow: X ke pembeli, Y ke
 * penjual (X + Y = total), plus catatan pengusul.
 *
 * Anatomi:
 *   header  : "Proposal dari Anda / {nama}" + Badge status proposal
 *   split   : bar horizontal dua segmen (pembeli | penjual) + dua KeyValue
 *             nominal Mono di bawahnya
 *   catatan : teks pengusul (opsional)
 *   aksi    : penerima -> [Tolak ghost] [Terima primary]
 *             pengusul  -> [Tarik proposal ghost]
 *
 * Keputusan non-obvious:
 *   - Bar split memakai dua abu monokrom (gray.800 untuk bagian yang
 *     kembali ke USER, gray.400 untuk lawan) — BUKAN hijau/merah. Split
 *     adalah pembagian, bukan menang/kalah; warna semantik disimpan untuk
 *     status proposal (§2.3). "Bagian Anda" selalu yang lebih gelap supaya
 *     mata langsung menemukan angka yang relevan.
 *   - Persentase ditampilkan Sofia Sans tabular (bukan Mono) karena menyatu
 *     dengan label; nominal Rupiah tetap <Amount> Mono (§3.1).
 *   - Aksi Terima adalah pergerakan dana escrow final -> pemanggil WAJIB
 *     Dialog konfirmasi (§10). Komponen hanya memanggil `onAccept`.
 *   - `expiresAt` -> Countdown kecil di header; proposal kedaluwarsa
 *     ditandai server (status EXPIRED), komponen hanya memicu `onExpire`.
 *   - Proposal non-PENDING menyembunyikan semua tombol; `respondedAt`
 *     tampil sebagai caption di footer agar riwayat tetap terbaca.
 */
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Countdown } from "@/components/ui/countdown"
import type { OrderRole } from "@/components/ui/order-status-badge"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type MutualResolutionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED"

export const MUTUAL_RESOLUTION_LABELS: Record<MutualResolutionStatus, string> = {
  PENDING: "Menunggu tanggapan",
  ACCEPTED: "Diterima",
  REJECTED: "Ditolak",
  WITHDRAWN: "Ditarik",
  EXPIRED: "Kedaluwarsa",
}

const STATUS_TONE: Record<MutualResolutionStatus, BadgeTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
  EXPIRED: "neutral",
}

export type MutualResolutionCardLabels = {
  fromYou: string
  from: (name: string) => string
  buyerShare: string
  sellerShare: string
  yourShare: string
  note: string
  accept: string
  reject: string
  withdraw: string
  expiresIn: string
  respondedAt: string
  status: Record<MutualResolutionStatus, string>
}

const DEFAULT_LABELS: MutualResolutionCardLabels = {
  fromYou: "Proposal dari Anda",
  from: (name) => `Proposal dari ${name}`,
  buyerShare: "Ke pembeli",
  sellerShare: "Ke penjual",
  yourShare: "Bagian Anda",
  note: "Catatan",
  accept: "Terima proposal",
  reject: "Tolak",
  withdraw: "Tarik proposal",
  expiresIn: "Berlaku",
  respondedAt: "Ditanggapi",
  status: MUTUAL_RESOLUTION_LABELS,
}

// `role` di-Omit: ViewProps RN punya `role?: Role` (a11y) yang disjoint dengan OrderRole
export type MutualResolutionCardProps = Omit<ViewProps, "children" | "role"> & {
  /** Total dana yang ditahan escrow */
  totalAmount: number
  buyerAmount: number
  sellerAmount: number
  status: MutualResolutionStatus | string
  /** Apakah USER yang mengusulkan */
  proposedByMe: boolean
  proposerName?: string
  /** Peran USER di order — menentukan "bagian Anda" */
  role: OrderRole
  note?: string
  /** Sudah diformat (§13) */
  createdAt?: string
  respondedAt?: string
  expiresAt?: Date | number
  onExpire?: () => void
  onAccept?: () => void
  onReject?: () => void
  onWithdraw?: () => void
  accepting?: boolean
  rejecting?: boolean
  withdrawing?: boolean
  labels?: Partial<MutualResolutionCardLabels>
  className?: string
}

function pct(part: number, total: number) {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

export function MutualResolutionCard({
  totalAmount,
  buyerAmount,
  sellerAmount,
  status,
  proposedByMe,
  proposerName,
  role,
  note,
  createdAt,
  respondedAt,
  expiresAt,
  onExpire,
  onAccept,
  onReject,
  onWithdraw,
  accepting = false,
  rejecting = false,
  withdrawing = false,
  labels,
  className,
  ...rest
}: MutualResolutionCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels, status: { ...DEFAULT_LABELS.status, ...labels?.status } }
  const known = (Object.keys(STATUS_TONE) as MutualResolutionStatus[]).includes(status as MutualResolutionStatus)
  const st = (known ? status : "PENDING") as MutualResolutionStatus
  const pending = st === "PENDING"
  const busy = accepting || rejecting || withdrawing

  const buyerPct = pct(buyerAmount, totalAmount)
  const sellerPct = 100 - buyerPct
  const myShare = role === "buyer" ? buyerAmount : sellerAmount

  const title = proposedByMe ? t.fromYou : t.from(proposerName ?? "")

  return (
    <Card variant="elevated" className={cn("gap-4", className)} accessibilityLabel={title} {...rest}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-[2px]">
          <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
            {title}
          </Text>
          {createdAt ? (
            <Text variant="caption" tone="tertiary" className="tabular-nums">
              {createdAt}
            </Text>
          ) : null}
        </View>
        <Badge tone={STATUS_TONE[st]} dot>
          {known ? t.status[st] : status}
        </Badge>
      </View>

      {/* Bar split monokrom — bagian USER lebih gelap */}
      <View className="gap-2">
        <View
          className="h-2 w-full flex-row overflow-hidden rounded-full bg-border"
          accessibilityRole="progressbar"
          accessibilityLabel={`${t.buyerShare} ${buyerPct}%, ${t.sellerShare} ${sellerPct}%`}
        >
          {/* bagian USER = primary (invert otomatis di dark), lawan = text-tertiary */}
          <View
            className={cn("h-full", role === "buyer" ? "bg-primary" : "bg-text-tertiary")}
            style={{ width: `${buyerPct}%` }}
          />
          <View
            className={cn("h-full", role === "seller" ? "bg-primary" : "bg-text-tertiary")}
            style={{ width: `${sellerPct}%` }}
          />
        </View>

        <View className="flex-row justify-between gap-4">
          <View className="flex-1 gap-[2px]">
            <Text variant="caption" tone={role === "buyer" ? "primary" : "tertiary"} weight={role === "buyer" ? 500 : 400}>
              {`${t.buyerShare} · ${buyerPct}%`}
            </Text>
            <Amount value={buyerAmount} size="body" tone={role === "buyer" ? "primary" : "secondary"} />
          </View>
          <View className="flex-1 items-end gap-[2px]">
            <Text variant="caption" tone={role === "seller" ? "primary" : "tertiary"} weight={role === "seller" ? 500 : 400}>
              {`${t.sellerShare} · ${sellerPct}%`}
            </Text>
            <Amount value={sellerAmount} size="body" tone={role === "seller" ? "primary" : "secondary"} />
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between rounded-sm border border-border bg-surface px-4 py-3">
        <Text variant="label" tone="secondary">
          {t.yourShare}
        </Text>
        <Amount value={myShare} size="body" tone="primary" />
      </View>

      {note ? (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {t.note}
          </Text>
          <Text variant="body" tone="primary">
            {note}
          </Text>
        </View>
      ) : null}

      {pending && expiresAt != null ? (
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="secondary">
            {t.expiresIn}
          </Text>
          <Countdown until={expiresAt} tone="primary" onComplete={onExpire} />
        </View>
      ) : null}

      {!pending && respondedAt ? (
        <Text variant="caption" tone="tertiary" className="tabular-nums">
          {`${t.respondedAt} ${respondedAt}`}
        </Text>
      ) : null}

      {pending && !proposedByMe && (onAccept || onReject) ? (
        <View className="flex-row gap-3">
          {onReject ? (
            <View className="flex-1">
              <Button variant="ghost" onPress={onReject} loading={rejecting} disabled={busy && !rejecting}>
                {t.reject}
              </Button>
            </View>
          ) : null}
          {onAccept ? (
            <View className="flex-1">
              <Button variant="primary" onPress={onAccept} loading={accepting} disabled={busy && !accepting}>
                {t.accept}
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}

      {pending && proposedByMe && onWithdraw ? (
        <Button variant="ghost" onPress={onWithdraw} loading={withdrawing} disabled={busy && !withdrawing}>
          {t.withdraw}
        </Button>
      ) : null}
    </Card>
  )
}
