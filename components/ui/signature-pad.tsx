/**
 * Kahade — <SignaturePad> (§9.20 Signature Pad, §6 border, §15 reanimated +
 * gesture-handler, §12 Voice & Tone).
 *
 * Kanvas tanda tangan untuk berita acara serah-terima / persetujuan sengketa.
 * Menghasilkan path SVG (string) yang bisa dikirim ke API atau dirender
 * ulang di struk, plus opsional PNG lewat `viewShot` pemanggil.
 *
 * Keputusan non-obvious:
 *   - Goresan digambar dengan react-native-svg <Path> (sudah dependency
 *     Phosphor/ProgressRing), BUKAN Skia/canvas: tanda tangan rata-rata
 *     < 1000 titik, jauh di bawah batas performa SVG, dan hasilnya langsung
 *     berupa `d` path yang bisa disimpan tanpa konversi.
 *   - Gesture: `Gesture.Pan()` dengan `minDistance(0)` + `shouldCancelWhenOutside(false)`
 *     supaya titik/goresan pendek (titik di atas "i") tetap terekam dan jari
 *     yang keluar area tidak memutus goresan. Titik dikumpulkan di
 *     `useSharedValue<number[]>` di UI thread dan di-flush ke state React
 *     lewat `runOnJS` per event `onChange` — SVG <Path> tidak bisa
 *     dianimasikan lewat worklet tanpa `createAnimatedComponent` + setNativeProps
 *     yang di web tidak jalan; trade-off ini diterima karena frekuensi
 *     `onChange` (~60Hz) masih murah untuk satu setState string.
 *   - Smoothing: segmen dirender sebagai quadratic bezier ke titik tengah
 *     dua sampel berurutan (teknik "midpoint smoothing"), bukan polyline —
 *     menghilangkan sudut kasar tanpa algoritma Catmull-Rom yang lebih berat.
 *   - Berada di dalam ScrollView: pad biasanya di bawah teks perjanjian
 *     panjang. Pan pad `.blocksExternalGesture` tidak dipakai (API tidak
 *     stabil untuk ScrollView RN); sebagai gantinya pemanggil disarankan
 *     `scrollEnabled={!drawing}` lewat `onDrawingChange`. Ini pola yang sama
 *     dengan Slider di dalam form.
 *   - Garis `strokeWidth` 2.5 warna `text-primary` (dari tokens via
 *     useTheme — SVG tidak menerima className). Bukan `primary` hitam
 *     mutlak: di dark mode tanda tangan harus terang di atas surface gelap.
 *   - Kanvas `bg-surface border-border rounded-md` (Card, §5/§6) dengan
 *     garis dasar (baseline) `border-border` putus-putus + tanda "×" kecil
 *     di kiri seperti kertas formulir — memberi anchor ke mana menandatangani
 *     tanpa teks instruksi. Dihilangkan begitu ada goresan.
 *   - Aksi: "Hapus" `ghost` di kanan atas kanvas (bukan di footer form)
 *     supaya dekat dengan objek yang dihapus; tidak ada "Undo" per goresan
 *     karena tanda tangan yang salah biasanya diulang dari awal.
 *   - `onEnd(paths)` dipanggil tiap goresan selesai dengan array path lengkap
 *     — pemanggil bisa enable tombol "Setuju" hanya bila `paths.length > 0`.
 *   - Aksesibilitas: kanvas `accessibilityRole="image"` dengan label +
 *     hint; tanda tangan lewat screen reader tidak realistis, pemanggil
 *     harus menyediakan alternatif (ketik nama + OTP) untuk pengguna
 *     tersebut — `onRequestAlternative` menampilkan link "Tidak bisa
 *     menandatangani?".
 */
import { Eraser } from "phosphor-react-native"
import { useCallback, useMemo, useState } from "react"
import { View, type LayoutChangeEvent, type ViewProps } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { runOnJS, useSharedValue } from "react-native-reanimated"
import Svg, { Line, Path } from "react-native-svg"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type SignaturePadLabels = {
  clear: string
  hint: string
  alternative: string
}

const defaultLabels: SignaturePadLabels = {
  clear: "Hapus",
  hint: "Tanda tangan di dalam kotak",
  alternative: "Tidak bisa menandatangani?",
}

export type SignaturePadProps = Omit<ViewProps, "children"> & {
  /** Path SVG awal (mis. dari draft tersimpan) */
  value?: string[]
  /** Dipanggil tiap goresan selesai dengan semua path */
  onEnd?: (paths: string[]) => void
  /** true saat jari menyentuh kanvas — pemanggil matikan scroll parent */
  onDrawingChange?: (drawing: boolean) => void
  onClear?: () => void
  /** Alternatif non-gesture (ketik nama/OTP) */
  onRequestAlternative?: () => void
  /** Tinggi kanvas px (default 200) */
  height?: number
  strokeWidth?: number
  disabled?: boolean
  error?: string
  labels?: Partial<SignaturePadLabels>
  className?: string
}

