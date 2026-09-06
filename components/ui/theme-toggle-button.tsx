/**
 * Kahade — <ThemeToggleButton> + <ThemeModeSelector> (§2.4 Mode Tokens,
 * §9.1 Icon button, §9.16 Segmented Control).
 *
 * Dua bentuk kontrol tema yang keduanya membaca/menulis ke <ThemeProvider>:
 *   - <ThemeToggleButton>: icon button Sun/Moon untuk header — toggle cepat
 *     light <-> dark.
 *   - <ThemeModeSelector>: segmented 3 pilihan (Sistem / Terang / Gelap)
 *     untuk halaman Pengaturan > Tampilan — satu-satunya tempat pengguna
 *     bisa KEMBALI ke "system".
 *
 * Keputusan non-obvious:
 *   - Toggle memanggil `toggle()` provider yang mengubah preferensi ke
 *     light/dark eksplisit (keluar dari "system"). Ini disengaja: pengguna
 *     yang menekan ikon bulan ingin gelap SEKARANG, bukan "ikuti OS yang
 *     kebetulan gelap". Jalan kembali ke system ada di <ThemeModeSelector>.
 *   - Ikon menunjukkan mode TUJUAN, bukan mode saat ini: di light tampil
 *     Moon ("ke gelap"), di dark tampil Sun. Konvensi ini yang dipakai
 *     mayoritas app (GitHub, Vercel) dan cocok dengan label a11y
 *     "Aktifkan mode gelap".
 *   - `accessibilityRole="switch"` + `accessibilityState.checked = mode ===
 *     "dark"` supaya screen reader membacanya sebagai saklar dua-posisi,
 *     bukan tombol tanpa state.
 *   - Tidak ada animasi rotasi/morph ikon: §1.6 satu titik kejutan per
 *     layar — perubahan seluruh palet warna sudah cukup jadi feedback.
 *   - Selector memakai <SegmentedControl> dengan ikon Desktop/Sun/Moon dan
 *     nilai `ThemePreference` langsung, sehingga tidak ada pemetaan
 *     string tambahan.
 *   - Persistensi bukan urusan komponen: ThemeProvider sudah punya
 *     `onPreferenceChange` untuk pemanggil menyimpan ke SecureStore.
 */
import { Desktop, Moon, Sun } from "phosphor-react-native"
import type { ViewProps } from "react-native"

import { useTheme, type ThemePreference } from "@/components/theme-provider"
import { IconButton, type IconButtonProps } from "@/components/ui/icon-button"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"

export type ThemeToggleButtonProps = Omit<
  IconButtonProps,
  "icon" | "accessibilityLabel" | "onPress" | "active"
> & {
  labels?: Partial<ThemeToggleLabels>
}

export type ThemeToggleLabels = {
  toDark: string
  toLight: string
}

const defaultToggleLabels: ThemeToggleLabels = {
  toDark: "Aktifkan mode gelap",
  toLight: "Aktifkan mode terang",
}

export function ThemeToggleButton({ labels: labelsProp, ...rest }: ThemeToggleButtonProps) {
  const { mode, toggle } = useTheme()
  const labels = { ...defaultToggleLabels, ...labelsProp }
  const isDark = mode === "dark"

  return (
    <IconButton accessibilityHint="Ketuk untuk berinteraksi"
      icon={isDark ? Sun : Moon}
      accessibilityLabel={isDark ? labels.toLight : labels.toDark}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      onPress={toggle}
      {...rest}
    />
  )
}

export type ThemeModeSelectorProps = Omit<ViewProps, "children"> & {
  labels?: Partial<ThemeModeLabels>
  disabled?: boolean
  className?: string
}

export type ThemeModeLabels = Record<ThemePreference, string>

const defaultModeLabels: ThemeModeLabels = {
  system: "Sistem",
  light: "Terang",
  dark: "Gelap",
}

export function ThemeModeSelector({ labels: labelsProp, disabled, className, ...rest }: ThemeModeSelectorProps) {
  const { preference, setPreference } = useTheme()
  const labels = { ...defaultModeLabels, ...labelsProp }

  const items: readonly SegmentItem<ThemePreference>[] = [
    { value: "system", label: labels.system, icon: Desktop },
    { value: "light", label: labels.light, icon: Sun },
    { value: "dark", label: labels.dark, icon: Moon },
  ]

  return (
    <SegmentedControl
      items={items}
      value={preference}
      onChange={setPreference}
      disabled={disabled}
      className={className}
      {...rest}
    />
  )
}