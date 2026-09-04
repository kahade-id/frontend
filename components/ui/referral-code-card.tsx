/**
 * Kahade — <ReferralCodeCard> kartu kode referral pribadi (§9.6 Card, §3.1
 * Mono untuk kode, §9.1 Button, §13 format).
 *
 * Menyatukan `GET /v1/referral/my-code` (kode + tautan undangan) dan
 * `GET /v1/referral/stats` (jumlah undangan & hadiah) dalam satu kartu di
 * halaman Referral. Anatomi:
 *   judul + deskripsi singkat
 *   <CopyableField> kode (Mono, huruf besar)
 *   baris statistik 3 kolom: Diundang · Terkualifikasi · Hadiah
 *   aksi: Bagikan (primary) · Buat kode baru (ghost)
 *
 * Keputusan non-obvious:
 *   - Kode ditampilkan lewat <CopyableField mono> — bukan Mono Large: kode
 *     "KH" + 6-8 alfanumerik (ApplyReferralDto) cukup pendek; yang penting
 *     mudah disalin, bukan dramatis. Salin & bagikan adalah aksi utama.
 *   - Statistik tidak memakai 3 <StatCard>: kartu-dalam-kartu menambah dua
 *     lapis border. Cukup kolom teks dengan angka Mono (tabular) dan label
 *     caption, dipisah garis atas.
 *   - `onRegenerate` bersifat destruktif ringan (kode lama tidak berlaku),
 *     jadi variant `ghost`, bukan destructive — konfirmasi (Modal §10) adalah
 *     urusan pemanggil. Tombol disembunyikan bila handler tidak diberikan.
 *   - Hadiah dirender <Amount> bila angka Rupiah; bila program memberi
 *     hadiah non-uang, pemanggil kirim `rewardLabel` string.
 */
import { ArrowsClockwise, ShareNetwork } from "phosphor-react-native"
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import { Card, type CardProps } from "@/components/ui/card"
import { CopyableField } from "@/components/ui/copyable-field"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"

export type ReferralStats = {
  /** Total user yang mendaftar dengan kode ini */
  totalReferred: number
  /** Yang sudah memenuhi syarat (mis. KYC + transaksi pertama) */
  qualified: number
  /** Total hadiah (Rupiah) yang sudah diterima */
  totalReward: number
}

export type ReferralCodeCardLabels = {
  title: string
  description: string
  codeLabel: string
  referred: string
  qualified: string
  reward: string
  share: string
  regenerate: string
}

const DEFAULT_LABELS: ReferralCodeCardLabels = {
  title: "Undang teman",
  description: "Bagikan kode Anda. Anda dan teman mendapat hadiah saat transaksi pertamanya selesai.",
  codeLabel: "Kode referral",
  referred: "Diundang",
  qualified: "Terkualifikasi",
  reward: "Hadiah",
  share: "Bagikan kode",
  regenerate: "Buat kode baru",
}

export type ReferralCodeCardProps = Omit<CardProps, "children" | "onPress"> & {
  code: string
  /** Tautan undangan lengkap; bila ada, ini yang disalin/dibagikan */
  shareUrl?: string
  stats?: ReferralStats
  /** Teks hadiah kustom bila bukan Rupiah (menimpa stats.totalReward) */
  rewardLabel?: string
  copied?: boolean
  onCopy?: (value: string) => void
  onShare?: () => void
  onRegenerate?: () => void
  regenerating?: boolean
  labels?: Partial<ReferralCodeCardLabels>
}

export function ReferralCodeCard({
  code,
  shareUrl,
  stats,
  rewardLabel,
  copied = false,
  onCopy,
  onShare,
  onRegenerate,
  regenerating = false,
  labels,
  className,
  ...rest
}: ReferralCodeCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  return (
    <Card className={cn("gap-5", className)} {...rest}>
      <View className="gap-1">
        <Text variant="h3" tone="primary">
          {t.title}
        </Text>
        <Text variant="caption" tone="secondary">
          {t.description}
        </Text>
      </View>

      <CopyableField
        label={t.codeLabel}
        value={code.toUpperCase()}
        copyValue={shareUrl ?? code}
        onCopy={onCopy}
        copied={copied}
      />

      {stats ? (
        <View className="flex-row border-t border-border pt-4" accessibilityRole="summary">
          <StatColumn label={t.referred} value={formatNumber(stats.totalReferred)} />
          <StatColumn label={t.qualified} value={formatNumber(stats.qualified)} />
          <StatColumn
            label={t.reward}
            value={rewardLabel ?? <Amount value={stats.totalReward} size="body" tone="primary" />}
            last
          />
        </View>
      ) : null}

      <View className="gap-2">
        {onShare ? (
          <Button variant="primary" leftIcon={ShareNetwork} onPress={onShare}>
            {t.share}
          </Button>
        ) : null}
        {onRegenerate ? (
          <Button variant="ghost" leftIcon={ArrowsClockwise} onPress={onRegenerate} loading={regenerating}>
            {t.regenerate}
          </Button>
        ) : null}
      </View>
    </Card>
  )
}

function StatColumn({ label, value, last = false }: { label: string; value: ReactNode; last?: boolean }) {
  const primitive = typeof value === "string" || typeof value === "number"
  return (
    <View className={cn("flex-1 gap-0.5", !last && "border-r border-border pr-3", last && "pl-3")}>
      {primitive ? (
        <Text variant="monoBody" weight={600} tone="primary" className="tabular-nums">
          {value}
        </Text>
      ) : (
        value
      )}
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

export function ReferralCodeCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      className={cn("w-full gap-5 rounded-md border border-border bg-surface p-5", className)}
      accessibilityLabel="Memuat kode referral"
      {...rest}
    >
      <View className="gap-2">
        <Skeleton height={20} className="w-32" />
        <Skeleton height={12} className="w-full" />
      </View>
      <Skeleton height={48} className="w-full" />
      <View className="flex-row gap-3">
        <Skeleton height={36} className="flex-1" />
        <Skeleton height={36} className="flex-1" />
        <Skeleton height={36} className="flex-1" />
      </View>
      <Skeleton height={44} className="w-full" />
    </View>
  )
}
