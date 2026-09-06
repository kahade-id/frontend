/**
 * Kahade — <TrustScoreCard> skor kepercayaan pengguna (§9.6 Card, §9.18
 * Chart monokrom, §3.1 Mono untuk angka, §9.7 Badge).
 *
 * Menampilkan `GET /v1/users/me/trust-score`: skor 0-100, tingkat (tier),
 * dan faktor-faktor penyusunnya. Dipakai di Profil saya dan (ringkas) di
 * profil publik. Anatomi:
 *   kiri : <ProgressRing> besar dengan skor Mono di tengah
 *   kanan: judul "Skor kepercayaan" + Badge tier + caption penjelasan
 *   bawah: daftar faktor — nama · ProgressBar sm · nilai Mono ("8/10")
 *
 * Keputusan non-obvious:
 *   - Ring & bar SELALU tone primary (monokrom), tidak hijau/kuning/merah
 *     menurut skor: warna semantik eksklusif untuk status transaksi (§2.3).
 *     Skor rendah bukan "bahaya" — ia informasi. Tier-lah yang memberi
 *     konteks lewat Badge (neutral untuk semua tier; pembeda = teks).
 *   - Tier diterima sebagai string dari backend (mis. "BRONZE"/"SILVER"/
 *     "GOLD"/"PLATINUM") dan dipetakan ke label lewat `tierLabels`; tak
 *     dikenal -> tampil apa adanya. Tidak ada ikon/warna logam (§1).
 *   - Faktor (`factors`) opsional: `value`/`max` per faktor. Bar memakai
 *     `value/max*100`. Faktor ditampilkan ringkas (label + bar + angka),
 *     tanpa deskripsi panjang — penjelasan lengkap lewat `onLearnMore`
 *     (Push halaman/BottomSheet milik pemanggil).
 *   - `compact` menyembunyikan daftar faktor — untuk profil publik/kartu
 *     ringkas di dashboard.
 */
import { Info } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Card, CardSummary, type CardProps } from "@/components/ui/card"
import { IconButton } from "@/components/ui/icon-button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { ProgressRing } from "@/components/ui/progress-ring"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { mapValue } from "@/lib/has-own"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type TrustScoreFactor = {
  key: string
  label: string
  value: number
  max: number
}

export type TrustScoreCardLabels = {
  title: string
  description: string
  factorsTitle: string
  learnMore: string
}

const DEFAULT_LABELS: TrustScoreCardLabels = {
  title: "Skor kepercayaan",
  description: "Dihitung dari riwayat transaksi, verifikasi, dan penilaian pengguna lain.",
  factorsTitle: "Faktor penilaian",
  learnMore: "Cara perhitungan skor",
}

export const DEFAULT_TIER_LABELS: Record<string, string> = {
  NEW: "Baru",
  BRONZE: "Perunggu",
  SILVER: "Perak",
  GOLD: "Emas",
  PLATINUM: "Platinum",
}

export type TrustScoreCardProps = Omit<CardProps, "children" | "variant" | "padded"> & {
  /** 0–100 */
  score: number
  tier?: string
  tierLabels?: Record<string, string>
  factors?: TrustScoreFactor[]
  compact?: boolean
  /** Sudah diformat pemanggil (§13), mis. "Diperbarui 3 Sep 2026" */
  updatedAt?: string
  onLearnMore?: () => void
  labels?: Partial<TrustScoreCardLabels>
}

/**
 * `Math.max(0, NaN)` is NaN, so an unvalidated API number would flow straight
 * into <ProgressRing>'s `strokeDashoffset` and <ProgressBar>'s width as NaN —
 * invalid SVG geometry that React Native rejects at render time. Unknown
 * values fall back to `min` instead of propagating.
 */
