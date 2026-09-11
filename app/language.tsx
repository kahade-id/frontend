/**
 * Screen — Bahasa Aplikasi (GET/PUT /v1/settings/language).
 *
 * Sejarah cacat yang ditutup di sini (laporan produk 2026-09-11):
 *   Layar ini dulu HANYA menulis preferensi ke backend. UI tidak pernah
 *   berubah, dan baris "Bahasa" di Pengaturan hardcode "Indonesia" — jadi
 *   memilih English terasa mati: "hanya bahasa Indonesia yang tersedia".
 *   Sekarang pilihan user diterapkan ke store i18n secara optimistis dan
 *   disimpan di perangkat, sehingga seluruh teks langsung berpindah bahasa
 *   tanpa restart; backend tetap sumber kebenaran lintas perangkat.
 *
 * Aturan kegagalan (sengaja, bukan kebetulan):
 *   - PUT gagal → bahasa DIKEMBALIKAN ke nilai semula + toast berisi alasan
 *     dari server. Preferensi yang tidak tersimpan di akun tidak boleh tampak
 *     tersimpan.
 *   - GET gagal → <ErrorState> + retry lewat <DataScreen>; layar TIDAK
 *     berpura-pura "id" adalah preferensi akun.
 *   - Gagal menulis cache perangkat (SecureStore) → biarkan; bahasa tetap
 *     aktif untuk sesi ini.
 */
import { useCallback } from "react"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import { LANGUAGES, setLanguage, useLanguage } from "@/lib/i18n"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { LanguagePicker, type LanguageCode } from "@/components/ui/language-picker"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function LanguageScreen() {
  const toast = useToast()
  const language = useLanguage()
  // GET di layar ini hanya untuk STATUS (ErrorState + catatan di bawah), bukan
  // untuk menyetel bahasa: penerapan preferensi akun adalah milik
  // <I18nProvider> satu kali per sesi. Dua tempat yang menyetel nilai akan
  // balapan dengan ketukan user sendiri (PUT dikirim, respons GET lama datang,
  // pilihan user kembali ke nilai akun).
  const query = useApiQuery<LanguageCode | null>("settings-language", (signal) =>
    api.settings.getLanguage(signal).then((res) => res?.language ?? null),
  )

  const handleChange = useCallback(
    async (next: LanguageCode) => {
      if (next === language) return
      const previous = language
      setLanguage(next)
      try {
        await api.settings.updateLanguage({ language: next })
        toast.show({
          title: "Preferensi bahasa disimpan",
          description: "Semua layar langsung mengikuti, tanpa perlu menutup aplikasi.",
          tone: "success",
          duration: 3000,
        })
      } catch (err) {
        setLanguage(previous)
        toast.show({
          title: "Gagal menyimpan bahasa",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [language, toast.show],
  )

  return (
    <DataScreen title="Bahasa" state={query} loadingMessage="Memuat preferensi bahasa…">
      <SectionHeader title="Preferensi bahasa akun" />
      <Text numberOfLines={1} variant="body" tone="secondary">
        Berlaku langsung di seluruh aplikasi dan tersimpan pada akun Anda.
      </Text>
      <LanguagePicker
        value={language}
        onChange={(v) => void handleChange(v)}
        options={LANGUAGES.map((l) => ({
          code: l.code,
          nativeName: l.nativeName,
          localizedName: l.localizedName,
        }))}
      />
      {query.error ? (
        <Text variant="caption" tone="secondary">
          Preferensi akun belum bisa dibaca — pilihan di bawah tetap berlaku di perangkat ini.
        </Text>
      ) : null}
    </DataScreen>
  )
}