type Point = { x: number; y: number }

function buildPath(points: Point[]): string {
  if (points.length === 0) return ""
  if (points.length === 1) {
    const p = points[0]
    // Titik tunggal: lingkaran mini via dua arc — supaya "titik" tetap terlihat
    return `M ${p.x} ${p.y} m -1 0 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const c = points[i]
    const n = points[i + 1]
    const mx = (c.x + n.x) / 2
    const my = (c.y + n.y) / 2
    d += ` Q ${c.x} ${c.y} ${mx} ${my}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

export function SignaturePad({
  value,
  onEnd,
  onDrawingChange,
  onClear,
  onRequestAlternative,
  height = 200,
  strokeWidth = 2.5,
  disabled = false,
  error,
  labels: labelsProp,
  className,
  ...rest
}: SignaturePadProps) {
  const labels = { ...defaultLabels, ...labelsProp }
  const { mode } = useTheme()
  const palette = tokens.colors[mode]

  const [paths, setPaths] = useState<string[]>(value ?? [])
  const [current, setCurrent] = useState<string>("")
  const [size, setSize] = useState({ w: 0, h: height })
  const points = useSharedValue<Point[]>([])

  const isEmpty = paths.length === 0 && current === ""

  const commit = useCallback(
    (pts: Point[]) => {
      const d = buildPath(pts)
      setCurrent("")
      if (!d) return
      setPaths((prev) => {
        const next = [...prev, d]
        onEnd?.(next)
        return next
      })
    },
    [onEnd],
  )

  const update = useCallback((pts: Point[]) => setCurrent(buildPath(pts)), [])
  const drawing = useCallback((d: boolean) => onDrawingChange?.(d), [onDrawingChange])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .minDistance(0)
        .shouldCancelWhenOutside(false)
        .onBegin((e) => {
          points.value = [{ x: e.x, y: e.y }]
          runOnJS(drawing)(true)
        })
        .onChange((e) => {
          points.value = [...points.value, { x: e.x, y: e.y }]
          runOnJS(update)(points.value)
        })
        .onFinalize(() => {
          const pts = points.value
          points.value = []
          runOnJS(commit)(pts)
          runOnJS(drawing)(false)
        }),
    [commit, disabled, drawing, points, update],
  )

  const handleClear = useCallback(() => {
    setPaths([])
    setCurrent("")
    onEnd?.([])
    onClear?.()
  }, [onClear, onEnd])

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout
    setSize({ w: width, h })
  }, [])

  const baselineY = size.h * 0.72
  const baselineInset = tokens.space[6]

  return (
    <View className={cn("w-full gap-2", className)} {...rest}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={labels.hint}
        accessibilityState={{ disabled }}
        onLayout={handleLayout}
        className={cn(
          "relative w-full overflow-hidden rounded-md bg-surface",
          error ? "border-error border-border-error" : "border border-border",
          disabled && "opacity-disabled",
        )}
        style={{ height }}
      >
        <GestureDetector gesture={pan}>
          <View className="flex-1">
            <Svg width="100%" height="100%">
              {/* Baseline kertas formulir — hilang saat sudah ada goresan */}
              {isEmpty && size.w > 0 ? (
                <>
                  <Line
                    x1={baselineInset}
                    y1={baselineY}
                    x2={size.w - baselineInset}
                    y2={baselineY}
                    stroke={palette.borderDefault}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <Path
                    d={`M ${baselineInset} ${baselineY - 14} l 8 -8 m -8 0 l 8 8`}
                    stroke={palette.textTertiary}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </>
              ) : null}

              {paths.map((d, i) => (
                <Path
                  key={i}
                  d={d}
                  stroke={palette.textPrimary}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {current ? (
                <Path
                  d={current}
                  stroke={palette.textPrimary}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
            </Svg>
          </View>
        </GestureDetector>

        {!isEmpty && !disabled ? (
          <View pointerEvents="box-none" className="absolute right-2 top-2">
            <Button variant="ghost" size="sm" fullWidth={false} leftIcon={Eraser} onPress={handleClear}>
              {labels.clear}
            </Button>
          </View>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between gap-4">
        <Text variant="caption" tone={error ? "danger" : "tertiary"} className="flex-1">
          {error ?? labels.hint}
        </Text>
        {onRequestAlternative ? (
          <TextLink variant="caption" onPress={onRequestAlternative}>
            {labels.alternative}
          </TextLink>
        ) : null}
      </View>
    </View>
  )
}
