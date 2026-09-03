/**
 * Kahade — Helper layout kecil: <Center>, <Bleed>, <AspectRatio>,
 * <VisuallyHidden> (§4, §11).
 *
 * Kumpulan primitif satu-tujuan yang terlalu kecil untuk file sendiri tapi
 * dipakai di banyak tempat. Semua hanya <View className>, tanpa state.
 *
 *   - <Center>        : items-center justify-center (+ flex-1 opsional).
 *                       Dipakai Empty State, Loading Screen, konten splash.
 *   - <Bleed>         : margin negatif −24px kiri-kanan untuk KELUAR dari
 *                       screen padding (§4) — mis. ScrollView horizontal chip
 *                       yang harus menyentuh tepi layar meski parent Screen
 *                       `padded`. Anak yang perlu padding kembali pakai px-6.
 *   - <AspectRatio>   : kotak dengan rasio tetap (16/9, 1, 4/3) untuk preview
 *                       gambar/dokumen. Rasio adalah angka runtime -> style.
 *   - <VisuallyHidden>: konten hanya untuk screen reader (RN tidak punya
 *                       `sr-only`): ukuran 1x1, opacity 0, overflow hidden,
 *                       posisi absolute. Untuk teks status tambahan (mis.
 *                       "Saldo disembunyikan") tanpa memengaruhi layout.
 *
 * Kenapa Bleed pakai `-mx-6` literal dan bukan angka dari layout token
 * (non-obvious): class harus literal agar ter-scan Tailwind; nilai 24px =
 * tokens.layout.screenPaddingX = space[6], jadi tetap satu sumber kebenaran
 * lewat skala spacing yang sama dengan Screen `px-6`.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"

type BaseProps = ViewProps & { children?: ReactNode; className?: string }

/** Tengah horizontal + vertikal. `flex` mengambil sisa ruang parent. */
export function Center({ children, flex = false, className, ...rest }: BaseProps & { flex?: boolean }) {
  return (
    <View className={cn("items-center justify-center", flex && "flex-1", className)} {...rest}>
      {children}
    </View>
  )
}

/** Keluar dari screen padding 24px (§4). Anak: tambahkan `px-6` bila perlu. */
export function Bleed({ children, className, ...rest }: BaseProps) {
  return (
    <View className={cn("-mx-6", className)} {...rest}>
      {children}
    </View>
  )
}

export type AspectRatioProps = BaseProps & {
  /** lebar / tinggi, mis. 16/9 */
  ratio?: number
}

export function AspectRatio({ children, ratio = 16 / 9, className, style, ...rest }: AspectRatioProps) {
  return (
    <View className={cn("w-full overflow-hidden", className)} style={[{ aspectRatio: ratio }, style]} {...rest}>
      {children}
    </View>
  )
}

/** Hanya untuk screen reader — tidak terlihat, tidak memakan ruang layout */
export function VisuallyHidden({ children, className, ...rest }: BaseProps) {
  return (
    <View
      accessible
      className={cn("absolute h-px w-px overflow-hidden opacity-0", className)}
      {...rest}
    >
      {children}
    </View>
  )
}
