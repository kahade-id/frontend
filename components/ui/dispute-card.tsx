/**
 * Kahade — <DisputeCard> (§9.6 Card, §9.7 Badge, §3.1 Mono untuk ID,
 * §2.3 semantic eksklusif status, §13 format).
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
 *   - Status, label, tone, dan `isDisputeActive` TIDAK didefinisikan di sini
 *     — semuanya diimpor dari `dispute-status-badge.tsx`, satu-satunya
 *     sumber kebenaran peta status sengketa. Kartu hanya menurunkan
 *     `party` untuk Badge dari `openedByMe` (pembuka sengketa = claimant).
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
import { Card, type CardProps } from "@/components/ui/card"
import {
  DisputeStatusBadge,
  isDisputeActive,
  type DisputeStatus,
} from "@/components/ui/dispute-status-badge"
import { Dot } from "@/components/ui/dot"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"

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
  counterpart?: { name: string; avatar?: AvatarProps["source"]; verified?: boolean }
  /** Apakah user yang membuka sengketa */
  openedByMe?: boolean
  /** Dana yang tertahan di escrow */
  heldAmount?: number
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
    summarize([
      showAwaiting ? t.awaitingYou : undefined,
      `Sengketa ${disputeId}`,
      orderTitle,
      openedByMe === true
        ? t.openedByYou
        : openedByMe === false && counterpart
          ? `${t.openedBy} ${counterpart?.name ?? "Identitas belum tersedia"}`
          : "Pihak pengaju belum diketahui",
      updatedAt,
    ])

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={a11y}
      accessibilityHint={onPress ? "Buka detail sengketa" : undefined}
      className={cn("gap-3", className)}
      {...rest}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text ellipsizeMode="tail"
          variant="caption"
          tone="secondary"
          numberOfLines={1}
          className="flex-1 font-mono-500 tracking-mono"
        >
          {disputeId}
        </Text>
        <DisputeStatusBadge
          status={status}
          party={openedByMe === true ? "claimant" : openedByMe === false ? "respondent" : undefined}
          size="sm"
        />
      </View>

      <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
        {orderTitle}
      </Text>

      <View className="flex-row items-center gap-2">
        <Avatar
          source={counterpart?.avatar}
          name={counterpart?.name}
          size="xs"
          verified={counterpart?.verified}
        />
        <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
          {openedByMe === true ? (
            t.openedByYou
          ) : openedByMe == null ? (
            "Pihak pengaju belum diketahui"
          ) : (
            <>
              <Text variant="inherit" tone="secondary">
                {t.openedBy}{" "}
              </Text>
              {counterpart?.name ?? "Identitas belum tersedia"}
            </>
          )}
        </Text>
      </View>

      <View className="flex-row items-end justify-between gap-3">
        <View className="gap-0.5">
          <Text variant="caption" tone="secondary">
            {t.heldAmount}
          </Text>
          {heldAmount == null ? (
            <Text variant="monoBody" tone="secondary">
              Belum tersedia
            </Text>
          ) : (
            <Amount value={heldAmount} size="body" tone="primary" />
          )}
        </View>
        {updatedAt ? (
          <Text variant="caption" tone="secondary" className="tabular-nums">
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
export function DisputeCardSkeleton({
  className,
  ...rest
}: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
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