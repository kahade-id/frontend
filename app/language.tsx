/**
 * Screen — Bahasa Aplikasi (GET/PUT /v1/settings/language).
 *
 * Audit: kegagalan GET sebelumnya hanya memunculkan toast, lalu layar tetap
 * merender "id" sebagai pilihan aktif — seolah itu preferensi tersimpan di
 * akun. Sekarang kegagalan muat memakai <ErrorState> + retry via <DataScreen>.
 */
import { useCallback } from "react"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import {
  LanguagePicker,
  DEFAULT_LANGUAGES,
  type LanguageCode,
} from "@/components/ui/language-picker"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const FALLBACK_LANGUAGE: LanguageCode = "id"

export default function LanguageScreen() {
  const toast = useToast()
  const query = useApiQuery<LanguageCode>("settings-language", () =>
    api.settings.getLanguage().then((res) => (res?.language as LanguageCode) ?? FALLBACK_LANGUAGE),
  )
  const value = query.data ?? FALLBACK_LANGUAGE
  const { setData } = query

  const handleChange = useCallback(
    async (next: LanguageCode) => {
      const previous = value
      setData(next)
      try {
        await api.settings.updateLanguage({ language: next })
        toast.show({ title: "Preferensi bahasa disimpan", tone: "success", duration: 3000 })
      } catch (err) {
        setData(previous)
        toast.show({
          title: "Gagal menyimpan bahasa",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [value, setData, toast.show],
  )

  return (
    <DataScreen title="Bahasa" state={query} loadingMessage="Memuat preferensi bahasa…">
      <SectionHeader title="Preferensi bahasa akun" />
      <Text variant="body" tone="secondary">
        Preferensi ini disimpan pada akun untuk layanan yang mendukungnya. Antarmuka aplikasi saat
        ini tetap menggunakan Bahasa Indonesia.
      </Text>
      <LanguagePicker
        value={value}
        onChange={(v) => void handleChange(v)}
        options={DEFAULT_LANGUAGES}
      />
    </DataScreen>
  )
}
