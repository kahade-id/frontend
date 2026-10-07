/**
 * Kahade — peta mini statis untuk bubble lokasi.
 *
 * BUKAN tile server: gambar SVG deterministik dari (lat, lng) — pola jalan,
 * blok, air, dan taman selalu sama untuk koordinat yang sama, berbeda antar
 * lokasi. Tanpa kunci API, tanpa kuota tile, tanpa WebView, tanpa izin baru.
 *
 * Semua warna dari token (mode-aware): tanah = background, air = info.bgSoft,
 * taman = success.bgSoft, jalan = borderControl (lolos 3:1 di kedua mode),
 * blok = surface, pin = danger.fill + lubang background.
 */
import { memo, useMemo } from "react"
import Svg, { Circle, Path, Rect } from "react-native-svg"

import { semantic } from "@/lib/tokens"
import { useTheme } from "@/components/theme-provider"
import { tokens } from "@/lib/tokens"

const W = 208
const H = 96

/** PRNG deterministik (mulberry32) dari hash koordinat. */
function rngFor(lat: number, lng: number): () => number {
  let h = Math.floor(Math.abs(lat) * 1e5) * 31 + Math.floor(Math.abs(lng) * 1e5) * 7 + 11
  h = h & 0x7fffffff
  return () => {
    h |= 0
    h = (h + 0x6d2b79f5) | 0
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type ChatMiniMapProps = {
  latitude: number
  longitude: number
}

export const ChatMiniMap = memo(function ChatMiniMap({ latitude, longitude }: ChatMiniMapProps) {
  const { mode } = useTheme()
  const p = tokens.colors[mode]
  const info = semantic.info[mode]
  const success = semantic.success[mode]
  const danger = semantic.danger[mode]

  const shapes = useMemo(() => {
    const rand = rngFor(latitude, longitude)
    const verticals = Array.from({ length: 4 }, (_, i) => 28 + i * 46 + rand() * 18)
    const horizontals = Array.from({ length: 3 }, (_, i) => 14 + i * 28 + rand() * 12)
    const blocks = Array.from({ length: 6 }, () => ({
      x: rand() * (W - 46),
      y: rand() * (H - 30),
      w: 22 + rand() * 24,
      h: 12 + rand() * 16,
    }))
    // Sungai: kurva bezier vertikal di sisi deterministik.
    const riverX = rand() > 0.5 ? 30 + rand() * 20 : W - 50 - rand() * 20
    const park = { x: rand() * (W - 60), y: rand() * (H - 42), w: 34 + rand() * 20, h: 22 + rand() * 14 }
    // Jalan utama diagonal — selalu lewat tengah (di bawah pin).
    const mainSlant = 18 + rand() * 24
    return { verticals, horizontals, blocks, riverX, park, mainSlant }
  }, [latitude, longitude])

  const riverPath = `M ${shapes.riverX} 0 C ${shapes.riverX - 14} ${H * 0.3}, ${shapes.riverX + 14} ${H * 0.6}, ${shapes.riverX - 6} ${H} L ${shapes.riverX + 14} ${H} C ${shapes.riverX + 28} ${H * 0.6}, ${shapes.riverX} ${H * 0.3}, ${shapes.riverX + 20} 0 Z`

  return (
    <Svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Rect x={0} y={0} width={W} height={H} fill={p.background} />
      <Path d={riverPath} fill={info.bgSoft} />
      <Rect
        x={shapes.park.x}
        y={shapes.park.y}
        width={shapes.park.w}
        height={shapes.park.h}
        rx={4}
        fill={success.bgSoft}
      />
      {shapes.blocks.map((b, i) => (
        <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill={p.surface} />
      ))}
      {shapes.verticals.map((x, i) => (
        <Rect key={`v${i}`} x={x} y={0} width={4} height={H} fill={p.borderControl} opacity={0.55} />
      ))}
      {shapes.horizontals.map((y, i) => (
        <Rect key={`h${i}`} x={0} y={y} width={W} height={4} fill={p.borderControl} opacity={0.55} />
      ))}
      <Path
        d={`M -10 ${H + 10} L ${W / 2 - shapes.mainSlant} ${H / 2} L ${W + 10} -10`}
        stroke={p.surfaceElevated}
        strokeWidth={9}
        fill="none"
      />
      <Path
        d={`M -10 ${H + 10} L ${W / 2 - shapes.mainSlant} ${H / 2} L ${W + 10} -10`}
        stroke={p.borderControl}
        strokeWidth={1.5}
        fill="none"
        opacity={0.8}
      />
      {/* Pin tengah: lingkaran luar + lubang (selalu di atas jalan). */}
      <Circle cx={W / 2} cy={H / 2} r={11} fill={danger.fill} />
      <Circle cx={W / 2} cy={H / 2} r={4} fill={p.background} />
    </Svg>
  )
})
