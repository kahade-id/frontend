/**
 * Kahade — <BarChart> + <ChartLegend> (§9.18 Chart/Statistik, §2.3 palet
 * data-viz, §3.1 angka Mono).
 *
 * Chart batang flat berbasis View/flex — tanpa library SVG chart — karena
 * kebutuhan Kahade sederhana (volume transaksi per bulan, breakdown per
 * kategori) dan chart berbasis View otomatis mengikuti token/dark mode lewat
 * className, sesuatu yang library SVG tidak bisa lakukan tanpa hex manual.
 *
 * Aturan warna §2.3 / §9.18 yang dipaksakan lewat tipe `series`:
 *   - `mono`   : 3-step monokrom gray.400 -> 600 -> 800 (tokens.chartMono)
 *                untuk kategori NON-status (jenis barang, metode bayar).
 *                Lebih dari 3 kategori -> batang ke-4 dst. mengulang siklus;
 *                sebaiknya gabungkan ke "Lainnya" sebelum masuk chart.
 *   - `status` : semantic success/danger/warning/info per batang, EKSKLUSIF
 *                untuk status transaksi (selesai/sengketa/menunggu).
 *   - `primary`: satu warna primary untuk deret waktu tunggal (default).
 *
 * Keputusan non-obvious:
 *   - Dark mode untuk step mono: gray 400/600/800 di light dibalik menjadi
 *     700/500/300 di dark lewat `dark:` supaya urutan kontras (terang ->
 *     gelap relatif terhadap background) tetap sama. §2.3 hanya mendefinisikan
 *     palet light — ini interpretasi yang perlu konfirmasi (lihat catatan).
 *   - Tinggi batang = persen dari nilai maksimum, dipasang lewat `style`
 *     (nilai runtime, bukan token). Pertumbuhan dianimasikan dengan
 *     `scaleY` + `transformOrigin: "bottom"` (native driver; RN >= 0.73 dan
 *     web mendukung transformOrigin) — bukan height, agar tidak masuk
 *     pengecualian useNativeDriver=false seperti ProgressBar.
 *   - Radius batang `rounded-xs` (4px) hanya di atas: batang menempel
 *     baseline, tegas & institusional (§5). Tidak ada gradient/shadow (§6).
 *   - Baseline & grid: garis 1px `bg-border` di 0% (baseline) dan opsional
 *     50%/100% (`gridLines`) — sama dengan Divider, bukan warna baru.
 *   - Label nilai (`showValues`) = variant `monoBody` (angka berdiri sendiri
 *     -> Mono §3.1) dengan `formatValue` default Rupiah compact ("Rp1,5 jt")
 *     karena ruang di atas batang sempit; nominal presisi ditampilkan di
 *     StatCard/KeyValue, bukan di chart.
 *   - Orientasi "horizontal" (label kiri, batang, nilai kanan) untuk
 *     breakdown kategori dengan label panjang; "vertical" untuk deret waktu.
 *   - Aksesibilitas: chart adalah gambar; tiap batang `accessible` dengan
 *     label "label: nilai" supaya screen reader bisa membaca datanya satu
 *     per satu, bukan hanya "chart".
 */
import { useEffect, useRef } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"

import { Dot, type DotTone } from "@/components/ui/dot"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type ChartStatusTone = "success" | "danger" | "warning" | "info"
export type ChartSeries = "primary" | "mono" | "status"
export type BarOrientation = "vertical" | "horizontal"

export type BarDatum = {
  label: string
  value: number
  /** Wajib bila series="status"; diabaikan pada series lain */
  tone?: ChartStatusTone
  /** Batang yang disorot (mis. bulan ini) — hanya untuk series "primary" */
  highlighted?: boolean
}

