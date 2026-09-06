/**
 * Screen — Tampilan (mode terang / gelap / ikuti sistem).
 *
 * Audit menemukan mode gelap sudah lengkap di seluruh lapisan KECUALI satu:
 *   - `lib/tokens.ts` punya palet `dark` penuh dan `toCssVariables("dark")`.
 *   - `tailwind.config.js` memakai `darkMode: "class"`.
 *   - `<ThemeProvider>` menyimpan preferensi ke SecureStore dan menyuntikkan
 *     CSS variable per mode.
 *   - `<ThemeModeSelector>` (components/ui/theme-toggle-button.tsx) sudah
 *     ditulis lengkap dengan a11y.
 *   - `app.json` sudah punya splash gelap, dan `check:tokens` #9/#13 menjaga
 *     kelengkapan dark mode.
 * Yang hilang: pintu masuknya. Tidak ada satu pun layar yang merender
 * selector itu, jadi preferensi selalu "system" dan seluruh pekerjaan dark
 * mode tidak pernah bisa dipilih pengguna. Layar ini menutup celah tersebut.
 *
 * Tidak ada fetch di sini: preferensi tema adalah state perangkat, bukan
 * profil server — karena itu <Screen scroll>, bukan <DataScreen>.
 */
import { View } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { Header } from "@/components/ui/header"
import { KeyValue } from "@/components/ui/key-value"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { ThemeModeSelector } from "@/components/ui/theme-toggle-button"
import { mapValue } from "@/lib/has-own"

const PREFERENCE_HINT: Record<string, string> = {
  system: "Mengikuti pengaturan terang/gelap perangkat Anda.",
  light: "Selalu terang, apa pun pengaturan perangkat.",
  dark: "Selalu gelap, apa pun pengaturan perangkat.",
}

const MODE_LABEL: Record<string, string> = {
  light: "Terang",
  dark: "Gelap",
}

export default function AppearanceScreen() {
  const { mode, preference } = useTheme()

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Tampilan" />
      <View accessible={false} className="gap-4 px-6 pt-3">
        <SectionHeader title="Mode warna" subtitle="Berlaku untuk seluruh aplikasi." />
        <ThemeModeSelector />
        <Text numberOfLines={1} variant="body" tone="secondary">
          {mapValue(PREFERENCE_HINT, preference, PREFERENCE_HINT.system)}
        </Text>

        <KeyValue label="Sedang aktif" value={mapValue(MODE_LABEL, mode, mode)} />
      </View>
    </Screen>
  )
}
