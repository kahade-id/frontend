/**
 * Kahade landing — <LandingStats>: angka statistik dari backend.
 *
 * Angka diambil dari GET /v1/public/stats (publik, tanpa auth) saat mount —
 * HANYA di web. Selama loading tampil skeleton netral (bukan angka 0);
 * bila fetch gagal / endpoint belum ada / angka tak valid, tampil placeholder
 * jujur "—" + caption "Statistik resmi menyusul." Tidak pernah ada angka palsu.
 *
 * KONTRAK BACKEND — endpoint `GET /v1/public/stats` BELUM ADA dan perlu dibuat
 * (publik, tanpa auth, rate-limited). Lihat lib/landing-stats.ts.
 */
import { useEffect, useState } from "react"
import { Platform, View } from "react-native"

import { Text } from "@/components/ui/text"
import { fetchPublicStats, type PublicStats } from "@/lib/landing-stats"

import { Reveal } from "./reveal"
import { Section } from "./section"

const intFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 })
const ratingFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 })

const HONEST_PLACEHOLDER = "—"

type StatSlot = {
  label: string
  /** Konteks manusiawi: angka ini artinya apa bagi pengunjung. */
  context: string
  /** Nilai terformat, atau undefined bila tidak ada angka asli. */
  value?: string
}

function slotsFrom(stats: PublicStats | null): StatSlot[] {
  return [
    {
      label: "Transaksi aman",
      context: "dana pembeli & penjual terlindungi",
      value: stats?.transactionsCount != null ? intFormat.format(stats.transactionsCount) : undefined,
    },
    {
      label: "Pengguna",
      context: "penjual & pembeli terverifikasi",
      value: stats?.usersCount != null ? intFormat.format(stats.usersCount) : undefined,
    },
    {
      label: "Kota terjangkau",
      context: "dari Sabang sampai Merauke",
      value: stats?.citiesCount != null ? intFormat.format(stats.citiesCount) : undefined,
    },
    {
      label: "Rating aplikasi",
      context: "dari ulasan pengguna",
      value: stats?.ratingAvg != null ? ratingFormat.format(stats.ratingAvg) : undefined,
    },
  ]
}

function StatValue({ value }: { value?: string }) {
  return (
    <Text variant="display" tone="inverse" className="text-center">
      {value ?? HONEST_PLACEHOLDER}
    </Text>
  )
}

export function LandingStats() {
  // undefined = loading, null = gagal/tidak ada data, objek = angka asli.
  const [stats, setStats] = useState<PublicStats | null | undefined>(undefined)

  useEffect(() => {
    if (Platform.OS !== "web") {
      // Landing hanya dipakai di web; di native langsung placeholder jujur.
      setStats(null)
      return
    }
    let cancelled = false
    fetchPublicStats().then((result) => {
      if (!cancelled) setStats(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const loading = stats === undefined
  const slots = slotsFrom(stats ?? null)
  const allReal = stats != null && slots.every((s) => s.value !== undefined)

  return (
    <Section id="statistik" eyebrow="Statistik" title="Angka bicara." dark>
      <View className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {slots.map((slot, i) => (
          <Reveal key={slot.label} delay={i * 90}>
            <View className="items-center">
              {loading ? (
                <View className="h-14 w-28 animate-pulse rounded-lg bg-pressed" />
              ) : (
                <StatValue value={slot.value} />
              )}
              <Text variant="label" tone="inverse" className="mt-3 text-center">
                {slot.label}
              </Text>
              <Text variant="caption" tone="inverse" className="mt-1 text-center opacity-70">
                {slot.context}
              </Text>
            </View>
          </Reveal>
        ))}
      </View>
      {!loading && !allReal ? (
        <Reveal delay={360}>
          <Text variant="caption" tone="inverse" className="mt-10 text-center">
            Statistik resmi menyusul.
          </Text>
        </Reveal>
      ) : null}
    </Section>
  )
}