export type BarChartProps = Omit<ViewProps, "children"> & {
  data: readonly BarDatum[]
  series?: ChartSeries
  orientation?: BarOrientation
  /** Tinggi area batang (vertical) dalam px. Default 160. */
  height?: number
  /** Tampilkan nilai Mono di ujung batang */
  showValues?: boolean
  /** Format nilai; default Rupiah compact (§13) */
  formatValue?: (value: number) => string
  /** Garis bantu 50% & 100% (vertical saja) */
  gridLines?: boolean
  /** Animasi tumbuh saat mount / data berubah (default true) */
  animated?: boolean
  accessibilityLabel?: string
  className?: string
}

/**
 * 3-step monokrom (tokens.chartMono = gray.400/600/800). Class literal agar
 * terbaca Tailwind scanner; urutan dibalik di dark mode (lihat header).
 */
const monoStepClass = [
  "bg-gray-400 dark:bg-gray-700",
  "bg-gray-600 dark:bg-gray-500",
  "bg-gray-800 dark:bg-gray-300",
] as const

const statusFillClass: Record<ChartStatusTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
}

const statusDotTone: Record<ChartStatusTone, DotTone> = {
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "info",
}

function fillClassFor(series: ChartSeries, d: BarDatum, index: number): string {
  if (series === "mono") return monoStepClass[index % monoStepClass.length]
  if (series === "status") return statusFillClass[d.tone ?? "info"]
  // primary: batang non-highlight sedikit mundur lewat text-tertiary
  // (abu netral) agar batang highlight (primary) menonjol tanpa warna baru.
  return d.highlighted === false ? "bg-text-tertiary" : "bg-primary"
}

const DEFAULT_HEIGHT = 160
const defaultFormat = (v: number) => formatRupiah(v, { compact: true, sign: "never" })

/**
 * Langkah warna mono hanya ada 3. `step` dikirim pemanggil (bisa dari data),
 * jadi indeks di luar rentang dilipat alih-alih menghasilkan `undefined` yang
 * membuat swatch kehilangan warnanya.
 */
function stepIndex(step: number | undefined): 0 | 1 | 2 {
  if (!Number.isFinite(step)) return 0
  const index = Math.trunc(step as number) % monoStepClass.length
  return (index < 0 ? index + monoStepClass.length : index) as 0 | 1 | 2
}

/** Batang yang tumbuh dari baseline (scaleY) — transform tidak bisa di-className */
function GrowingBar({
  ratio,
  orientation,
  fillClass,
  animated,
}: {
  ratio: number
  orientation: BarOrientation
  fillClass: string
  animated: boolean
}) {
  const grow = useRef(new Animated.Value(animated ? 0 : 1)).current
  // Reduce Motion (audit #2): grow-in batang adalah dekorasi -> tampil langsung.
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (!animated || reducedMotion) {
      grow.setValue(1)
      return
    }
    grow.setValue(0)
    Animated.timing(grow, {
      toValue: 1,
      duration: tokens.motion.duration.slow,
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start()
  }, [animated, grow, ratio, reducedMotion])

  const safeRatio = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
  const pct = `${Math.round(safeRatio * 100)}%` as const
  const vertical = orientation === "vertical"

  return (
    <Animated.View
      style={
        vertical
          ? { height: pct, transformOrigin: "bottom", transform: [{ scaleY: grow }] }
          : { width: pct, transformOrigin: "left", transform: [{ scaleX: grow }] }
      }
      className={cn(vertical ? "w-full rounded-t-xs" : "h-full rounded-r-xs", fillClass)}
    />
  )
}

