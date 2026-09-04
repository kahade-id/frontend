/**
 * Kahade — <AnalyticsSummary> (§9.20 StatCard, §9.22 BarChart, §3.1 Mono).
 * API: GET /v1/users/me/analytics, GET /v1/users/me/dashboard
 *
 * Blok ringkasan performa akun (Beranda penjual / tab Statistik): grid
 * StatCard 2 kolom -> BarChart volume per periode -> (opsional) daftar
 * rasio bawah (KeyValueList). Menyusun primitif yang sudah ada; nilainya
 * datang dari dua endpoint yang bentuknya beririsan, jadi komponen menerima
 * `stats` generik alih-alih mengikat ke satu response.
 *
 * Keputusan non-obvious:
 *   - StatCard `mono` default true: semua nilai di sini angka (Rupiah,
 *     hitungan, persen) — §3.1.
 *   - Delta hanya ditampilkan bila pemanggil menyediakan `delta`; komponen
 *     TIDAK menghitung sendiri dari periode sebelumnya karena backend sudah
 *     mengirim `change_pct` — menghindari dua sumber kebenaran.
 *   - Periode dikendalikan pemanggil (SegmentedControl di luar) via
 *     `periodLabel`; komponen ini murni presentasi agar bisa di-cache SWR.
 *   - Chart series "primary" monokrom + bar periode sekarang `highlighted`:
 *     warna semantik disimpan untuk status (§2.3), bukan untuk waktu.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { BarChart, type BarDatum } from "@/components/ui/bar-chart"
import { Card } from "@/components/ui/card"
import { Grid } from "@/components/ui/grid"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { SectionHeader } from "@/components/ui/section"
import { StatCard, type StatDelta } from "@/components/ui/stat-card"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type AnalyticsStat = {
  id: string
  label: string
  /** Sudah diformat pemanggil (Rupiah / angka / persen) */
  value: ReactNode
  hint?: string
  delta?: StatDelta
  icon?: ReactNode
  /** Default true */
  mono?: boolean
}

export type AnalyticsRatio = {
  id: string
  label: string
  /** Sudah diformat, mis. "98,2%" atau "2 jam 15 mnt" */
  value: string
  hint?: string
}

export type AnalyticsSummaryProps = Omit<ViewProps, "children"> & {
  stats: readonly AnalyticsStat[]
  /** Data chart volume per periode; kosong = chart tidak dirender */
  chart?: readonly BarDatum[]
  chartTitle?: string
  /** Mis. "30 hari terakhir" — caption di header chart */
  periodLabel?: string
  formatChartValue?: (v: number) => string
  ratios?: readonly AnalyticsRatio[]
  ratiosTitle?: string
  loading?: boolean
  /** Kolom grid StatCard (default 2) */
  columns?: number
  className?: string
}

export function AnalyticsSummary({
  stats,
  chart,
  chartTitle = "Volume transaksi",
  periodLabel,
  formatChartValue,
  ratios,
  ratiosTitle = "Rasio",
  loading = false,
  columns = 2,
  className,
  ...rest
}: AnalyticsSummaryProps) {
  return (
    <View className={cn("gap-6", className)} {...rest}>
      <Grid columns={columns} gap={3}>
        {stats.map((s) => (
          <StatCard
            key={s.id}
            label={s.label}
            value={s.value}
            hint={s.hint}
            delta={s.delta}
            icon={s.icon}
            mono={s.mono ?? true}
            loading={loading}
          />
        ))}
      </Grid>

      {chart && chart.length > 0 ? (
        <Card className="gap-4">
          <SectionHeader
            title={chartTitle}
            level="h3"
            action={
              periodLabel ? (
                <Text variant="caption" tone="tertiary">
                  {periodLabel}
                </Text>
              ) : undefined
            }
          />
          <BarChart
            data={chart}
            series="primary"
            showValues
            formatValue={formatChartValue}
            accessibilityLabel={`${chartTitle}${periodLabel ? `, ${periodLabel}` : ""}`}
          />
        </Card>
      ) : null}

      {ratios && ratios.length > 0 ? (
        <Card className="gap-4">
          <SectionHeader title={ratiosTitle} level="h3" />
          <KeyValueList>
            {ratios.map((r) => (
              <KeyValue key={r.id} label={r.label} value={r.value} hint={r.hint} mono />
            ))}
          </KeyValueList>
        </Card>
      ) : null}
    </View>
  )
}
