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
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, X } from "phosphor-react-native"
import { useRouter } from "expo-router"

import { IconButton } from "@/components/ui/icon-button"
import { StepProgress } from "@/components/ui/stepper"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

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
  safeArea = true,
  className,
  ...rest
}: HeaderProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const canBack = showBack ?? (onBack != null || router.canGoBack())
  const handleBack = onBack ?? (() => router.back())

  const leftNode =
    left ??
    (canBack ? (
      <IconButton
        icon={backKind === "close" ? X : ArrowLeft}
        variant="ghost"
        accessibilityLabel={backKind === "close" ? "Tutup" : "Kembali"}
        onPress={handleBack}
      />
    ) : null)

  return (
    <View
      accessibilityRole="header"
      className={cn(
        "z-sticky w-full items-center",
        transparent ? "bg-transparent" : "bg-background border-b border-border",
        className,
      )}
      style={safeArea ? { paddingTop: insets.top } : undefined}
      {...rest}
    >
      <View className="w-full md:max-w-content">
        <View className="h-14 w-full flex-row items-center px-3">
          {/* Kolom kiri: lebar tetap 1 slot */}
          <View className="w-12 items-start justify-center">{leftNode}</View>

          <View className="flex-1 items-center justify-center px-2">
            {title ? (
              <Text variant="h3" numberOfLines={1} className="text-center">
                {title}
              </Text>
            ) : null}
          </View>

          {/* Kolom kanan: minimal 1 slot agar judul tetap center saat kosong */}
          <View className="min-w-12 flex-row items-center justify-end gap-1">{right}</View>
        </View>

        {largeTitle ? (
          <View className="px-6 pb-4 pt-1">
            <Text variant="h1">{largeTitle}</Text>
          </View>
        ) : null}
      </View>

      {progress != null ? <StepProgress value={progress} className="w-full" /> : null}
    </View>
  )
}
