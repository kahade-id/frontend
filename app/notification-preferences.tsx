/**
 * Screen — Preferensi Notifikasi (GET/PUT /v1/notifications/preferences).
 * Matriks kategori × kanal dari NotificationPreferencesMatrix.
 *
 * Audit:
 *   - Loading dan error sebelumnya dirender sebagai <Text> polos: tidak ada
 *     tombol "Coba lagi", tidak ada role alert, dan gagal-muat terlihat sama
 *     seperti "preferensi memang kosong". Sekarang memakai kerangka
 *     <DataScreen> (LoadingScreen / ErrorState + retry) seperti layar lain.
 *   - Toggle memakai `query.setData` sebagai sumber tunggal (tidak ada salinan
 *     state kedua yang bisa desinkron dengan hasil refresh), dan rollback
 *     mengembalikan NILAI SEBELUMNYA, bukan negasi nilai baru.
 *   - Pesan gagal simpan menyertakan `userMessage(err)` dari backend.
 */
import { useCallback } from "react"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import {
  NotificationPreferencesMatrix,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "@/components/ui/notification-preferences-matrix"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function NotificationPreferencesScreen() {
  const toast = useToast()
  const query = useApiQuery<NotificationPreferences>("notification-preferences", () =>
    api.notifications.getNotificationPreferences().then((res) => res ?? {}),
  )
  const value = query.data ?? {}
  const { setData } = query

  const handleChange = useCallback(
    async (next: NotificationPreferences, key: NotificationPreferenceKey) => {
      const previous = value[key]
      setData(next)
      try {
        await api.notifications.updateNotificationPreferences({ [key]: next[key] })
        toast.show({ title: "Preferensi tersimpan", tone: "success", duration: 2500 })
      } catch (err) {
        setData((prev) => ({ ...(prev ?? {}), [key]: previous }))
        toast.show({
          title: "Gagal menyimpan preferensi",
          description: userMessage(err),
          tone: "danger",
        })
      }
    },
    [value, setData, toast.show],
  )

  return (
    <DataScreen
      title="Preferensi Notifikasi"
      state={query}
      loadingMessage="Memuat preferensi…"
    >
      <Text variant="body" tone="secondary">
        Pilih kanal notifikasi untuk setiap kategori. Perubahan disimpan otomatis.
      </Text>
      <NotificationPreferencesMatrix
        value={value}
        onChange={(n, k) => void handleChange(n, k)}
      />
    </DataScreen>
  )
}
