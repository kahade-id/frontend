/**
 * ProductStatsSection — batch 43, item 6; direvisi C16 (batch 139).
 *
 * Statistik per produk untuk pemilik: GET /v1/commerce/products/:id/stats.
 * C16: state eksplisit — loading (skeleton) → error (pesan + coba lagi) /
 * kosong (semua nol) / terisi. Bila gagal setelah pernah berhasil,
 * tampilkan data TERAKHIR dengan penanda + tombol muat ulang (bukan seksi
 * hilang). Footer selalu menunjukkan waktu pembaruan terakhir (waktu
 * perangkat — backend belum mengirim metadata rentang).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import {
  ArrowClockwise,
  BookmarkSimple,
  ChartLineUp,
  CursorClick,
  Eye,
  Heart,
  Package,
  Receipt,
  ShareNetwork,
  WarningCircle,
} from "phosphor-react-native"

import { getProductStats, type ProductStats } from "@/lib/api/commerce"
import { formatDateTime, formatNumber } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"

const STATS: { key: keyof ProductStats; label: string; icon: typeof Eye }[] = [
  { key: "views", label: "Dilihat", icon: Eye },
  { key: "clicks", label: "Klik", icon: CursorClick },
  { key: "saves", label: "Disimpan", icon: BookmarkSimple },
  { key: "likes", label: "Disukai", icon: Heart },
  { key: "shares", label: "Dibagikan", icon: ShareNetwork },
  { key: "purchases", label: "Terjual", icon: Package },
  { key: "ordersTotal", label: "Total pesanan", icon: Receipt },
]

type StatsState =
  | { kind: "loading" }
  | { kind: "error"; lastGood: ProductStats | null; lastUpdatedAt: number | null }
  | { kind: "ready"; stats: ProductStats; lastUpdatedAt: number }

function SkeletonBody() {
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-40 rounded-sm" />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 min-w-[30%] flex-1 rounded-sm" />
        ))}
      </View>
    </View>
  )
}

function StatsGrid({ stats }: { stats: ProductStats }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {STATS.map(({ key, label, icon }) => (
        <Card key={key} variant="outline" className="min-w-[30%] flex-1 items-center gap-1 p-3">
          <Icon icon={icon} size="sm" tone="default" />
          <Text variant="body" weight={700} className="tabular-nums">
            {formatNumber(Number(stats[key] ?? 0))}
          </Text>
          <Text variant="caption" tone="secondary">
            {translate(label)}
          </Text>
        </Card>
      ))}
    </View>
  )
}

export function ProductStatsSection({ showcaseId }: { showcaseId: string }) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const [state, setState] = useState<StatsState>({ kind: "loading" })
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    // Retry dari error memakai data terakhir sebagai latar (bukan skeleton
    // penuh) bila sudah ada; dari awal tetap skeleton.
    setState((prev) => (prev.kind === "ready" || prev.kind === "error" ? prev : { kind: "loading" }))
    const controller = new AbortController()
    try {
      const stats = await getProductStats(showcaseId, controller.signal)
      if (!mounted.current || !stats) throw new Error("empty")
      if (mounted.current) setState({ kind: "ready", stats, lastUpdatedAt: Date.now() })
    } catch {
      if (!mounted.current) return
      setState((prev) => ({
        kind: "error",
        lastGood: prev.kind === "ready" ? prev.stats : prev.kind === "error" ? prev.lastGood : null,
        lastUpdatedAt:
          prev.kind === "ready" ? prev.lastUpdatedAt : prev.kind === "error" ? prev.lastUpdatedAt : null,
      }))
    }
  }, [showcaseId])

  useEffect(() => {
    void load()
  }, [load])

  // TIM 8 (perf, P2): `toLocaleTimeString()` membangun formatter Intl di
  // balik layar — memo per `lastUpdatedAt`, bukan per render.
  // Hook DIPANGGIL SEBELUM early return (rules-of-hooks): dibaca dari state
  // hanya saat state sudah "ready", selain itu null supaya memo stabil.
  const readyUpdatedAt = state.kind === "ready" ? state.lastUpdatedAt : null
  const updatedTime = useMemo(
    () => (readyUpdatedAt ? new Date(readyUpdatedAt).toLocaleTimeString() : ""),
    [readyUpdatedAt],
  )

  if (state.kind === "loading") {
    return (
      <View className="px-5 pt-4" accessibilityLabel={translate("Memuat statistik produk")}>
        <SkeletonBody />
      </View>
    )
  }

  if (state.kind === "error") {
    const { lastGood, lastUpdatedAt } = state
    return (
      <View className="gap-2 px-5 pt-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={WarningCircle} size="md" tone="warning" />
          <Text variant="body" weight={600}>
            {lastGood ? translate("Menampilkan data terakhir") : translate("Statistik tidak dapat dimuat")}
          </Text>
        </View>
        {lastGood ? (
          <>
            <StatsGrid stats={lastGood} />
            {lastUpdatedAt ? (
              <Text variant="caption" tone="tertiary">
                {translate("Data terakhir: {x}", { x: formatDateTime(lastUpdatedAt) })}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="caption" tone="secondary">
            {translate("Periksa koneksi lalu coba lagi.")}
          </Text>
        )}
        <Button
          variant="secondary"
          size="sm"
          onPress={() => void load()}
          leftIcon={ArrowClockwise}
          className="self-start"
        >
          {translate("Coba lagi")}
        </Button>
      </View>
    )
  }

  const { stats } = state
  const isEmpty = STATS.every((s) => Number(stats[s.key] ?? 0) === 0)

  return (
    <View className="gap-2 px-5 pt-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={ChartLineUp} size="md" tone="active" />
        <Text variant="body" weight={600}>
          {translate("Statistik produk")}
        </Text>
      </View>
      {isEmpty ? (
        <Text variant="caption" tone="secondary">
          {translate("Belum ada statistik — bagikan etalase agar mulai terlihat.")}
        </Text>
      ) : (
        <StatsGrid stats={stats} />
      )}
      <Text variant="caption" tone="tertiary">
        {/* FE-084: "(waktu perangkat)" = noise teknis — user tidak peduli zona waktu perangkat. */}
        {translate("Diperbarui {x}", {
          x: updatedTime,
        })}
      </Text>
    </View>
  )
}
