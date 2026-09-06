/**
 * Kahade — <MutualResolutionCard> proposal penyelesaian bersama (§9.6 Card,
 * §3.1 Mono nominal, §9.18 chart monokrom, §10 konfirmasi = Dialog/PIN).
 *
 * Untuk `GET/POST /v1/disputes/{id}/mutual-resolution` dan respon
 * `.../{proposalId}/respond` (accept/reject) serta `DELETE .../{proposalId}`
 * (withdraw own). Satu proposal = pembagian dana yang ditahan escrow: X ke
 * pembeli, Y ke penjual (X + Y = total), plus catatan pengusul.
 *
 * Anatomi:
 *   header  : Avatar xs + "Proposal dari Anda / {nama}" + Badge status
 *   split   : bar horizontal dua segmen (pembeli | penjual) + dua kolom
 *             nominal Mono di bawahnya + strip "Bagian Anda"
 *   catatan : teks pengusul (opsional)
 *   footer  : createdAt kiri, Countdown kedaluwarsa kanan (PENDING) atau
 *             "Ditanggapi {waktu}" (final)
 *   aksi    : penerima -> [Tolak ghost] [Setuju primary]
 *             pengusul  -> [Tarik proposal ghost]
 *
 * Keputusan non-obvious:
 *   - Bar split monokrom: bagian USER = `bg-primary`, lawan = `bg-text-
 *     tertiary` — BUKAN hijau/merah. Split adalah pembagian, bukan
 *     menang/kalah; warna semantik disimpan untuk status (§2.3). "Bagian
 *     Anda" selalu yang lebih gelap supaya mata langsung menemukan angka
 *     yang relevan. Bar hanya bantu visual; angka rupiah tetap terbaca
 *     langsung tanpa hitung (§1 presisi), a11y via accessibilityValue.
 *   - Nominal di-clamp ke [0, total] dan porsi penjual dihitung dari sisa
 *     bila `sellerAmount` tidak dikirim, sehingga invarian X + Y = total
 *     selalu terjaga meski payload server aneh.
 *   - Persentase Sofia Sans tabular (bukan Mono) karena menyatu dengan
 *     label; nominal Rupiah tetap <Amount> Mono (§3.1).
 *   - Tombol setuju berlabel "Setuju", BUKAN "Terima", agar tidak rancu
 *     dengan "penjual menerima dana". Aksi ini memindahkan dana escrow
 *     final -> pemanggil WAJIB konfirmasi (Dialog §10 / PIN §9.21);
 *     komponen hanya memanggil `onAccept`.
 *   - REJECTED / WITHDRAWN / EXPIRED bertone neutral: menolak usulan
 *     adalah hak pihak lain, bukan kegagalan sistem (§2.3 merah = error).
 *     Dot Badge hanya berdenyut saat PENDING.
 *   - Proposal final tetap dirender penuh tanpa penurunan opacity —
 *     riwayat negosiasi harus tetap terbaca (AA); pembeda cukup Badge,
 *     hilangnya tombol, dan caption `respondedAt`.
 *   - `expiresAt` -> Countdown tone secondary (informasi, bukan alarm);
 *     status EXPIRED ditetapkan server, komponen hanya memicu `onExpire`.
 *   - `status` menerima string asing dari server (fallback PENDING untuk
 *     tone, label mentah ditampilkan) supaya enum baru tidak meledakkan UI.
 */
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary } from "@/components/ui/card"
import { Countdown } from "@/components/ui/countdown"
import type { OrderRole } from "@/components/ui/order-status-badge"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { hasOwn } from "@/lib/has-own"

export type MutualResolutionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED"

export const MUTUAL_RESOLUTION_LABELS: Record<MutualResolutionStatus, string> = {
  PENDING: "Menunggu tanggapan",
  ACCEPTED: "Disepakati",
  REJECTED: "Ditolak",
  WITHDRAWN: "Ditarik",
  EXPIRED: "Kedaluwarsa",
}

const STATUS_TONE: Record<MutualResolutionStatus, BadgeTone> = {
  PENDING: "warning",
  ACCEPTED: "success",
  REJECTED: "neutral",
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
  buyerShare: "Kembali ke pembeli",
  sellerShare: "Diterima penjual",
  yourShare: "Bagian Anda",
  note: "Catatan",
  accept: "Setuju",
  reject: "Tolak",
  withdraw: "Tarik proposal",
  expiresIn: "Berakhir dalam",
  respondedAt: "Ditanggapi",
  status: MUTUAL_RESOLUTION_LABELS,
}

// `role` di-Omit: ViewProps RN punya `role?: Role` (a11y) yang disjoint dengan OrderRole
export type MutualResolutionCardProps = Omit<ViewProps, "children" | "role"> & {
  /** Total dana yang ditahan escrow */
  totalAmount: number
  /** Porsi yang dikembalikan ke pembeli */
  buyerAmount: number
  /** Porsi yang dirilis ke penjual — default `totalAmount - buyerAmount` */
  sellerAmount?: number
  status: MutualResolutionStatus | string
  /** Apakah USER yang mengusulkan */
  proposedByMe: boolean
  proposerName?: string
  proposerAvatar?: AvatarProps["source"]
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
  labels?: Partial<Omit<MutualResolutionCardLabels, "status">> & {
    status?: Partial<MutualResolutionCardLabels["status"]>
  }
  className?: string
}

