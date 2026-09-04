/**
 * Kahade — <DisputeCard> + <DisputeStatusBadge> (§9.6 Card, §9.7 Badge,
 * §3.1 Mono untuk ID, §2.3 semantic eksklusif status, §13 format).
 *
 * Satu baris `GET /v1/disputes/my`. Sengketa selalu menempel pada satu order,
 * jadi anatominya mirip <OrderCard> tetapi yang ditonjolkan adalah PROSES
 * sengketa, bukan barang:
 *   baris 1 : ID sengketa (Mono caption) ..... DisputeStatusBadge
 *   baris 2 : judul order yang disengketakan (body 600)
 *   baris 3 : Avatar lawan + "Diajukan oleh Anda / lawan"
 *   baris 4 : nominal tertahan <Amount> ..... waktu update terakhir
 *   opsional: strip "Tanggapan dibutuhkan" (border-t) bila giliran user
 *
 * Keputusan non-obvious:
 *   - Status sengketa adalah union terpisah dari OrderStatus (order hanya tahu
 *     "DISPUTED"). Tone: OPEN/UNDER_REVIEW = warning (proses berjalan, uang
 *     tertahan), RESOLVED_* = success bila menang / neutral bila kalah, dari
 *     sudut pandang `role` user, CLOSED/WITHDRAWN = neutral. Merah TIDAK
 *     dipakai untuk "kalah" — hasil keputusan admin bukan error sistem (§12
 *     tenang, tidak menghakimi).
 *   - `awaitingYou` (giliran user membalas/menyerahkan bukti) memakai strip
 *     bawah dengan Dot primary + teks, bukan Badge kedua: dua badge di baris
 *     pertama saling bersaing. Ini satu-satunya "perhatian" di kartu (§1).
 *   - Nominal yang ditampilkan adalah dana yang TERTAHAN di escrow, bukan
 *     jumlah klaim — itulah yang relevan bagi kedua pihak saat menunggu.
 *   - `openedBy` ditulis dari sudut pandang user ("Anda" / nama lawan) —
 *     konsisten dengan OrderCard yang menghindari label dua arah.
 */
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge, type BadgeProps, type BadgeTone } from "@/components/ui/badge"
import { Card, type CardProps } from "@/components/ui/card"
import { Dot } from "@/components/ui/dot"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type DisputeStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "AWAITING_RESPONSE"
  | "RESOLVED_BUYER"
  | "RESOLVED_SELLER"
  | "RESOLVED_MUTUAL"
  | "WITHDRAWN"
  | "CLOSED"

export type DisputeRole = "buyer" | "seller"

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  OPEN: "Dibuka",
  UNDER_REVIEW: "Ditinjau",
  AWAITING_RESPONSE: "Menunggu tanggapan",
  RESOLVED_BUYER: "Diputus untuk pembeli",
  RESOLVED_SELLER: "Diputus untuk penjual",
  RESOLVED_MUTUAL: "Selesai damai",
  WITHDRAWN: "Ditarik",
  CLOSED: "Ditutup",
}

export function isDisputeStatus(s: string): s is DisputeStatus {
  return s in DISPUTE_STATUS_LABELS
}

export function disputeStatusTone(status: string, role?: DisputeRole): BadgeTone {
  switch (status) {
    case "OPEN":
    case "UNDER_REVIEW":
    case "AWAITING_RESPONSE":
      return "warning"
    case "RESOLVED_MUTUAL":
      return "success"
    case "RESOLVED_BUYER":
      return role === "buyer" ? "success" : "neutral"
    case "RESOLVED_SELLER":
      return role === "seller" ? "success" : "neutral"
    default:
      return "neutral"
  }
}

export function isDisputeActive(status: string): boolean {
  return status === "OPEN" || status === "UNDER_REVIEW" || status === "AWAITING_RESPONSE"
}

// `role` di-Omit: ViewProps RN punya `role?: Role` (a11y) yang disjoint
// dengan DisputeRole — tanpa Omit, intersection tereduksi ke `never`.
export type DisputeStatusBadgeProps = Omit<BadgeProps, "children" | "tone" | "dot" | "role"> & {
  status: DisputeStatus | string
  role?: DisputeRole
  size?: "sm" | "md"
  labels?: Partial<Record<DisputeStatus, string>>
}

export function DisputeStatusBadge({ status, role, size = "sm", labels, variant = "soft", ...rest }: DisputeStatusBadgeProps) {
  const label = isDisputeStatus(status) ? labels?.[status] ?? DISPUTE_STATUS_LABELS[status] : status
  return (
    <Badge tone={disputeStatusTone(status, role)} variant={variant} dot={size === "sm"} accessibilityLabel={`Status sengketa: ${label}`} {...rest}>
      {label}
    </Badge>
  )
}

