/**
 * Screen — Bahasa Aplikasi (GET/PUT /v1/settings/language).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { Header } from "@/components/ui/header"
import { LanguagePicker, DEFAULT_LANGUAGES, type LanguageCode } from "@/components/ui/language-picker"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function LanguageScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [value, setValue] = useState<LanguageCode>("id")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.settings.getLanguage()
      setValue(res?.language ?? "id")
    } catch {
      toast.show({ title: "Gagal memuat bahasa", tone: "danger" })
    } finally {
      setLoading(false)
    }
  }, [toast.show])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  const handleChange = useCallback(
    async (next: LanguageCode) => {
      const prev = value
      setValue(next)
      try {
        await api.settings.updateLanguage({ language: next })
        toast.show({ title: "Bahasa diperbarui", tone: "success", duration: 3000 })
      } catch {
        setValue(prev)
        toast.show({ title: "Gagal menyimpan bahasa", tone: "danger" })
      }
    },
    [value, toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Bahasa" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SectionHeader title="Bahasa aplikasi" inset />
          <Text variant="body" tone="secondary">
            Pilih bahasa antarmuka aplikasi.
          </Text>
          <LanguagePicker
            value={value}
            onChange={(v) => void handleChange(v)}
            options={DEFAULT_LANGUAGES}
            disabled={loading}
          />
        </View>
      </PullToRefresh>
    </Screen>
  )
}
