/**
 * Kahade — <RatingDistribution> (item 21).
 *
 * Bar distribusi 1–5★ di halaman ulasan: rata-rata + total di kiri, lima bar
 * horizontal (5★ → 1★) dengan jumlah. Mengetuk bar menyaring daftar ke bintang
 * tersebut (mengintegrasikan dengan filter ulasan yang SUDAH ADA — bukan
 * filter baru; `onSelectStars` disambung ke state filter pemanggil).
 *
 * KONTRAK FINAL TIM A (2026-09-28): distribusi + rata-rata dibaca dari
 * `GET /v1/users/:username/ratings` (`distribution`, `averageRating`).
 * Respons tanpa `distribution` = komponen menyembunyikan diri (fail closed —
 * tidak menampilkan angka perkiraan dari halaman yang dimuat; itu
 * menyesatkan).
 */
import { Star } from "phosphor-react-native"
import { useEffect, useMemo, useState } from "react"
import { View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatDecimal } from "@/lib/format"
import { translate, useLanguage } from "@/lib/i18n"
import { getPublicRatingSummary, type PublicRatingSummary } from "@/lib/api/ratings"

export type RatingDistributionProps = {
  /**
   * Username pemilik ulasan — distribusi diambil dari ringkasan publik
   * miliknya. Wajib: tanpa username komponen tidak bisa fetch dan
   * menyembunyikan diri.
   */
  username: string
  /**
   * Bintang yang sedang difilter pemanggil (null = semua). Bar yang cocok
   * ditandai terpilih; mengetuk bar yang sama menghapus filter.
   */
  selectedStars?: number | null
  onSelectStars?: (stars: number | null) => void
}

export function RatingDistributionBars({ username, selectedStars = null, onSelectStars }: RatingDistributionProps) {
  useLanguage()
  const [summary, setSummary] = useState<PublicRatingSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    if (!username) {
      setSummary(null)
      return
    }
    getPublicRatingSummary(username, controller.signal)
      .then((s) => {
        if (!cancelled) setSummary(s)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [username])

  if (!summary) return null

  const { counts, total } = summary.distribution
  // Rata-rata dari server; fallback = hitung dari distribusi server (bukan
  // dari halaman daftar yang dimuat — itu menyesatkan).
  // TIM 8 (perf): di-memo — sebelumnya reduce tiap render walau jarang berubah.
  const fallbackSum = useMemo(() => counts.reduce((acc, c, i) => acc + c * (i + 1), 0), [counts])
  const average = summary.averageRating ?? (total > 0 ? fallbackSum / total : 0)

  return (
    <View
      className="flex-row items-center gap-4 rounded-md border border-border bg-surface px-4 py-3"
      accessibilityRole="summary"
      accessibilityLabel={translate("Distribusi bintang: rata-rata {x} dari {n} ulasan", {
        x: formatDecimal(average, 1),
        n: String(total),
      })}
    >
      <View className="items-center gap-1">
        <Text variant="h2" tone="primary" className="tabular-nums">
          {formatDecimal(average, 1)}
        </Text>
        <View className="flex-row items-center gap-0.5">
          <Icon icon={Star} size="xs" weight="fill" tone="default" />
          <Text variant="caption" tone="secondary" className="tabular-nums">
            {total}
          </Text>
        </View>
      </View>
      <View className="min-w-0 flex-1 gap-1">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = counts[stars - 1] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          const selected = selectedStars === stars
          return (
            <PressableScale
              key={stars}
              className="flex-row items-center gap-2 py-0.5"
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={translate("{n} ulasan bintang {s}", { n: String(count), s: String(stars) })}
              onPress={() => onSelectStars?.(selected ? null : stars)}
            >
              <Text variant="caption" tone="secondary" className="w-3 tabular-nums">
                {stars}
              </Text>
              <View
                className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-background"
                style={{ position: "relative" }}
              >
                <View
                  className={cn("h-full rounded-full", selected ? "bg-primary" : "bg-border-focus")}
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                />
              </View>
              <Text variant="caption" tone="secondary" className="w-8 text-right tabular-nums">
                {count}
              </Text>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}
