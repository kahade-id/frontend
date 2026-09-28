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
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { KeyValue } from "@/components/ui/key-value"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { ThemeModeSelector } from "@/components/ui/theme-toggle-button"
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  decreaseFontScale,
  increaseFontScale,
  resetFontScale,
  useFontScale,
} from "@/lib/font-scale"
import { mapValue } from "@/lib/has-own"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { setDataSaver, useDataSaver } from "@/lib/ui-prefs"

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
  // i18n: label mengikuti bahasa aktif. Batch 19 (item 15): mode hemat data.
  useLanguage()
  const dataSaver = useDataSaver()
  // Item #28 — skala font A-/A+ (0.85–1.3), persisten per perangkat.
  const fontScale = useFontScale()
  const atMin = fontScale <= FONT_SCALE_MIN
  const atMax = fontScale >= FONT_SCALE_MAX

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Tampilan" />
      <View className="gap-4 px-5 pt-3">
        <SectionHeader title="Mode warna" subtitle="Berlaku untuk seluruh aplikasi." />
        <ThemeModeSelector />
        <Text variant="body" tone="secondary">
          {mapValue(PREFERENCE_HINT, preference, PREFERENCE_HINT.system)}
        </Text>

        <KeyValue
          label="Sedang aktif"
          value={
            // A14 (batch 139): saat "Ikuti sistem", tampilkan mode EFEKTIF
            // (terang/gelap) — nilai ini ikut berubah saat sistem berubah.
            preference === "system"
              ? `${mapValue(MODE_LABEL, mode, mode)} (mengikuti sistem)`
              : mapValue(MODE_LABEL, mode, mode)
          }
        />
        {preference === "system" ? (
          <Text variant="caption" tone="secondary" className="text-pretty">
            Mode efektif berubah otomatis mengikuti pengaturan terang/gelap
            perangkat Anda.
          </Text>
        ) : null}

        {/* Batch 19 (item 15): mode hemat data — default MATI, tersimpan lokal. */}
        <SectionHeader
          title={translate("Mode hemat data")}
          subtitle={translate("Gambar dan video di feed tidak dimuat sampai diketuk.")}
        />
        <Switch
          value={dataSaver}
          onChange={setDataSaver}
          label={translate("Hemat data")}
          description={translate(
            "Aktifkan bila kuota terbatas. Berlaku untuk perangkat ini saja.",
          )}
        />

        {/* Item #28 — ukuran font A-/A+: 85%–130%, tersimpan di perangkat. */}
        <SectionHeader
          title={translate("Ukuran teks")}
          subtitle={translate("Perkecil atau perbesar semua teks di aplikasi.")}
        />
        <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
          <Button
            size="sm"
            variant="secondary"
            onPress={() => decreaseFontScale()}
            disabled={atMin}
            accessibilityLabel={translate("Perkecil ukuran teks")}
          >
            A−
          </Button>
          <Text variant="h2" tone="primary" className="tabular-nums">
            {`${Math.round(fontScale * 100)}%`}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => increaseFontScale()}
            disabled={atMax}
            accessibilityLabel={translate("Perbesar ukuran teks")}
          >
            A+
          </Button>
        </View>
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="secondary">
            {translate("Pratinjau: teks contoh mengikuti ukuran yang dipilih.")}
          </Text>
          {fontScale !== 1 ? (
            <Button size="sm" variant="ghost" onPress={() => resetFontScale()}>
              {translate("Atur ulang")}
            </Button>
          ) : null}
        </View>

        {/*
         * FE-IMP-3 #92 — paragraf contoh NYATA yang mengikuti skala font
         * terpilih. <Text> menerapkan skala otomatis (lib/font-scale via
         * components/ui/text.tsx), jadi paragraf ini membesar/mengecil
         * langsung saat A−/A+ diketuk — bukan sekadar angka persen.
         */}
        <View className="rounded-xl border border-border bg-surface p-4">
          <Text variant="body" tone="primary" className="text-pretty">
            Contoh paragraf: dana escrow Rp2.500.000 untuk pesanan #KD-88213
            telah masuk dan menunggu konfirmasi penjual. Begini tampilan teks
            sepanjang ini pada skala {Math.round(fontScale * 100)}% yang Anda
            pilih — ubah dengan tombol A− / A+ di atas untuk melihat
            perbedaannya langsung.
          </Text>
          <Text variant="caption" tone="secondary" className="pt-2">
            {translate("Skala berlaku untuk seluruh teks aplikasi, termasuk judul di bawah ini.")}
          </Text>
          <Text variant="label" tone="primary" className="pt-3">
            Contoh judul label
          </Text>
        </View>
      </View>
    </Screen>
  )
}
