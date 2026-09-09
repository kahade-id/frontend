/**
 * DEV-ONLY — Pratinjau Design System v2 (Fase 0 dari prompt-redesign-kahade-v2.md).
 *
 * STATUS: sementara, HAPUS file ini di Fase 6 sebelum merge final. Route publik
 * /v2-preview supaya bisa dibuka tanpa sesi selama peninjauan.
 *
 * DEVIASI TERCATAT dari prompt (disengaja, bukan kelalaian):
 *   Prompt meminta preview "hanya di app/showcase.tsx" dengan asumsi file itu
 *   adalah style-guide/kanvas komponen. Faktanya app/showcase.tsx adalah layar
 *   FUNGSIONAL "Portofolio saya" (CRUD + upload foto + API). Menimpanya akan
 *   melanggar aturan #1 prompt (zero perubahan logika bisnis). Maka preview
 *   ditaruh di route terpisah ini dan TIDAK ADA satu pun file lain yang diubah.
 *
 * ATURAN KHUSUS FILE INI (supaya `npm run check` tetap lolos):
 *   - Semua nilai v2 adalah KONSTANTA LOKAL bertanda PROPOSED — proposal yang
 *     menunggu keputusan, BUKAN sumber kebenaran kedua. Setelah keputusan warna
 *     keluar, nilai final masuk lib/tokens.ts (Fase 1) dan file ini dihapus.
 *   - Tidak ada fetch/API, tidak ada setError literal, tidak ada route literal.
 *   - Warna proposal via style={{ backgroundColor }} kondisional mode (tanpa
 *     varian dark di className, sesuai aturan check-tokens #9).
 *   - Dimensi via className; satu-satunya angka style adalah konstanta bernama
 *     (check-tokens #11 mengizinkan konstanta, melarang literal).
 *   - Tidak mengimpor komponen baseline S5 (check-screens) agar baseline tidak basi.
 *   - Penyebutan token di teks memakai spasi ("gray 50") bukan strip, supaya
 *     tidak cocok dengan regex kelas literal di check-tokens #9.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, Platform, View, type ViewStyle } from "react-native"
import Svg, { Circle } from "react-native-svg"
import {
  CheckCircle,
  Diamond,
  Info,
  Leaf,
  Moon,
  Play,
  ShieldCheck,
  Sun,
  Wallet,
  Waves,
} from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary } from "@/components/ui/card"
import { Divider } from "@/components/ui/divider"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

// ==================================================================
// PROPOSED — Netral "Kertas" (pengganti abu dingin; dipakai 3 opsi)
// Rasio dihitung dengan rumus yang sama seperti scripts/check-tokens.mjs.
// ==================================================================

type ProposedMode = {
  background: string
  surface: string
  surfaceElevated: string
  borderDefault: string
  borderControl: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
}

const PROPOSED_PAPER: { light: ProposedMode; dark: ProposedMode } = {
  light: {
    background: "#FFFFFF", // tetap — presisi & kontras maksimal
    surface: "#F7F5F1", // warm paper (vs current F8F9FA)
    surfaceElevated: "#FFFFFF", // tetap, dipisah border seperti sekarang
    borderDefault: "#D9D3C5", // 1.49:1 dekoratif — sama persis dengan current
    borderControl: "#6E6759", // 5.60 bg / 5.15 surface (butuh 3.0)
    textPrimary: "#1C1917", // 17.49 bg / 16.06 surface (butuh 4.5)
    textSecondary: "#4A443C", // 9.62 bg / 8.83 surface (butuh 4.5)
    textTertiary: "#6E6759", // 5.60 bg / 5.15 surface (butuh 3.0)
  },
  dark: {
    background: "#141210", // sedikit hangat dari current 121212
    surface: "#1C1A16",
    surfaceElevated: "#2E2A24", // 1.31 vs bg (butuh 1.3; current 1.34)
    borderDefault: "#3A352D", // 1.54 dekoratif
    borderControl: "#7D7668", // 4.15 bg / 3.86 surface (butuh 3.0)
    textPrimary: "#F5F4F0", // 16.98 bg / 15.79 surface
    textSecondary: "#A8A29A", // 7.39 bg / 6.87 surface
    textTertiary: "#A8A29A", // == secondary (pola existing)
  },
}

const PROPOSED_GRAY: { step: string; hex: string }[] = [
  { step: "50", hex: "#FAF8F5" },
  { step: "100", hex: "#F2EFE9" },
  { step: "200", hex: "#E7E2D8" },
  { step: "300", hex: "#D6CFC2" },
  { step: "400", hex: "#B4AB99" },
  { step: "500", hex: "#8A8172" },
  { step: "600", hex: "#6E6759" },
  { step: "700", hex: "#4A443C" },
  { step: "800", hex: "#2E2A26" },
  { step: "900", hex: "#211D19" },
  { step: "950", hex: "#1C1917" },
]

// ==================================================================
// PROPOSED — Tiga opsi aksen + pasangan info masing-masing.
// Tombol solid: label putih (light) / label bg gelap (dark), semua AA.
// ==================================================================

type AccentShades = { fill: string; text: string; soft: string }
export type AccentKey = "pine" | "sea" | "indigo"

type AccentOption = {
  key: AccentKey
  code: string
  name: string
  tagline: string
  rationale: string
  light: AccentShades
  dark: AccentShades
  /** Label tombol solid per mode (putih di light, gelap di dark). */
  onFill: { light: string; dark: string }
  infoName: string
  info: { light: AccentShades; dark: AccentShades }
  contrast: string[]
}

