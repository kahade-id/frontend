/**
 * ProductStatsSection — batch 43, item 6.
 *
 * Statistik per produk untuk pemilik: GET /v1/commerce/products/:id/stats.
 * Angka tampil apa adanya dari server (views, clicks, saves, likes, shares,
 * purchases, ordersTotal). Gagal muat = seksi hilang (soft), bukan halaman
 * rusak — statistik adalah pelengkap, bukan isi utama.
 */
import { useEffect, useState } from "react"
import { View } from "react-native"
import {
  CursorClick,
  Eye,
  Heart,
  Package,
  Receipt,
  ShareNetwork,
  BookmarkSimple,
} from "phosphor-react-native"

import { api } from "@/lib/api"
import type { ProductStats } from "@/lib/api/commerce"
import { formatNumber } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

const STATS: { key: keyof ProductStats; label: string; icon: typeof Eye }[] = [
  { key: "views", label: "Dilihat", icon: Eye },
  { key: "clicks", label: "Klik", icon: CursorClick },
  { key: "saves", label: "Disimpan", icon: BookmarkSimple },
  { key: "likes", label: "Disukai", icon: Heart },
  { key: "shares", label: "Dibagikan", icon: ShareNetwork },
  { key: "purchases", label: "Terjual", icon: Package },
  { key: "ordersTotal", label: "Total order", icon: Receipt },
]

export function ProductStatsSection({ showcaseId }: { showcaseId: string }) {
  const [stats, setStats] = useState<ProductStats | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    api.commerce
      .getProductStats(showcaseId, controller.signal)
      .then((res) => {
        if (!cancelled && res) setStats(res)
      })
      .catch(() => {
        /* soft: seksi disembunyikan */
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [showcaseId])

  if (!stats) return null

  return (
    <View className="px-5 pt-4">
      <Text variant="body" weight={600} className="mb-2">
        {translate("Statistik produk")}
      </Text>
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
    </View>
  )
}
