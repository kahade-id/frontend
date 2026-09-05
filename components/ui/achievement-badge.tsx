/**
 * Kahade — <AchievementBadge> + <AchievementBadgeGrid> lencana pencapaian
 * (§9.6 Card, §7 ikon monokrom, §1 satu titik perhatian).
 *
 * Satu lencana dari `GET /v1/badges` (katalog) atau `GET /v1/badges/my`
 * (yang sudah diraih). Anatomi tile: IconBox besar -> nama (label 600) ->
 * deskripsi/kriteria (caption, 2 baris) -> opsional tanggal diraih (Mono).
 *
 * Keputusan non-obvious:
 *   - Lencana yang belum diraih (`earned=false`) TIDAK dihilangkan dari grid:
 *     kriteria yang terlihat adalah motivasi. Rendernya IconBox surface ikon
 *     tone default + teks disabled + ikon Lock kecil di pojok, bukan opacity
 *     40% seluruh tile (kontras teks jatuh di bawah AA).
 *   - Lencana yang diraih memakai IconBox `inverted` (fill primary): ini
 *     "hitam sebagai otoritas" (§1) — satu-satunya elemen tegas di tile.
 *     Tidak ada warna emas/perunggu: sistem monokrom.
 *   - Progress menuju lencana (`progress` 0-100) dirender <ProgressBar
 *     size="sm"> hanya bila belum diraih dan nilai diberikan — untuk lencana
 *     bertahap ("10 transaksi selesai"). Lencana biner cukup tanpa bar.
 *   - Ikon diterima sebagai `IconComponent` Phosphor dari pemanggil (backend
 *     mengirim nama ikon; pemetaan nama->komponen adalah urusan layer data,
 *     bukan komponen UI). `FALLBACK_ICON` Medal untuk nama tak dikenal.
 *   - Grid 2 kolom di mobile via <Grid>/<GridItem span=6>; gap 12px = gap
 *     antar kartu (§4).
 */
import { Lock, Medal } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Card, type CardProps } from "@/components/ui/card"
import { Grid, GridItem } from "@/components/ui/grid"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"

export const FALLBACK_BADGE_ICON: IconComponent = Medal

export type AchievementBadgeItem = {
  id: string
  name: string
  description?: string
  icon?: IconComponent
  earned?: boolean
  /** Sudah diformat pemanggil (§13), mis. "3 Sep 2026" */
  earnedAt?: string
  /** 0–100, hanya relevan bila belum diraih */
  progress?: number
}

export type AchievementBadgeLabels = {
  earnedPrefix: string
  locked: string
}

const DEFAULT_LABELS: AchievementBadgeLabels = {
  earnedPrefix: "Diraih",
  locked: "Belum diraih",
}

export type AchievementBadgeProps = Omit<CardProps, "children" | "variant" | "padded"> &
  Omit<AchievementBadgeItem, "id"> & {
    labels?: Partial<AchievementBadgeLabels>
  }

export function AchievementBadge({
  name,
  description,
  icon,
  earned,
  earnedAt,
  progress,
  labels,
  onPress,
  accessibilityLabel,
  className,
  ...rest
}: AchievementBadgeProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const showProgress = earned === false && progress != null

  const a11y =
    accessibilityLabel ??
    summarize([
      name,
      earned
        ? `${t.earnedPrefix}${earnedAt ? ` ${earnedAt}` : ""}`
        : earned === false
          ? t.locked
          : "Status lencana belum tersedia",
      description,
      showProgress ? `${Math.round(progress)} persen` : undefined,
    ])

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={a11y}
      className={cn("items-center gap-3", className)}
      {...rest}
    >
      <View className="relative">
        <IconBox
          icon={icon ?? FALLBACK_BADGE_ICON}
          size="xl"
          variant={earned ? "inverted" : "surface"}
          shape="circle"
          weight={earned ? "fill" : "regular"}
        />
        {earned === false ? (
          <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-elevated">
            <Icon icon={Lock} size={12} tone="default" weight="bold" />
          </View>
        ) : null}
      </View>

      <View className="items-center gap-0.5">
        <Text
          variant="label"
          tone={earned ? "primary" : "disabled"}
          numberOfLines={1}
          className="text-center"
        >
          {name}
        </Text>
        {description ? (
          <Text
            variant="caption"
            tone={earned ? "secondary" : "disabled"}
            numberOfLines={2}
            className="text-center"
          >
            {description}
          </Text>
        ) : null}
      </View>

      {earned && earnedAt ? (
        <Text
          variant="caption"
          tone="secondary"
          className="font-mono-500 tracking-mono tabular-nums"
        >
          {earnedAt}
        </Text>
      ) : null}

      {showProgress ? <ProgressBar value={progress} size="sm" className="w-full" /> : null}
    </Card>
  )
}

export type AchievementBadgeGridProps = Omit<ViewProps, "children"> & {
  items: AchievementBadgeItem[]
  onPressItem?: (item: AchievementBadgeItem) => void
  labels?: Partial<AchievementBadgeLabels>
  className?: string
}

export function AchievementBadgeGrid({
  items,
  onPressItem,
  labels,
  className,
  ...rest
}: AchievementBadgeGridProps) {
  return (
    <Grid gap={3} className={className} {...rest}>
      {items.map((item) => {
        const { id, ...badge } = item
        return (
          <GridItem key={id} span={6}>
            <AchievementBadge
              {...badge}
              labels={labels}
              onPress={onPressItem ? () => onPressItem(item) : undefined}
              className="h-full"
            />
          </GridItem>
        )
      })}
    </Grid>
  )
}

export function AchievementBadgeSkeleton({
  className,
  ...rest
}: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      className={cn(
        "w-full items-center gap-3 rounded-md border border-border bg-surface p-5",
        className,
      )}
      accessibilityLabel="Memuat lencana"
      {...rest}
    >
      <Skeleton shape="circle" width={56} height={56} />
      <Skeleton height={14} className="w-24" />
      <Skeleton height={10} className="w-32" />
    </View>
  )
}
