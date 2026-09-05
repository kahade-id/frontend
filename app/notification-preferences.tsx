/**
 * Screen — Preferensi Notifikasi (GET/PUT /v1/notifications/preferences).
 * Matriks kategori × kanal dari NotificationPreferencesMatrix.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import type { NotificationPreferences as ApiNotificationPreferences } from "@/lib/api/notifications"
import type { NotificationPreferenceKey, NotificationPreferences } from "@/components/ui/notification-preferences-matrix"
import { tokens } from "@/lib/tokens"

import { Header } from "@/components/ui/header"
import { NotificationPreferencesMatrix } from "@/components/ui/notification-preferences-matrix"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [value, setValue] = useState<NotificationPreferences>({})
    const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPrefs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.notifications.getNotificationPreferences()
      setValue(res ?? {})
    } catch {
      setError("Gagal memuat preferensi.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPrefs()
  }, [fetchPrefs])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchPrefs()
    setRefreshing(false)
  }, [fetchPrefs])

  const handleChange = useCallback(
    async (next: NotificationPreferences, key: NotificationPreferenceKey) => {
      setValue(next)
      try {
        await api.notifications.updateNotificationPreferences({ [key]: next[key] })
        toast.show({ title: "Preferensi tersimpan", tone: "success", duration: 2500 })
      } catch {
        toast.show({ title: "Gagal menyimpan preferensi", tone: "danger" })
        setValue((prev) => ({ ...prev, [key]: !next[key] }))
      }
    },
    [toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Preferensi Notifikasi" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          {error ? (
            <Text variant="body" tone="danger">{error}</Text>
          ) : loading ? (
            <Text variant="body" tone="secondary">Memuat preferensi…</Text>
          ) : (
            <>
              <Text variant="body" tone="secondary">
                Pilih kanal notifikasi untuk setiap kategori. Perubahan disimpan otomatis.
              </Text>
              <NotificationPreferencesMatrix
                value={value}
                onChange={(n, k) => void handleChange(n, k)}
                disabled={loading}
              />
            </>
          )}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
