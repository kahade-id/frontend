/**
 * Kahade — ThemeProvider
 *
 * Satu tempat yang mengatur dark mode:
 * 1. Menyimpan preferensi user: "system" | "light" | "dark".
 * 2. Menyerahkan preferensi itu APA ADANYA ke NativeWind lewat
 *    `setColorScheme(preference)` — termasuk nilai "system".
 * 3. Membaca mode EFEKTIF dari `useColorScheme().colorScheme` NativeWind
 *    (sudah memperhitungkan preferensi manual maupun OS).
 * 4. Menyuntikkan `vars(toCssVariables(mode))` ke root View supaya semua
 *    utility mode-aware (bg-background, text-text-primary, border-border,
 *    bg-primary, dst.) berubah runtime tanpa rebuild.
 *
 * Kenapa TIDAK membaca `useColorScheme` dari react-native (non-obvious):
 *   Di native, `setColorScheme("dark")` NativeWind memanggil
 *   `Appearance.setColorScheme("dark")`. Akibatnya nilai dari react-native
 *   ikut "tercemar" oleh pilihan manual user, dan saat user kembali memilih
 *   "system" kita tidak lagi tahu mode OS yang asli. Dengan menyerahkan
 *   "system" langsung ke NativeWind, ia mereset Appearance ke null (native) /
 *   prefers-color-scheme (web) sehingga kembali mengikuti OS dengan benar.
 *
 * Kenapa dua langkah (setColorScheme + vars)?
 * - `setColorScheme` hanya mengaktifkan varian `dark:`.
 * - Nilai warna kita tidak hardcode di config, tapi lewat CSS variable,
 *   jadi variable-nya harus diganti eksplisit lewat `vars()`.
 *
 * Persistensi preferensi (mis. expo-secure-store / AsyncStorage) sengaja
 * diserahkan ke pemanggil lewat props `initialPreference` + `onPreferenceChange`
 * agar provider ini tidak bergantung pada storage tertentu. Untuk menghindari
 * satu frame light sebelum effect jalan, pemanggil boleh memanggil
 * `colorScheme.set(stored)` (import { colorScheme } from "nativewind") di
 * _layout.tsx sebelum tree ini di-mount.
 *
 * Catatan Portal: `vars()` diwariskan lewat context React. Komponen yang
 * di-render lewat Portal (bottom sheet/modal library) harus punya host di
 * DALAM ThemeProvider, bukan di atasnya, agar CSS variable-nya ikut.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { View } from "react-native"
import { useColorScheme, vars } from "nativewind"

import { toCssVariables, type ColorMode } from "@/lib/tokens"

export type ThemePreference = ColorMode | "system"

type ThemeContextValue = {
  /** Mode efektif yang sedang dirender */
  mode: ColorMode
  /** Preferensi user (bisa "system") */
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  /** Toggle cepat light <-> dark (keluar dari "system") */
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

type Props = {
  children: ReactNode
  initialPreference?: ThemePreference
  onPreferenceChange?: (p: ThemePreference) => void
}

export function ThemeProvider({
  children,
  initialPreference = "system",
  onPreferenceChange,
}: Props) {
  const { colorScheme, setColorScheme } = useColorScheme()
  const [preference, setPreferenceState] =
    useState<ThemePreference>(initialPreference)

  // Serahkan preferensi (termasuk "system") ke NativeWind — ia yang resolve.
  useEffect(() => {
    setColorScheme(preference)
  }, [preference, setColorScheme])

  const mode: ColorMode = colorScheme === "dark" ? "dark" : "light"

  const setPreference = useCallback(
    (p: ThemePreference) => {
      setPreferenceState(p)
      onPreferenceChange?.(p)
    },
    [onPreferenceChange],
  )

  const toggle = useCallback(() => {
    setPreference(mode === "dark" ? "light" : "dark")
  }, [mode, setPreference])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, preference, setPreference, toggle }),
    [mode, preference, setPreference, toggle],
  )

  // vars() mengembalikan style object; NativeWind mempropagasikan
  // CSS variable ke seluruh subtree lewat context.
  const cssVars = useMemo(() => vars(toCssVariables(mode)), [mode])

  return (
    <ThemeContext.Provider value={value}>
      <View style={cssVars} className="flex-1 bg-background">
        {children}
      </View>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme harus dipakai di dalam <ThemeProvider>")
  return ctx
}