const PROPOSED_ACCENTS: AccentOption[] = [
  {
    key: "pine",
    code: "A",
    name: "Pinus",
    tagline: "Hijau pinus dalam — dana yang aman & tumbuh.",
    rationale:
      "Hijau membaca instan sebagai uang, aman, dan sukses — kosakata yang sudah " +
      "dipahami pengguna escrow tanpa edukasi. Shade pinus yang dalam menjauhi hijau " +
      "neon fintech generik, tetap syariah-friendly, dan punya kontras teks terbaik " +
      "kedua setelah Nila. Risiko paling rendah untuk aksi finansial.",
    light: { fill: "#0C6B4E", text: "#0A5C43", soft: "#E8F3ED" },
    dark: { fill: "#3ECF8E", text: "#3ECF8E", soft: "#10241B" },
    onFill: { light: "#FFFFFF", dark: "#141210" },
    infoName: "Sungai",
    info: {
      light: { fill: "#1D5FB0", text: "#174E92", soft: "#EBF2FA" },
      dark: { fill: "#7FB3E8", text: "#7FB3E8", soft: "#131E2A" },
    },
    contrast: [
      "teks/soft 7.04 · teks/bg 8.00 · fill/surface 5.97 (ikon)",
      "tombol solid + label putih 6.50 (butuh 4.5)",
      "dark: fill/soft 8.15 · tombol + label gelap 9.36",
    ],
  },
  {
    key: "sea",
    code: "B",
    name: "Samudra",
    tagline: "Biru laut dalam — trust universal, narasi maritim.",
    rationale:
      "Biru adalah warna trust paling universal untuk produk keuangan. Shade laut " +
      "dalam menghindari biru cerah SaaS generik dan membawa narasi Indonesia " +
      "maritim: dana yang berlayar aman sampai tujuan. Paling konvensional untuk " +
      "escrow — aman, tapi paling dekat dengan kompetitor bank/fintech.",
    light: { fill: "#0B5A8E", text: "#0A4E7D", soft: "#E9F1F8" },
    dark: { fill: "#5AA9E6", text: "#5AA9E6", soft: "#12202C" },
    onFill: { light: "#FFFFFF", dark: "#141210" },
    infoName: "Laguna",
    info: {
      light: { fill: "#0E7490", text: "#0C6280", soft: "#E9F5F8" },
      dark: { fill: "#4CC3D9", text: "#4CC3D9", soft: "#10242A" },
    },
    contrast: [
      "teks/soft 7.67 · teks/bg 8.75 · fill/surface 6.73 (ikon)",
      "tombol solid + label putih 7.32 (butuh 4.5)",
      "dark: fill/soft 6.50 · tombol + label gelap 7.34",
    ],
  },
  {
    key: "indigo",
    code: "C",
    name: "Nila",
    tagline: "Nila batik — warisan, premium, paling bercerita.",
    rationale:
      "Nila (indigofera) adalah pewarna batik tradisional — tidak dipakai kompetitor " +
      "fintech yang umumnya biru/hijau, sehingga paling eksklusif dan paling " +
      "Indonesia. Kontrasnya tertinggi di antara tiga opsi. Risikonya: ungu kurang " +
      "lazim untuk aksi finansial, butuh konsistensi pemakaian agar tidak terbaca " +
      "dekoratif. Pilihan diferensiasi maksimal.",
    light: { fill: "#2F3A9E", text: "#2A3488", soft: "#ECECF8" },
    dark: { fill: "#9AA3F0", text: "#9AA3F0", soft: "#1A1D33" },
    onFill: { light: "#FFFFFF", dark: "#141210" },
    infoName: "Baja",
    info: {
      light: { fill: "#33608A", text: "#2A4F73", soft: "#EDF2F7" },
      dark: { fill: "#7FA8CC", text: "#7FA8CC", soft: "#141E28" },
    },
    contrast: [
      "teks/soft 9.21 · teks/bg 10.80 · fill/surface 8.69 (ikon)",
      "tombol solid + label putih 9.46 (butuh 4.5)",
      "dark: fill/soft 7.00 · tombol + label gelap 7.89",
    ],
  },
]

// ==================================================================
// PROPOSED — Semantik: fill dipertahankan kecuali info; soft
// dihangatkan agar serasi netral Kertas. Warning/danger sedikit pekat.
// ==================================================================

