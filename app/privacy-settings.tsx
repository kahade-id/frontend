/**
 * Screen — Privasi Profil (GET/PUT /v1/settings/privacy).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import type { PrivacySettings } from "@/lib/api/settings"
import { tokens } from "@/lib/tokens"

import { Header } from "@/components/ui/header"
import { PrivacyToggleList } from "@/components/ui/privacy-toggle-list"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const ITEMS = [
  { key: "profileVisible", title: "Profile terlihat publik", description: "Pengguna lain bisa melihat profil Anda." },
  { key: "showOnlineStatus", title: "Tampilkan status online", description: "Menampilkan indikator online pada profil Anda." },
] as const

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [value, setValue] = useState<PrivacySettings>({ profileVisible: true, showOnlineStatus: true })
  const [pending, setPending] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.settings.getPrivacySettings()
      setValue(res ?? { profileVisible: true, showOnlineStatus: true })
    } catch {
      toast.show({ title: "Gagal memuat pengaturan privasi", tone: "danger" })
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
    async (key: string, next: boolean, all: Partial<Record<string, boolean>>) => {
      setValue((prev) => ({ ...prev, [key]: next, ...all }))
      setPending((p) => [...p, key])
      try {
        await api.settings.updatePrivacySettings({ [key]: next })
        toast.show({ title: "Pengaturan tersimpan", tone: "success", duration: 2500 })
      } catch {
        toast.show({ title: "Gagal menyimpan", tone: "danger" })
      } finally {
        setPending((p) => p.filter((k) => k !== key))
      }
    },
    [toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Privasi" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SectionHeader title="Visibilitas profil" inset />
          <Text variant="body" tone="secondary">
            Atur siapa yang dapat melihat informasi profil Anda.
          </Text>
          <PrivacyToggleList
            items={ITEMS}
            value={value}
            onChange={(k, n, all) => void handleChange(k, n, all)}
            pendingKeys={pending}
            disabled={loading}
          />
        </View>
      </PullToRefresh>
    </Screen>
  )
}
