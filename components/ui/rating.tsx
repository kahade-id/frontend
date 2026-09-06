/**
 * Kahade — <Rating> (§9.26 Rating / Review).
 *
 * Rating antar-user pasca transaksi escrow selesai. Skala 1–5, baris ikon
 * Star Phosphor + opsional skor angka Mono di samping. TETAP MONOKROM (§9.26):
 * bintang terisi = `primary`, kosong = `border-default` — bukan kuning/emas.
 *
 * Dua mode:
 *   - readOnly (default bila `onChange` tidak ada): tampilan skor rata-rata.
 *     Mendukung setengah bintang (4,5) lewat overlay setengah lebar.
 *   - interaktif (`onChange` ada): tiap bintang = hit area 44x44, tap untuk
 *     memilih, tap ulang bintang yang sama = reset ke 0 (`allowClear`).
 *     Pressed scale 0.97 lewat PressableScale.
 *
 * Keputusan non-obvious:
 *   - Warna ikon di-resolve lewat useTheme() + tokens (bukan className) karena
 *     Phosphor menerima prop `color`, bukan style — sama seperti <Icon>.
 *     `primary` dan `borderDefault` diambil dari palet mode aktif, jadi ikut
 *     invert di dark mode tanpa branch manual.
 *   - Bintang kosong memakai weight "regular" (outline) DAN warna border —
 *     dua sinyal sekaligus supaya perbedaan terisi/kosong tetap terbaca di
 *     dark mode, di mana border-default (#3A3A3A) cukup dekat dengan surface.
 *   - Setengah bintang: bintang kosong di bawah, bintang terisi di atas dalam
 *     wrapper `overflow-hidden` selebar 50%. Nilai runtime lebar -> style
 *     (pengecualian className). Hanya untuk readOnly; input selalu bulat.
 *   - Skor ditulis dengan koma desimal ("4,5") mengikuti lokal ID (§13),
 *     variant monoBody karena angka yang berdiri sendiri (§3.1).
 *   - Interaktif memakai role "adjustable" + actions increment/decrement di
 *     container, bukan 5 tombol terpisah, supaya screen reader membacanya
 *     sebagai satu kontrol "Rating, 3 dari 5".
 */
import { Star } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatDecimal } from "@/lib/format"
import { tokens } from "@/lib/tokens"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type RatingSize = "sm" | "md" | "lg"

export type RatingProps = Omit<ViewProps, "children"> & {
  /** 0–max. readOnly boleh pecahan (4.5); interaktif dibulatkan. */
  value: number
  /** Ada -> mode interaktif */
  onChange?: (value: number) => void
  max?: number
  size?: RatingSize
  /** Tampilkan skor Mono di kanan bintang (readOnly: "4,5"; interaktif: "3/5") */
  showScore?: boolean
  /** Deskripsi per nilai, index 0 = nilai 1 (mis. ["Buruk", …, "Sangat baik"]) */
  labels?: readonly string[]
  /** Tap bintang yang sama = kembali ke 0 (default true) */
  allowClear?: boolean
  disabled?: boolean
  /** Paksa readOnly walau `onChange` ada (mis. saat submit) */
  readOnly?: boolean
  className?: string
}

/** Ukuran ikon dari skala §7; hit area interaktif selalu >= 44 */
const starPx: Record<RatingSize, number> = {
  sm: tokens.icon.size.xs, // 16 — inline di list/kartu
  md: tokens.icon.size.md, // 24 — detail profil
  lg: tokens.icon.size.xl, // 32 — form review
}

const gapClass: Record<RatingSize, string> = {
  sm: "gap-1",
  md: "gap-1",
  lg: "gap-2",
}

function formatScore(value: number): string {
  // §13 lokal ID: koma desimal. Bulat -> tanpa desimal ("5"), pecahan -> 1 digit.
  return formatDecimal(value, 1)
}

export function Rating({
  value,
  onChange,
  max = 5,
  size,
  showScore = false,
  labels,
  allowClear = true,
  disabled = false,
  readOnly: forceReadOnly = false,
  className,
  ...rest
}: RatingProps) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]

  const interactive = !!onChange && !forceReadOnly
  const resolvedSize: RatingSize = size ?? (interactive ? "lg" : "sm")
  const px = starPx[resolvedSize]

  const clamped = Math.min(max, Math.max(0, value))
  const shown = interactive ? Math.round(clamped) : clamped
  const label = shown >= 1 && labels ? labels[Math.ceil(shown) - 1] : undefined

  const select = (n: number) => {
    if (!onChange || disabled) return
    onChange(allowClear && n === shown ? 0 : n)
  }

  const stars = Array.from({ length: max }, (_, i) => {
    const n = i + 1
    const fillRatio = Math.min(1, Math.max(0, shown - i)) // 0, 0.5, 1
    const filled = fillRatio >= 1
    const half = !filled && fillRatio > 0

    const glyph = (
      <View accessible={false} style={{ width: px, height: px }}>
        {/* Lapisan bawah: bintang kosong (outline, warna border) */}
        <Star size={px} color={palette.borderControl} weight="regular" />
        {/* Lapisan atas: bintang terisi, dipotong 50% untuk setengah */}
        {filled || half ? (
          <View
            pointerEvents="none"
            className="absolute left-0 top-0 overflow-hidden"
            style={{ width: filled ? px : px / 2, height: px }}
          >
            <Star size={px} color={palette.primary} weight="fill" />
          </View>
        ) : null}
      </View>
    )

    if (!interactive) return <View key={n}>{glyph}</View>

    return (
      <PressableScale accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
        key={n}
        disabled={disabled}
        onPress={() => select(n)}
        accessibilityRole="button"
        accessibilityLabel={`${n} dari ${max} bintang${labels?.[i] ? `, ${labels[i]}` : ""}`}
        accessibilityState={{ selected: n <= shown, disabled }}
        className="min-h-[44px] min-w-[44px] items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {glyph}
      </PressableScale>
    )
  })

  return (
    <View
      accessibilityRole={interactive ? "adjustable" : undefined}
      accessibilityLabel={interactive ? "Rating" : `Rating ${formatScore(shown)} dari ${max}`}
      accessibilityValue={
        interactive ? { min: 0, max, now: shown, text: `${shown} dari ${max}` } : undefined
      }
      accessibilityActions={
        interactive ? [{ name: "increment" }, { name: "decrement" }] : undefined
      }
      onAccessibilityAction={(e) => {
        if (!onChange || disabled) return
        if (e.nativeEvent.actionName === "increment") onChange(Math.min(max, shown + 1))
        if (e.nativeEvent.actionName === "decrement") onChange(Math.max(0, shown - 1))
      }}
      className={cn("self-start gap-1", disabled && "opacity-disabled", className)}
      {...rest}
    >
      <View className={cn("flex-row items-center", gapClass[resolvedSize])}>
        {/* Interaktif: hit area 44 sudah memberi jarak; gap dinolkan */}
        <View className={cn("flex-row items-center", interactive ? "gap-0" : gapClass[resolvedSize])}>
          {stars}
        </View>
        {showScore ? (
          <Text
            variant={resolvedSize === "lg" ? "monoLarge" : "monoBody"}
            tone={shown > 0 ? "primary" : "secondary"}
            className="ml-2"
          >
            {interactive ? `${shown}/${max}` : formatScore(shown)}
          </Text>
        ) : null}
      </View>

      {label ? (
        <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
          {label}
        </Text>
      ) : null}
    </View>
  )
}