export type DisputeCardLabels = {
  openedByYou: string
  openedBy: string
  heldAmount: string
  awaitingYou: string
}

const DEFAULT_LABELS: DisputeCardLabels = {
  openedByYou: "Diajukan oleh Anda",
  openedBy: "Diajukan oleh",
  heldAmount: "Dana tertahan",
  awaitingYou: "Tanggapan Anda dibutuhkan",
}

export type DisputeCardProps = Omit<CardProps, "children" | "variant" | "padded" | "role"> & {
  /** ID sengketa yang ditampilkan, mis. "DSP-2026-0903-0007" */
  disputeId: string
  /** Judul order yang disengketakan */
  orderTitle: string
  status: DisputeStatus | string
  /** Peran USER di order — menentukan tone hasil keputusan */
  role: DisputeRole
  counterpart: { name: string; avatar?: AvatarProps["source"]; verified?: boolean }
  /** Apakah user yang membuka sengketa */
  openedByMe: boolean
  /** Dana yang tertahan di escrow */
  heldAmount: number
  /** Sudah diformat pemanggil (§13) */
  updatedAt?: string
  /** Giliran user untuk membalas / menyerahkan bukti */
  awaitingYou?: boolean
  labels?: Partial<DisputeCardLabels>
}

export function DisputeCard({
  disputeId,
  orderTitle,
  status,
  role,
  counterpart,
  openedByMe,
  heldAmount,
  updatedAt,
  awaitingYou = false,
  labels,
  onPress,
  accessibilityLabel,
  className,
  ...rest
}: DisputeCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const showAwaiting = awaitingYou && isDisputeActive(status)

  const a11y =
    accessibilityLabel ??
    [
      showAwaiting ? t.awaitingYou : undefined,
      `Sengketa ${disputeId}`,
      orderTitle,
      openedByMe ? t.openedByYou : `${t.openedBy} ${counterpart.name}`,
      updatedAt,
    ]
      .filter(Boolean)
      .join(", ")

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={a11y}
      accessibilityHint={onPress ? "Buka detail sengketa" : undefined}
      className={cn("gap-3", className)}
      {...rest}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="caption" tone="tertiary" numberOfLines={1} className="flex-1 font-mono-500 tracking-mono">
          {disputeId}
        </Text>
        <DisputeStatusBadge status={status} role={role} size="sm" />
      </View>

      <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
        {orderTitle}
      </Text>

      <View className="flex-row items-center gap-2">
        <Avatar source={counterpart.avatar} name={counterpart.name} size="xs" verified={counterpart.verified} />
        <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
          {openedByMe ? (
            t.openedByYou
          ) : (
            <>
              <Text variant="inherit" tone="tertiary">
                {t.openedBy}{" "}
              </Text>
              {counterpart.name}
            </>
          )}
        </Text>
      </View>

      <View className="flex-row items-end justify-between gap-3">
        <View className="gap-0.5">
          <Text variant="caption" tone="tertiary">
            {t.heldAmount}
          </Text>
          <Amount value={heldAmount} size="body" tone="primary" />
        </View>
        {updatedAt ? (
          <Text variant="caption" tone="tertiary" className="tabular-nums">
            {updatedAt}
          </Text>
        ) : null}
      </View>

      {showAwaiting ? (
        <View className="flex-row items-center gap-2 border-t border-border pt-3">
          <Dot size="md" tone="primary" />
          <Text variant="caption" weight={500} tone="primary">
            {t.awaitingYou}
          </Text>
        </View>
      ) : null}
    </Card>
  )
}

/** Placeholder dengan tinggi menyamai DisputeCard tanpa strip tanggapan */
export function DisputeCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View className={cn("w-full gap-3 rounded-md border border-border bg-surface p-5", className)} accessibilityLabel="Memuat sengketa" {...rest}>
      <View className="flex-row items-center justify-between">
        <Skeleton height={12} className="w-32" />
        <Skeleton height={22} className="w-28" />
      </View>
      <Skeleton height={18} className="w-full" />
      <View className="flex-row items-center gap-2">
        <Skeleton shape="circle" width={24} height={24} />
        <Skeleton height={12} className="w-40" />
      </View>
      <View className="flex-row items-end justify-between">
        <View className="gap-1">
          <Skeleton height={10} className="w-20" />
          <Skeleton height={16} className="w-28" />
        </View>
        <Skeleton height={12} className="w-24" />
      </View>
    </View>
  )
}