export function BarChart({
  data,
  series = "primary",
  orientation = "vertical",
  height = DEFAULT_HEIGHT,
  showValues = false,
  formatValue = defaultFormat,
  gridLines = false,
  animated = true,
  accessibilityLabel,
  className,
  ...rest
}: BarChartProps) {
  // Nilai dari backend tidak divalidasi: NaN/Infinity di sini akan mengalir
  // menjadi `height: "NaN%"` — style yang ditolak RN dan mengosongkan chart.
  const max = data.reduce((acc, d) => (Number.isFinite(d.value) ? Math.max(acc, d.value) : acc), 0)
  const ratioOf = (v: number) =>
    max <= 0 || !Number.isFinite(v) ? 0 : Math.min(1, Math.max(0, v / max))
  // Bila ada batang highlight, batang lain otomatis mundur (lihat fillClassFor)
  const anyHighlight = series === "primary" && data.some((d) => d.highlighted)
  const normalized = anyHighlight ? data.map((d) => ({ ...d, highlighted: !!d.highlighted })) : data

  if (orientation === "horizontal") {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        className={cn("w-full gap-3", className)}
        {...rest}
      >
        {normalized.map((d, i) => (
          <View
            key={`${d.label}-${i}`}
            accessible
            accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
            className="flex-row items-center gap-3"
          >
            <Text variant="caption" tone="secondary" numberOfLines={1} className="w-1/4">
              {d.label}
            </Text>
            <View className="h-3 flex-1 flex-row border-l border-border">
              <GrowingBar
                ratio={ratioOf(d.value)}
                orientation="horizontal"
                fillClass={fillClassFor(series, d, i)}
                animated={animated}
              />
            </View>
            {showValues ? (
              <Text variant="monoBody" tone="primary" numberOfLines={1} className="min-w-16 text-right">
                {formatValue(d.value)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    )
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      className={cn("w-full", className)}
      {...rest}
    >
      {/* Area batang */}
      <View className="relative w-full" style={{ height }}>
        {gridLines ? (
          <>
            <View pointerEvents="none" className="absolute inset-x-0 top-0 h-px bg-border" />
            <View pointerEvents="none" className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </>
        ) : null}

        <View className="absolute inset-0 flex-row items-end gap-2">
          {normalized.map((d, i) => (
            <View
              key={`${d.label}-${i}`}
              accessible
              accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
              className="flex-1 items-center justify-end gap-1"
              style={{ height }}
            >
              {showValues ? (
                <Text variant="monoBody" tone="secondary" numberOfLines={1}>
                  {formatValue(d.value)}
                </Text>
              ) : null}
              <View className="w-full flex-1 justify-end">
                <GrowingBar
                  ratio={ratioOf(d.value)}
                  orientation="vertical"
                  fillClass={fillClassFor(series, d, i)}
                  animated={animated}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Baseline */}
      <View className="h-px w-full bg-border" />

      {/* Label sumbu X */}
      <View className="flex-row gap-2 pt-2">
        {normalized.map((d, i) => (
          <Text
            key={`${d.label}-${i}`}
            variant="caption"
            tone={series === "primary" && d.highlighted ? "primary" : "secondary"}
            weight={series === "primary" && d.highlighted ? 600 : 400}
            numberOfLines={1}
            className="flex-1 text-center"
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// Legend
// ------------------------------------------------------------------

export type ChartLegendItem = {
  label: string
  /** Untuk series "status" */
  tone?: ChartStatusTone
  /** Untuk series "mono": indeks step 0..2 */
  step?: 0 | 1 | 2
  /** Nilai sudah diformat (opsional) */
  value?: string
}

export type ChartLegendProps = Omit<ViewProps, "children"> & {
  items: readonly ChartLegendItem[]
  className?: string
}

/**
 * Legenda baris: kotak warna kecil + label caption + nilai Mono opsional.
 * Swatch mono memakai class step yang sama dengan batang agar sinkron.
 */
export function ChartLegend({ items, className, ...rest }: ChartLegendProps) {
  return (
    <View className={cn("flex-row flex-wrap gap-x-4 gap-y-2", className)} {...rest}>
      {items.map((it, i) => (
        <View
          key={`${it.label}-${i}`}
          accessible
          accessibilityLabel={it.value ? `${it.label}: ${it.value}` : it.label}
          className="flex-row items-center gap-2"
        >
          {it.tone ? (
            <Dot size="md" tone={statusDotTone[it.tone]} />
          ) : (
            <View
              className={cn("h-2 w-2 rounded-xs", monoStepClass[stepIndex(it.step)])}
            />
          )}
          <Text variant="caption" tone="secondary">
            {it.label}
          </Text>
          {it.value ? (
            <Text variant="monoBody" tone="primary">
              {it.value}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}