function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function TrustScoreCard({
  score,
  tier,
  tierLabels,
  factors,
  compact = false,
  updatedAt,
  onLearnMore,
  labels,
  accessibilityLabel,
  className,
  ...rest
}: TrustScoreCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const tiers = { ...DEFAULT_TIER_LABELS, ...tierLabels }
  const value = clamp(Math.round(score), 0, 100)
  const tierLabel = tier ? mapValue(tiers, tier, tier) : undefined
  const showFactors = !compact && factors && factors.length > 0

  // Ringkasan HANYA blok header (skor + tier + deskripsi). Rincian faktor dan
  // `updatedAt` dirender di luar grup dan punya labelnya sendiri, supaya tidak
  // terbaca dua kali.
  const a11y =
    accessibilityLabel ?? summarize([`${t.title} ${value} dari 100`, tierLabel, !compact ? t.description : undefined])

  return (
    // Root TIDAK `accessible`: IconButton "Pelajari" di dalam kartu harus tetap
    // jadi elemen fokus tersendiri. Ringkasan skor + faktor dikelompokkan lewat
    // <CardSummary>, IconButton berada di luar grup itu (audit #4).
    <Card className={cn("gap-5", className)} {...rest}>
      <View className="flex-row items-center gap-4">
        <CardSummary className="flex-1 flex-row items-center gap-4" label={a11y}>
          <ProgressRing value={value} size={compact ? 64 : 80} strokeWidth={compact ? 5 : 6} tone="primary">
            <Text variant={compact ? "monoBody" : "monoLarge"} tone="primary" className="tabular-nums">
              {value}
            </Text>
          </ProgressRing>

          <View className="flex-1 gap-1.5">
            <Text variant="h3" tone="primary" numberOfLines={1}>
              {t.title}
            </Text>
            {tierLabel ? (
              <View className="flex-row">
                <Badge tone="neutral" variant="outline">
                  {tierLabel}
                </Badge>
              </View>
            ) : null}
            {!compact ? (
              <Text variant="caption" tone="secondary">
                {t.description}
              </Text>
            ) : null}
          </View>
        </CardSummary>
        {onLearnMore ? <IconButton icon={Info} variant="ghost" size="sm" accessibilityLabel={t.learnMore} onPress={onLearnMore} /> : null}
      </View>

      {showFactors ? (
        <View className="gap-3 border-t border-border pt-4">
          <Text variant="label" tone="primary">
            {t.factorsTitle}
          </Text>
          {factors.map((f) => {
            const pct = f.max > 0 ? clamp((f.value / f.max) * 100, 0, 100) : 0
            return (
              <View key={f.key} accessible className="gap-1.5" accessibilityLabel={`${f.label} ${f.value} dari ${f.max}`}>
                <View className="flex-row items-center justify-between gap-3">
                  <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
                    {f.label}
                  </Text>
                  <Text variant="caption" tone="primary" className="font-mono-500 tracking-mono tabular-nums">
                    {f.value}/{f.max}
                  </Text>
                </View>
                <ProgressBar value={pct} size="sm" tone="primary" />
              </View>
            )
          })}
        </View>
      ) : null}

      {updatedAt ? (
        <Text variant="caption" tone="secondary" className="tabular-nums">
          {updatedAt}
        </Text>
      ) : null}
    </Card>
  )
}

export function TrustScoreCardSkeleton({ compact = false, className, ...rest }: Omit<ViewProps, "children"> & { compact?: boolean; className?: string }) {
  return (
    <View accessible accessibilityRole="progressbar" className={cn("w-full gap-5 rounded-md border border-border bg-surface p-5", className)} accessibilityLabel="Memuat skor kepercayaan" {...rest}>
      <View className="flex-row items-center gap-4">
        <Skeleton shape="circle" width={compact ? 64 : 80} height={compact ? 64 : 80} />
        <View className="flex-1 gap-2">
          <Skeleton height={20} className="w-36" />
          <Skeleton height={22} className="w-20" />
          {!compact ? <Skeleton height={12} className="w-full" /> : null}
        </View>
      </View>
      {!compact ? (
        <View className="gap-3">
          <Skeleton height={12} className="w-full" />
          <Skeleton height={12} className="w-full" />
          <Skeleton height={12} className="w-full" />
        </View>
      ) : null}
    </View>
  )
}