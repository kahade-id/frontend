/**
 * Kahade — <Header> (§9.15 Header, §9.22 Stepper di header, §6.2 layer 10).
 *
 * Bar atas layar: back (kiri) → judul (tengah) → aksi (kanan). Dipakai
 * sebagai header custom Expo Router (`header: () => <Header … />`) ATAU
 * langsung di dalam route dengan `headerShown: false`.
 *
 * Keputusan non-obvious:
 *   - Tinggi bar 56px (`h-14`) + paddingTop safe-area dari runtime inset
 *     (style, bukan className). Kolom kiri & kanan lebar tetap `w-12`
 *     (= IconButton md) x jumlah aksi supaya judul benar-benar center dan
 *     tidak bergeser saat aksi kanan berubah jumlah — kalau aksi kanan > 1,
 *     kolom kiri tetap 1 slot; judul akan sedikit off-center, itu diterima
 *     daripada memaksa lebar simetris yang membuang ruang judul.
 *   - `border-b border-border` default (pemisah border, bukan shadow §6).
 *     `transparent` mematikan border + bg untuk hero (beranda, onboarding).
 *   - Back memakai ArrowLeft (bukan CaretLeft) di semua platform — satu
 *     bahasa visual; default aksi `router.back()` dari expo-router agar
 *     pemanggil tidak perlu wiring setiap layar.
 *   - `progress` (0–1) merender <StepProgress> tepat di bawah bar — §9.22:
 *     bar tipis di header untuk alur multi-step, tanpa teks "Langkah X/Y".
 *   - Judul H3 (18/600) bukan H1: H1 disediakan untuk judul konten di body;
 *     header adalah kerangka, bukan konten. `largeTitle` opsional merender
 *     H1 di baris kedua untuk layar utama tab (Beranda, Riwayat).
 *   - Di web dibatasi `md:max-w-content` (§11), sejajar kolom konten.
 */
import { useContext, useState, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, X } from "phosphor-react-native"
import { useRouter } from "expo-router"

import { IconButton } from "@/components/ui/icon-button"
import { StepProgress } from "@/components/ui/stepper"
import { Text } from "@/components/ui/text"
import { ScreenInsetsContext } from "@/components/ui/screen"
import { tokens } from "@/lib/tokens"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

/**
 * Tinggi bar Header (px) — harus sama dengan class `h-14` di bawah (skala
 * Tailwind 14 = 56px; tidak ada di `tokens.space`, jadi literal di sini adalah
 * satu-satunya sumber). Dipakai layar form untuk `keyboardVerticalOffset`
 * (KeyboardAvoiding) agar tidak ada angka 56 yang disalin di tiap screen.
 */
export const HEADER_BAR_HEIGHT = 56

export type HeaderProps = Omit<ViewProps, "children"> & {
  title?: string
  /** H1 di baris kedua (layar utama tab) */
  largeTitle?: string
  /** Tampilkan tombol back (default true kalau ada `onBack` atau router bisa back) */
  showBack?: boolean
  /** "back" = ArrowLeft, "close" = X (layar modal/alur yang bisa dibatalkan) */
  backKind?: "back" | "close"
  onBack?: () => void
  /** Node kustom di kiri (mengganti tombol back), mis. <Logo size="sm" /> */
  left?: ReactNode
  /** Aksi kanan — kirim <IconButton variant="ghost"> */
  right?: ReactNode
  /** 0–1: bar progres tipis di bawah header (§9.22) */
  progress?: number
  /** Tanpa border & bg — untuk hero */
  transparent?: boolean
  /** Safe area top ikut dipadding (default true; false bila SafeAreaView di luar) */
  safeArea?: boolean
  className?: string
}

export function Header({
  title,
  largeTitle,
  showBack,
  backKind = "back",
  onBack,
  left,
  right,
  progress,
  transparent = false,
  safeArea,
  className,
  ...rest
}: HeaderProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const providedInsets = useContext(ScreenInsetsContext)
  const [leftWidth, setLeftWidth] = useState(0)
  const [rightWidth, setRightWidth] = useState(0)
  const sideWidth = Math.max(tokens.space[12], leftWidth, rightWidth)

  const canBack = showBack ?? true
  const handleBack =
    onBack ?? (() => (router.canGoBack() ? router.back() : router.replace(ROUTES.home)))

  const leftNode =
    left ??
    (canBack ? (
      <IconButton
        icon={backKind === "close" ? X : ArrowLeft}
        variant="ghost"
        weight={backKind === "close" ? "bold" : undefined}
        accessibilityLabel={backKind === "close" ? "Tutup" : "Kembali"}
        accessibilityHint={backKind === "close" ? "Menutup layar ini" : "Kembali ke layar sebelumnya"}
        onPress={handleBack}
      />
    ) : null)

  return (
    <View accessible={false}
      className={cn(
        "z-sticky w-full items-center",
        transparent ? "bg-transparent" : "bg-background border-b border-border",
        className,
      )}
      style={(safeArea ?? !providedInsets.top) ? { paddingTop: insets.top } : undefined}
      {...rest}
    >
      <View className="w-full md:max-w-content focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        <View className="min-h-14 w-full flex-row items-center px-3 py-1">
          {/* Kolom kiri: lebar tetap 1 slot */}
          <View style={{ width: sideWidth }} className="items-start justify-center">
            <View onLayout={(e) => setLeftWidth(e.nativeEvent.layout.width)}>{leftNode}</View>
          </View>

          <View className="flex-1 items-center justify-center px-2">
            {title ? (
              <Text ellipsizeMode="tail"
                accessibilityRole="header"
                variant="h3"
                numberOfLines={1}
                className="text-center"
              >
                {title}
              </Text>
            ) : null}
          </View>

          {/* Kolom kanan: minimal 1 slot agar judul tetap center saat kosong */}
          <View style={{ width: sideWidth }} className="items-end justify-center">
            <View
              onLayout={(e) => setRightWidth(e.nativeEvent.layout.width)}
              className="flex-row items-center gap-1"
            >
              {right}
            </View>
          </View>
        </View>

        {largeTitle ? (
          <View accessibilityRole="header" className="px-6 pb-4 pt-1">
            <Text variant="h1" accessibilityRole="header">{largeTitle}</Text>
          </View>
        ) : null}
      </View>

      {progress != null ? (
        <View accessible accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(progress*100), min: 0, max: 100 }} accessibilityLabel={`Progres ${Math.round(progress*100)} persen`}>
          <StepProgress value={progress} className="w-full" />
        </View>
      ) : null}
    </View>
  )
}