const PROPOSED_SEMANTIC: { name: string; note: string; light: AccentShades; dark: AccentShades }[] = [
  {
    name: "Success",
    note: "Fill dipertahankan; soft dihangatkan. fill/surface 3.03 — mepet seperti current, tidak memburuk.",
    light: { fill: "#16A34A", text: "#15803D", soft: "#EDF7F0" },
    dark: { fill: "#4ADE80", text: "#4ADE80", soft: "#14251A" },
  },
  {
    name: "Danger",
    note: "Sedikit lebih hidup (D92D20). teks/soft 5.83 · fill/surface 4.44.",
    light: { fill: "#D92D20", text: "#B42318", soft: "#FDEEEC" },
    dark: { fill: "#F87171", text: "#F87171", soft: "#2A1616" },
  },
  {
    name: "Warning",
    note: "Sedikit lebih pekat (DC6803). teks/soft 4.99 · fill/surface 3.20.",
    light: { fill: "#DC6803", text: "#B54708", soft: "#FEF4E8" },
    dark: { fill: "#FBBF24", text: "#FBBF24", soft: "#2A2113" },
  },
]

// ==================================================================
// PROPOSED — Skala elevasi bertingkat (soft, warm-tinted).
// Satu-satunya offset literal di file ini hidup di konstanta modul
// (bukan di style) agar lolos check-tokens #11.
// ==================================================================

type ElevationLevel = "flat" | "low" | "medium" | "high"

const SHADOW_OFFSET: Record<Exclude<ElevationLevel, "flat">, { width: number; height: number }> = {
  low: { width: 0, height: 2 },
  medium: { width: 0, height: 4 },
  high: { width: 0, height: 12 },
}

const ELEVATION_SPEC: Record<
  ElevationLevel,
  { usage: string; opacity: number; radius: number; elevation: number; web: string }
> = {
  flat: { usage: "List row, divider, input resting — struktural, tetap flat + border.", opacity: 0, radius: 0, elevation: 0, web: "none" },
  low: { usage: "Kartu interaktif resting, chip terpilih.", opacity: 0.06, radius: 8, elevation: 2, web: "0 2px 8px rgba(28,25,23,0.06)" },
  medium: { usage: "Toast, FAB, popover/dropdown.", opacity: 0.1, radius: 16, elevation: 4, web: "0 4px 16px rgba(28,25,23,0.10)" },
  high: { usage: "Bottom sheet, modal/dialog.", opacity: 0.16, radius: 32, elevation: 8, web: "0 12px 32px rgba(28,25,23,0.16)" },
}

/** Gaya cross-platform satu titik (usulan untuk helper tokens Fase 1). */
function proposedElevation(level: ElevationLevel, mode: "light" | "dark"): ViewStyle {
  if (level === "flat") return {}
  const spec = ELEVATION_SPEC[level]
  const base: ViewStyle = {
    shadowColor: mode === "light" ? "#1C1917" : "#000000",
    shadowOffset: SHADOW_OFFSET[level],
    shadowOpacity: mode === "light" ? spec.opacity : Math.min(0.5, spec.opacity + 0.28),
    shadowRadius: spec.radius,
    elevation: spec.elevation,
  }
  if (Platform.OS === "web") {
    const web =
      mode === "light"
        ? spec.web
        : spec.web.replace(/rgba\(28,25,23,([\d.]+)\)/, (_, a: string) =>
            `rgba(0,0,0,${Math.min(0.5, Number(a) + 0.28).toFixed(2)})`,
          )
    return { ...base, ...(web === "none" ? null : ({ boxShadow: web }) as unknown as ViewStyle) }
  }
  return base
}

// ==================================================================
// PROPOSED — Motion: kurva enter/exit + spring playful + radius lg.
// ==================================================================

const PROPOSED_EASING = {
  enter: [0.33, 1, 0.68, 1] as const, // easeOutCubic — masuk soft-decelerate
  exit: [0.32, 0, 0.67, 0] as const, // easeInCubic — keluar cepat
  standard: [0.4, 0, 0.2, 1] as const, // tetap untuk transisi rutin
}

const PROPOSED_SPRING_PLAYFUL = { damping: 14, stiffness: 170, mass: 0.9 } as const

type BezierCurve = readonly [number, number, number, number]
/** Easing.bezier tidak menerima spread union tuple — bungkus sekali di sini. */
function bezierEasing(curve: BezierCurve) {
  return Easing.bezier(curve[0], curve[1], curve[2], curve[3])
}
const PROPOSED_RADIUS_LG = 12 // usulan radius kartu besar (kontrol tetap 6/8)
const COUNT_TARGET = 1250000
const RING_R = 26
const RING_CIRC = 2 * Math.PI * RING_R
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// ==================================================================
// Komponen bantu lokal (file ini saja — bukan components/ui).
// ==================================================================