export function MutualResolutionCard({
  totalAmount,
  buyerAmount,
  sellerAmount,
  status,
  proposedByMe,
  proposerName,
  proposerAvatar,
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
  const t: MutualResolutionCardLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    status: { ...DEFAULT_LABELS.status, ...labels?.status },
  }
  // Own keys only: `in` matches inherited keys too, and rendering an
  // inherited non-string (e.g. "toString") as the status label crashes React.
  const known = hasOwn(STATUS_TONE, status)
  const st = (known ? status : "PENDING") as MutualResolutionStatus
  const pending = st === "PENDING"
  const busy = accepting || rejecting || withdrawing

  // Invarian: 0 <= buyer <= total, seller = sisa (atau nilai server yang di-clamp)
  const safeTotal = Math.max(totalAmount, 0)
  const buyer = Math.min(Math.max(buyerAmount, 0), safeTotal)
  const seller = sellerAmount == null ? safeTotal - buyer : Math.min(Math.max(sellerAmount, 0), safeTotal - buyer)
  const buyerPct = safeTotal > 0 ? Math.round((buyer / safeTotal) * 100) : 0
  const sellerPct = 100 - buyerPct
  const isBuyer = role === "buyer"
  const myShare = isBuyer ? buyer : seller

  const title = proposedByMe ? t.fromYou : t.from(proposerName ?? "")
  const statusLabel = known ? t.status[st] : status
  const avatarName = proposedByMe ? undefined : proposerName

  return (
    // Root tanpa `accessible`: kartu berisi Button Terima/Tolak/Tarik, bar split
    // ber-`accessibilityRole="progressbar"`, dan <Countdown> live — semuanya
    // harus tetap jadi elemen SR sendiri. Yang dikelompokkan hanya blok teks
    // statis (audit #4).
    <Card variant="elevated" className={cn("gap-4", className)} {...rest}>
      <CardSummary
        className="flex-row items-center justify-between gap-3"
        label={summarize([title, statusLabel, createdAt])}
      >
        <View className="flex-1 flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-2">
            {proposerAvatar || avatarName ? <Avatar source={proposerAvatar} name={avatarName} size="xs" /> : null}
            <View className="flex-1 gap-[2px]">
              <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
                {title}
              </Text>
              {createdAt ? (
                <Text variant="caption" tone="secondary" className="tabular-nums">
                  {createdAt}
                </Text>
              ) : null}
            </View>
          </View>
          <Badge tone={STATUS_TONE[st]} variant="soft" dot={pending}>
            {statusLabel}
          </Badge>
        </View>

      </CardSummary>

      {/* Bar split monokrom — bagian USER lebih gelap */}
      <View className="gap-2">
        <View
          className="h-2 w-full flex-row overflow-hidden rounded-full bg-border"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${t.buyerShare} ${buyerPct}%, ${t.sellerShare} ${sellerPct}%`}
          accessibilityValue={{ min: 0, max: 100, now: buyerPct, text: `${buyerPct}% ke pembeli` }}
        >
          <View className={cn("h-full", isBuyer ? "bg-primary" : "bg-text-tertiary")} style={{ width: `${buyerPct}%` }} />
          <View className={cn("h-full", isBuyer ? "bg-text-tertiary" : "bg-primary")} style={{ width: `${sellerPct}%` }} />
        </View>

        <View
          accessible
          accessibilityLabel={summarize([
            `${t.buyerShare} ${buyerPct}%, ${buyer} rupiah`,
            `${t.sellerShare} ${sellerPct}%, ${seller} rupiah`,
          ])}
          className="flex-row justify-between gap-4"
        >
          <View className="flex-1 gap-[2px]">
            <Text variant="caption" tone={isBuyer ? "primary" : "secondary"} weight={isBuyer ? 500 : 400} className="tabular-nums">
              {`${t.buyerShare} · ${buyerPct}%`}
            </Text>
            <Amount value={buyer} size="body" tone={isBuyer ? "primary" : "secondary"} />
          </View>
          <View className="flex-1 items-end gap-[2px]">
            <Text variant="caption" tone={isBuyer ? "secondary" : "primary"} weight={isBuyer ? 400 : 500} className="tabular-nums">
              {`${t.sellerShare} · ${sellerPct}%`}
            </Text>
            <Amount value={seller} size="body" tone={isBuyer ? "secondary" : "primary"} />
          </View>
        </View>
      </View>

      <View
        accessible
        accessibilityLabel={`${t.yourShare} ${myShare} rupiah`}
        className="flex-row items-center justify-between rounded-sm border border-border bg-surface px-4 py-3"
      >
        <Text variant="label" tone="secondary">
          {t.yourShare}
        </Text>
        <Amount value={myShare} size="body" tone="primary" />
      </View>

      {note ? (
        <View accessible accessibilityLabel={`${t.note}: ${note}`} className="gap-1">
          <Text variant="label" tone="secondary">
            {t.note}
          </Text>
          <Text variant="body" tone="primary">
            {note}
          </Text>
        </View>
      ) : null}

      {pending && expiresAt != null ? (
        <View className="flex-row items-center justify-end">
          <Countdown until={expiresAt} prefix={t.expiresIn} tone="secondary" onComplete={onExpire} />
        </View>
      ) : null}

      {!pending && respondedAt ? (
        <Text variant="caption" tone="secondary" className="tabular-nums">
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
