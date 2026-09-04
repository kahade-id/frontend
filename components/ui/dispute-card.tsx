/**
 * Kahade — <DisputeCard> kartu sengketa di daftar `GET /v1/disputes/my`
 * (§9.6 Card, §3.1 Mono untuk ID & nominal, §13 format, §2.3 status).
 *
 * Anatomi (sejajar dengan OrderCard supaya tab "Sengketa" terasa satu
 * keluarga dengan tab "Transaksi"):
 *   baris 1 : ID sengketa (Mono caption) ..... DisputeStatusBadge
 *   baris 2 : judul order yang disengketakan (body 600, 2 baris)
 *   baris 3 : Avatar xs + nama pihak lawan + peran ("Pembeli"/"Penjual")
 *   baris 4 : nominal yang ditahan escrow ..... waktu dibuka
 *   opsional: strip tenggat tanggapan (Countdown) bila `respondBy` ada &
 *             status masih aktif
 *   opsional: baris meta ikon: N bukti · N pesan · panggilan video aktif
 *
 * Keputusan non-obvious:
 *   - `unreadMessages` ditampilkan sebagai angka kecil (CountBadge neutral)
 *     di meta, BUKAN dot di ID: sengketa hampir selalu punya percakapan,
 *     jadi "ada berapa pesan baru" lebih berguna daripada "ada yang baru".
 *   - Nominal memakai label "Ditahan" secara eksplisit lewat KeyValue mini:
 *     di sengketa, nominal adalah dana yang DIBEKUKAN — bukan harga barang.
 *     Kata itu penting untuk menenangkan kedua pihak (§12 tone institusional).
 *   - `hasActiveCall` menampilkan ikon VideoCamera weight fill + tone active
 *     — panggilan video (endpoint /call/*) adalah momen sinkron yang jarang,
 *     harus terlihat sejak daftar tanpa membuka detail.
 */
import { ChatCircleText, Paperclip, VideoCamera } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Card, type CardProps } from "@/components/ui/card"
import { CountBadge } from "@/components/ui/count-badge"
import { Countdown } from "@/components/ui/countdown"
import {
  DisputeStatusBadge,
  isDisputeActive,
  type DisputeParty,
  type DisputeStatus,
} from "@/components/ui/dispute-status-badge"
import { Icon } from "@/components/ui/icon"
import type { OrderRole } from "@/components/ui/order-status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type DisputeCounterpart = {
  name: string
  avatar?: AvatarProps["source"]
  verified?: boolean
}

export type DisputeCardLabels = {
  seller: string
  buyer: string
  held: string
  respondBy: string
  evidence: string
  messages: string
  activeCall: string
}

const DEFAULT_LABELS: DisputeCardLabels = {
  seller: "Penjual",
  buyer: "Pembeli",
  held: "Ditahan escrow",
  respondBy: "Batas tanggapan",
  evidence: "bukti",
  messages: "pesan",
  activeCall: "Panggilan video aktif",
}

export type DisputeCardProps = Omit<CardProps, "children" | "variant" | "padded" | "role"> & {
  disputeId: string
  /** Judul order yang disengketakan */
  orderTitle: string
  /** Dana yang ditahan escrow */
  heldAmount: number
  status: DisputeStatus | string
  /** Posisi user: pembuka klaim atau pihak yang dilaporkan */
  party: DisputeParty
  /** Peran USER di order asal — menentukan label lawan */
  role: OrderRole
  counterpart: DisputeCounterpart
  /** Sudah diformat (§13), mis. "3 Sep 2026, 14:30" */
  openedAt?: string
  respondBy?: Date | number
  onRespondDeadline?: () => void
  evidenceCount?: number
  messageCount?: number
  unreadMessages?: number
  hasActiveCall?: boolean
  labels?: Partial<DisputeCardLabels>
}

export function DisputeCard({
  disputeId,
  orderTitle,
  heldAmount,
  status,
  party,
  role,
  counterpart,
  openedAt,
  respondBy,
  onRespondDeadline,
  evidenceCount,
  messageCount,
  unreadMessages = 0,
  hasActiveCall = false,
  labels,
  onPress,
  accessibilityLabel,
  className,
  ...rest
}: DisputeCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const counterpartRole = role === "buyer" ? t.seller : t.buyer
  const active = isDisputeActive(status)
  const showDeadline = respondBy != null && active
  const showMeta = evidenceCount != null || messageCount != null || hasActiveCall

  const a11y =
    accessibilityLabel ??
    [
      `Sengketa ${disputeId}`,
      orderTitle,
      `${counterpartRole} ${counterpart.name}`,
      unreadMessages > 0 ? `${unreadMessages} pesan belum dibaca` : undefined,
      hasActiveCall ? t.activeCall : undefined,
      openedAt,
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
        <DisputeStatusBadge status={status} party={party} size="sm" />
      </View>

      <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
        {orderTitle}
      </Text>

      <View className="flex-row items-center gap-2">
        <Avatar source={counterpart.avatar} name={counterpart.name} size="xs" verified={counterpart.verified} />
        <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
          <Text variant="inherit" tone="tertiary">
            {counterpartRole}
            {" · "}
          </Text>
          {counterpart.name}
        </Text>
      </View>

      <View className="flex-row items-end justify-between gap-3">
        <View className="gap-[2px]">
          <Text variant="caption" tone="tertiary">
            {t.held}
          </Text>
          <Amount value={heldAmount} size="body" tone="primary" />
        </View>
        {openedAt ? (
          <Text variant="caption" tone="tertiary" className="tabular-nums">
            {openedAt}
          </Text>
        ) : null}
      </View>

      {showMeta ? (
        <View className="flex-row items-center gap-4">
          {evidenceCount != null ? (
            <View className="flex-row items-center gap-1">
              <Icon icon={Paperclip} size="xs" />
              <Text variant="caption" tone="secondary">
                {`${evidenceCount} ${t.evidence}`}
              </Text>
            </View>
          ) : null}
          {messageCount != null ? (
            <View className="flex-row items-center gap-1">
              <Icon icon={ChatCircleText} size="xs" />
              <Text variant="caption" tone="secondary">
                {`${messageCount} ${t.messages}`}
              </Text>
              {unreadMessages > 0 ? <CountBadge count={unreadMessages} tone="inverted" /> : null}
            </View>
          ) : null}
          {hasActiveCall ? (
            <View className="flex-row items-center gap-1">
              <Icon icon={VideoCamera} size="xs" active accessibilityLabel={t.activeCall} />
              <Text variant="caption" tone="primary" weight={500}>
                {t.activeCall}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showDeadline ? (
        <View className="flex-row items-center justify-between border-t border-border pt-3">
          <Text variant="caption" tone="secondary">
            {t.respondBy}
          </Text>
          <Countdown until={respondBy} tone="primary" onComplete={onRespondDeadline} />
        </View>
      ) : null}
    </Card>
  )
}

export function DisputeCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      className={cn("w-full gap-3 rounded-md border border-border bg-surface p-5", className)}
      accessibilityLabel="Memuat sengketa"
      {...rest}
    >
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