function Swatch({ hex, label, dark }: { hex: string; label: string; dark?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label} ${hex}`} className="w-16 gap-1">
      <View
        className={cn("h-10 w-16 rounded-xs border", dark ? "border-transparent" : "border-border")}
        style={{ backgroundColor: hex }}
      />
      <Text variant="caption" tone="secondary" className="text-center">
        {label}
      </Text>
      <Text variant="caption" tone="tertiary" className="text-center">
        {hex}
      </Text>
    </View>
  )
}

function ContrastLine({ children }: { children: string }) {
  return (
    <Text variant="caption" tone="secondary">
      {children}
    </Text>
  )
}

/** Tombol solid memakai aksen usulan (label AA di kedua mode). */
function AccentButton({
  accent,
  mode,
  label,
  onPress,
}: {
  accent: AccentOption
  mode: "light" | "dark"
  label: string
  onPress?: () => void
}) {
  const shades = accent[mode]
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      containerClassName={cn("w-full rounded-sm", focusRing)}
      className="min-h-12 flex-row items-center justify-center rounded-sm px-5 py-3"
    >
      <View
        className="absolute inset-0 rounded-sm"
        style={{ backgroundColor: shades.fill }}
      />
      <Text variant="body" weight={600} className="text-center" style={{ color: accent.onFill[mode] }}>
        {label}
      </Text>
    </PressableScale>
  )
}

function EasingBar({ value, label, curve }: { value: Animated.Value; label: string; curve: string }) {
  const width = value.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text variant="label">{label}</Text>
        <Text variant="caption" tone="tertiary">
          {curve}
        </Text>
      </View>
      <View className="h-3 w-full overflow-hidden rounded-full bg-surface">
        <Animated.View className="h-3 rounded-full bg-primary" style={{ width }} />
      </View>
    </View>
  )
}

// ==================================================================
// Layar preview
// ==================================================================

export default function DesignV2PreviewScreen() {
  const { mode, toggle } = useTheme()
  const paper = PROPOSED_PAPER[mode]
  const realReduced = useReducedMotion()
  const [simulatedReduced, setSimulatedReduced] = useState(false)
  const reduced = realReduced || simulatedReduced

  const [accentKey, setAccentKey] = useState<AccentKey>("pine")
  const accent = useMemo(() => PROPOSED_ACCENTS.find((a) => a.key === accentKey) ?? PROPOSED_ACCENTS[0]!, [accentKey])
  const shades = accent[mode]

  // ── Demo easing ──
  const bars = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current
  const playEasing = useCallback(() => {
    if (reduced) {
      bars.forEach((v) => v.setValue(1))
      return
    }
    bars.forEach((v) => v.setValue(0))
    const curves = [PROPOSED_EASING.enter, PROPOSED_EASING.exit, PROPOSED_EASING.standard]
    Animated.parallel(
      bars.map((v, i) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 900,
          easing: bezierEasing(curves[i]!),
          useNativeDriver: false,
        }),
      ),
    ).start()
  }, [bars, reduced])

  // ── Demo spring ──
  const springUtil = useRef(new Animated.Value(1)).current
  const springPlay = useRef(new Animated.Value(1)).current
  const playSpring = useCallback(() => {
    if (reduced) {
      springUtil.setValue(1)
      springPlay.setValue(1)
      return
    }
    springUtil.setValue(0.5)
    springPlay.setValue(0.5)
    Animated.parallel([
      Animated.spring(springUtil, { toValue: 1, damping: 20, stiffness: 200, mass: 1, useNativeDriver: true }),
      Animated.spring(springPlay, { toValue: 1, ...PROPOSED_SPRING_PLAYFUL, useNativeDriver: true }),
    ]).start()
  }, [springUtil, springPlay, reduced])

  // ── Demo count-up ──
  const [countLabel, setCountLabel] = useState(formatRupiah(0))
  const playCountUp = useCallback(() => {
    if (reduced) {
      setCountLabel(formatRupiah(COUNT_TARGET))
      return
    }
    const v = new Animated.Value(0)
    const id = v.addListener(({ value }) => setCountLabel(formatRupiah(Math.round(value))))
    Animated.timing(v, {
      toValue: COUNT_TARGET,
      duration: 1200,
      easing: bezierEasing(PROPOSED_EASING.enter),
      useNativeDriver: false,
    }).start(({ finished }) => {
      v.removeListener(id)
      if (finished) setCountLabel(formatRupiah(COUNT_TARGET))
    })
  }, [reduced])

  // ── Demo progress ring ──
  const ring = useRef(new Animated.Value(0)).current
  const playRing = useCallback(() => {
    if (reduced) {
      ring.setValue(1)
      return
    }
    ring.setValue(0)
    Animated.timing(ring, {
      toValue: 1,
      duration: 1200,
      easing: bezierEasing(PROPOSED_EASING.enter),
      useNativeDriver: false,
    }).start()
  }, [ring, reduced])
  const ringOffset = ring.interpolate({ inputRange: [0, 1], outputRange: [RING_CIRC, RING_CIRC * (1 - 0.72)] })

  // ── Demo toast v2 ──
  const [toastOn, setToastOn] = useState(false)
  const toastOpacity = useRef(new Animated.Value(0)).current
  const toastY = useRef(new Animated.Value(0)).current
  const toastScale = useRef(new Animated.Value(1)).current
  const showToastDemo = useCallback(() => {
    setToastOn(true)
    toastOpacity.setValue(0)
    toastY.setValue(reduced ? 0 : tokens.space[2])
    toastScale.setValue(reduced ? 1 : tokens.motion.scale.press)
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: motionDuration(reduced, tokens.motion.duration.fast),
        easing: bezierEasing(PROPOSED_EASING.enter),
        useNativeDriver: true,
      }),
      Animated.spring(toastY, { toValue: 0, ...PROPOSED_SPRING_PLAYFUL, useNativeDriver: true }),
      Animated.spring(toastScale, { toValue: 1, ...PROPOSED_SPRING_PLAYFUL, useNativeDriver: true }),
    ]).start()
  }, [toastOpacity, toastY, toastScale, reduced])
  useEffect(() => {
    if (!toastOn) return
    const id = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: motionDuration(reduced, tokens.motion.duration.press),
        easing: bezierEasing(PROPOSED_EASING.exit),
        useNativeDriver: true,
      }).start(() => setToastOn(false))
    }, 2600)
    return () => clearTimeout(id)
  }, [toastOn, toastOpacity, reduced])

  // ── Demo crossfade skeleton → konten ──
  const [reloading, setReloading] = useState(false)
  const reloadDemo = useCallback(() => {
    setReloading(true)
    const id = setTimeout(() => setReloading(false), 1400)
    return () => clearTimeout(id)
  }, [])

  // ── Demo idle breath ──
  const breath = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) {
      breath.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [breath, reduced])
  const breathOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] })

  return (
    <Screen scroll edges={["top", "bottom"]}>
      <Header title="Pratinjau v2" />
      <View className="gap-8 py-4">
        {/* ── Banner DEV-ONLY ── */}
        <Card variant="inverted">
          <View className="gap-2">
            <Text variant="h3" className="text-primary-foreground">
              Fase 0 · Proposal v2 (DEV-ONLY)
            </Text>
            <Text variant="body" className="text-primary-foreground">
              Halaman ini SEMENTARA untuk memilih arah warna, elevasi, dan motion. Semua nilai di sini
              konstanta lokal — bukan token final. Dihapus di Fase 6.
            </Text>
            <View className="flex-row gap-2 pt-2">
              <Button variant="secondary" size="sm" fullWidth={false} leftIcon={mode === "dark" ? Sun : Moon} onPress={toggle}>
                {mode === "dark" ? "Mode terang" : "Mode gelap"}
              </Button>
            </View>
            <Text variant="caption" className="text-primary-foreground">
              Mode aktif: {mode} · Reduced motion sistem: {realReduced ? "YA" : "tidak"}
            </Text>
          </View>
        </Card>

        {/* ── 0 · Cara membaca ── */}
        <View className="gap-3">
          <SectionHeader title="0 · Cara membaca" subtitle="Keputusan yang diminta di akhir halaman." />
          <Text variant="body" tone="secondary">
            Rekomendasi penulis: Opsi A (Pinus) untuk risiko terendah di aksi finansial, atau Opsi C
            (Nila) untuk diferensiasi maksimal. Netral Kertas, skala elevasi, dan kurva motion di bawah
            sudah dihitung kontrasnya dan siap dipakai apa pun aksen yang dipilih.
          </Text>
          <View className="gap-2">
            <Switch value={simulatedReduced} onChange={setSimulatedReduced} label="Simulasikan reduced motion" description="Memaksa semua demo di halaman ini tampil instan — cara QA manual tanpa mengubah pengaturan OS." />
          </View>
        </View>

        <Divider />

        {/* ── 1 · Netral Kertas ── */}
        <View className="gap-3">
          <SectionHeader title="1 · Netral Kertas" subtitle="Basis hangat pengganti abu dingin. Satu untuk semua opsi." />
          <View className="flex-row flex-wrap gap-3">
            {PROPOSED_GRAY.map((g) => (
              <Swatch key={g.step} hex={g.hex} label={g.step} />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-3">
            <Swatch hex={paper.surface} label="surface" />
            <Swatch hex={paper.borderDefault} label="border" />
            <Swatch hex={paper.borderControl} label="kontrol" />
            <Swatch hex={paper.textPrimary} label="teks-1" />
            <Swatch hex={paper.textSecondary} label="teks-2" />
            <Swatch hex={paper.textTertiary} label="teks-3" />
          </View>
          <View className="gap-1">
            <ContrastLine>teks utama/bg 17.49 · teks kedua/bg 9.62 · kontrol/bg 5.60 (light)</ContrastLine>
            <ContrastLine>teks utama/bg 16.98 · teks kedua/bg 7.39 · kontrol/bg 4.15 (dark)</ContrastLine>
            <ContrastLine>border dekoratif 1.49 (light) / 1.54 (dark) — setara current, dikecualikan WCAG 1.4.11</ContrastLine>
            <ContrastLine>chart mono light 5.60–14.23 · dark 4.52–12.07 (butuh 3.0 per langkah)</ContrastLine>
          </View>
        </View>

        <Divider />

        {/* ── 2 · Opsi aksen ── */}
        <View className="gap-3">
          <SectionHeader title="2 · Tiga opsi aksen" subtitle="Satu yang dipilih akan jadi token accent. Info mengikuti pemenang." />
          {PROPOSED_ACCENTS.map((a) => {
            const s = a[mode]
            const info = a.info[mode]
            return (
              <Card key={a.key}>
                <View className="gap-3">
                  <View className="flex-row items-center gap-2">
                    {a.key === "pine" ? <Leaf size={20} color={s.fill} weight="fill" /> : null}
                    {a.key === "sea" ? <Waves size={20} color={s.fill} weight="fill" /> : null}
                    {a.key === "indigo" ? <Diamond size={20} color={s.fill} weight="fill" /> : null}
                    <Text variant="h3">
                      Opsi {a.code} · {a.name}
                    </Text>
                  </View>
                  <Text variant="body" weight={600} style={{ color: s.text }}>
                    {a.tagline}
                  </Text>
                  <Text variant="body" tone="secondary">
                    {a.rationale}
                  </Text>
                  <View className="flex-row gap-3">
                    <Swatch hex={s.fill} label="fill" />
                    <Swatch hex={s.text} label="teks" />
                    <Swatch hex={s.soft} label="soft" />
                    <Swatch hex={info.fill} label={`info ${a.infoName}`} />
                  </View>
                  {a.contrast.map((c) => (
                    <ContrastLine key={c}>{c}</ContrastLine>
                  ))}
                  <View className="flex-row items-center gap-2 rounded-sm px-3 py-2" style={{ backgroundColor: s.soft }}>
                    <Info size={16} color={s.fill} weight="fill" />
                    <Text variant="caption" weight={500} style={{ color: s.text }}>
                      Contoh badge soft: Dana Rp2.500.000 tertahan aman
                    </Text>
                  </View>
                </View>
              </Card>
            )
          })}

          <Text variant="body" tone="secondary">
            Coba aksen pada contoh kartu escrow — ganti opsi untuk merasakan perbedaannya:
          </Text>
          <SegmentedControl
            items={[
              { value: "pine", label: "A · Pinus" },
              { value: "sea", label: "B · Samudra" },
              { value: "indigo", label: "C · Nila" },
            ]}
            value={accentKey}
            onChange={setAccentKey}
          />
          <Card>
            <View className="gap-3">
              <CardSummary label={`Ringkasan escrow, dana ${formatRupiah(2500000)} tertahan aman`}>
                <View className="gap-2">
                  <View className="flex-row items-center gap-2 rounded-sm px-3 py-2" style={{ backgroundColor: shades.soft }}>
                    <ShieldCheck size={16} color={shades.fill} weight="fill" />
                    <Text variant="caption" weight={500} style={{ color: shades.text }}>
                      Dana tertahan aman
                    </Text>
                  </View>
                  <Text variant="monoLarge" style={{ color: shades.text }}>
                    {formatRupiah(2500000)}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Order KHD-2041 · dilepas otomatis saat pembeli konfirmasi terima.
                  </Text>
                </View>
              </CardSummary>
              <AccentButton accent={accent} mode={mode} label="Konfirmasi terima barang" />
              <PressableScale accessibilityRole="button" accessibilityLabel="Lihat detail escrow" containerClassName="self-start rounded-xs">
                <Text variant="label" style={{ color: shades.text }}>
                  Lihat detail escrow
                </Text>
              </PressableScale>
            </View>
          </Card>
        </View>

        <Divider />

        {/* ── 3 · Semantik ── */}
        <View className="gap-3">
          <SectionHeader title="3 · Semantik lebih hidup" subtitle="Fill dipertahankan, soft dihangatkan. Info keluar dari abu." />
          <View className="gap-2">
            {PROPOSED_SEMANTIC.map((s) => {
              const v = s[mode]
              return (
                <View key={s.name} className="gap-1">
                  <View className="flex-row items-center gap-2">
                    <View className="h-4 w-4 rounded-full" style={{ backgroundColor: v.fill }} />
                    <Text variant="label">{s.name}</Text>
                    <Text variant="caption" tone="tertiary">
                      {v.fill} · {v.text} · {v.soft}
                    </Text>
                  </View>
                  <Text variant="caption" tone="secondary">
                    {s.note}
                  </Text>
                </View>
              )
            })}
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Badge tone="success">Berhasil</Badge>
            <Badge tone="danger">Gagal</Badge>
            <Badge tone="warning">Menunggu</Badge>
            <Badge tone="info">Info (current: abu)</Badge>
          </View>
          <Text variant="caption" tone="secondary">
            Badge di atas memakai token current. Di v2, tone info memakai warna info pemenang
            (Sungai/Laguna/Baja) — contoh badge soft berwarna ada di tiap kartu opsi di atas.
          </Text>
        </View>

        <Divider />

        {/* ── 4 · Elevasi ── */}
        <View className="gap-3">
          <SectionHeader title="4 · Elevasi bertingkat" subtitle="Soft & warm-tinted. Struktural tetap flat." />
          {(Object.keys(ELEVATION_SPEC) as ElevationLevel[]).map((level) => (
            <View
              key={level}
              accessible
              accessibilityLabel={`Elevasi ${level}: ${ELEVATION_SPEC[level].usage}`}
              className="gap-1 rounded-md border border-border bg-surface-elevated p-5"
              style={proposedElevation(level, mode)}
            >
              <Text variant="label">{level}</Text>
              <Text variant="caption" tone="secondary">
                {ELEVATION_SPEC[level].usage}
              </Text>
              <Text variant="caption" tone="tertiary">
                iOS y{SHADOW_OFFSET[level as Exclude<ElevationLevel, "flat">]?.height ?? 0} blur
                {ELEVATION_SPEC[level].radius} · Android elevation {ELEVATION_SPEC[level].elevation} ·
                web {ELEVATION_SPEC[level].web}
              </Text>
            </View>
          ))}
          <Text variant="caption" tone="secondary">
            Android tidak bisa mewarnai shadow (selalu netral) — opacity dijaga kecil agar tidak kotor.
            Di dark mode shadow menghitam + border dipertahankan sebagai pemisah utama.
          </Text>
        </View>

        <Divider />

        {/* ── 5 · Motion ── */}
        <View className="gap-4">
          <SectionHeader title="5 · Motion" subtitle={`Semua demo menghormati reduced motion (${reduced ? "AKTIF — instan" : "nonaktif"}).`} />

          <View className="gap-2">
            <Text variant="h3">Kurva baru: enter vs exit vs standard</Text>
            <EasingBar value={bars[0]!} label="Enter — soft decelerate" curve="cubic 0.33 1 0.68 1" />
            <EasingBar value={bars[1]!} label="Exit — cepat" curve="cubic 0.32 0 0.67 0" />
            <EasingBar value={bars[2]!} label="Standard — rutin (tetap)" curve="cubic 0.4 0 0.2 1" />
            <Button variant="secondary" size="sm" fullWidth={false} leftIcon={Play} onPress={playEasing}>
              Putar perbandingan
            </Button>
          </View>

          <View className="gap-2">
            <Text variant="h3">Spring: utilitarian vs playful</Text>
            <View className="flex-row gap-4">
              <View className="flex-1 items-center gap-2">
                <Animated.View className="h-16 w-16 rounded-md bg-primary" style={{ transform: [{ scale: springUtil }] }} />
                <Text variant="caption" tone="secondary" className="text-center">
                  Sheet (20/200/1)
                </Text>
              </View>
              <View className="flex-1 items-center gap-2">
                <Animated.View className="h-16 w-16 rounded-md bg-primary" style={{ transform: [{ scale: springPlay }] }} />
                <Text variant="caption" tone="secondary" className="text-center">
                  Playful (14/170/0.9)
                </Text>
              </View>
            </View>
            <Button variant="secondary" size="sm" fullWidth={false} leftIcon={Play} onPress={playSpring}>
              Pantulkan keduanya
            </Button>
          </View>

          <View className="gap-2">
            <Text variant="h3">Signature moments</Text>
            <Card>
              <View className="gap-2">
                <Text variant="label">Saldo count-up (bukan lompat)</Text>
                <Text variant="monoLarge">{countLabel}</Text>
                <Button variant="secondary" size="sm" fullWidth={false} leftIcon={Play} onPress={playCountUp}>
                  Putar count-up
                </Button>
              </View>
            </Card>
            <Card>
              <View className="gap-2">
                <Text variant="label">Progress ring mengisi (skor trust/KYC)</Text>
                <View className="flex-row items-center gap-4">
                  <Svg width={72} height={72}>
                    <Circle cx={36} cy={36} r={RING_R} stroke={paper.borderDefault} strokeWidth={6} fill="none" />
                    <AnimatedCircle
                      cx={36}
                      cy={36}
                      r={RING_R}
                      stroke={shades.fill}
                      strokeWidth={6}
                      fill="none"
                      strokeLinecap="butt"
                      strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
                      strokeDashoffset={ringOffset}
                      transform={`rotate(-90 36 36)`}
                    />
                  </Svg>
                  <Text variant="body" tone="secondary">
                    Terisi ke 72% dengan kurva enter. Warna mengikuti aksen terpilih.
                  </Text>
                </View>
                <Button variant="secondary" size="sm" fullWidth={false} leftIcon={Play} onPress={playRing}>
                  Putar pengisian
                </Button>
              </View>
            </Card>
            <Card>
              <View className="gap-2">
                <Text variant="label">Toast v2: spring masuk, fade cepat keluar</Text>
                <Button variant="secondary" size="sm" fullWidth={false} leftIcon={Play} onPress={showToastDemo}>
                  Tampilkan toast
                </Button>
                {toastOn ? (
                  <Animated.View
                    accessibilityRole="alert"
                    className="w-full flex-row items-start gap-3 rounded-md border border-border bg-surface-elevated px-4 py-3"
                    style={[
                      proposedElevation("medium", mode),
                      { opacity: toastOpacity, transform: [{ translateY: toastY }, { scale: toastScale }] },
                    ]}
                  >
                    <CheckCircle size={20} color={shades.fill} weight="fill" />
                    <View className="flex-1 gap-0.5">
                      <Text variant="body" weight={600}>
                        Dana Rp2.500.000 dilepas
                      </Text>
                      <Text variant="caption" tone="secondary">
                        Masuk ke dompet penjual dalam beberapa detik.
                      </Text>
                    </View>
                  </Animated.View>
                ) : null}
              </View>
            </Card>
            <Card>
              <View className="gap-2">
                <Text variant="label">Skeleton ke konten: crossfade</Text>
                <Button variant="secondary" size="sm" fullWidth={false} leftIcon={Play} onPress={() => reloadDemo()}>
                  Muat ulang demo
                </Button>
                {reloading ? (
                  <SkeletonGroup>
                    <View className="gap-2">
                      <Skeleton height={20} className="w-full" />
                      <Skeleton height={20} className="w-3/5" />
                    </View>
                  </SkeletonGroup>
                ) : (
                  <FadeIn key={countLabel}>
                    <View className="gap-1">
                      <Text variant="body" weight={600}>
                        Riwayat Dompet
                      </Text>
                      <Text variant="caption" tone="secondary">
                        Konten masuk dengan fade + naik 8px (FadeIn existing — tetap dipakai).
                      </Text>
                    </View>
                  </FadeIn>
                )}
              </View>
            </Card>
            <Card>
              <View className="gap-2">
                <Text variant="label">Empty state: napas idle halus</Text>
                <View className="items-center gap-2 py-2">
                  <Animated.View style={{ opacity: breathOpacity, transform: [{ scale: breathScale }] }}>
                    <Wallet size={40} color={shades.fill} weight="duotone" />
                  </Animated.View>
                  <Text variant="caption" tone="secondary">
                    Loop 4.8 detik, opacity 0.55–1 + scale 0.97–1. Statis saat reduced motion.
                  </Text>
                </View>
              </View>
            </Card>
          </View>

          <View className="gap-2">
            <Text variant="h3">Transisi antar layar (usulan)</Text>
            <Text variant="body" tone="secondary">
              Push biasa tetap slide dari kanan. Alur modal (buat transaksi, transfer, top up, tarik dana)
              diusulkan slide dari bawah. Pasangan list ke detail (order, notifikasi, chat, transaksi
              dompet, sengketa) tetap slide kanan + konten detail FadeIn stagger cepat agar terasa
              kontinu — tanpa library shared-element baru.
            </Text>
          </View>
        </View>

        <Divider />

        {/* ── 6 · Radius ── */}
        <View className="gap-3">
          <SectionHeader title="6 · Radius" subtitle="Kontrol tetap. Kartu besar diusulkan 12px." />
          <View className="gap-2">
            <View accessible accessibilityLabel="Radius 8 piksel (current, maksimum non-pill)" className="rounded-md border border-border bg-surface p-5">
              <Text variant="label">8px — current md (tetap untuk tombol, input, kartu biasa)</Text>
            </View>
            <View
              accessible
              accessibilityLabel="Radius 12 piksel (usulan lg untuk kartu besar)"
              className="border border-border bg-surface p-5"
              style={{ borderRadius: PROPOSED_RADIUS_LG }}
            >
              <Text variant="label">12px — usulan lg (kartu besar, hero, sheet di web lebar)</Text>
            </View>
            <View accessible accessibilityLabel="Radius pill (tetap)" className="rounded-full border border-border bg-surface px-5 py-3">
              <Text variant="label">Pill — tetap untuk avatar, chip, dot</Text>
            </View>
          </View>
        </View>

        <Divider />

        {/* ── 7 · Keputusan ── */}
        <View className="gap-3">
          <SectionHeader title="7 · Keputusan yang diminta" subtitle="Fase 0 berhenti di sini." />
          <View className="gap-2">
            <Text variant="body">1. Aksen final: A Pinus, B Samudra, atau C Nila?</Text>
            <Text variant="body">2. Netral Kertas + info berwarna: setuju, atau tetap monokrom?</Text>
            <Text variant="body">3. Skala elevasi low/medium/high: setuju (termasuk shadow di dark)?</Text>
            <Text variant="body">4. Kurva enter/exit + spring playful: setuju?</Text>
            <Text variant="body">5. Radius lg 12px untuk kartu besar: setuju, atau tetap maks 8px?</Text>
            <Text variant="body">6. Transisi modal slide-bawah + detail FadeIn: setuju?</Text>
          </View>
          <Text variant="caption" tone="secondary">
            Setelah 6 keputusan ini keluar, Fase 1 (tokens) + Fase 2 (primitif) + Fase 3 (komponen
            kompleks) + Fase 4 (rollout 5 tab utama dulu) dikerjakan berurutan.
          </Text>
        </View>
      </View>
    </Screen>
  )
}
