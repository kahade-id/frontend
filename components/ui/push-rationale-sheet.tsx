/**
 * Kahade — bottom sheet rationale izin notifikasi (U5-003, journey 2026-09-29).
 *
 * Pengganti layar `app/welcome.tsx` yang dihapus: rationale "kenapa kami
 * meminta izin notifikasi" kini tampil sebagai bottom sheet di atas feed
 * Etalase pada login pertama, dengan tombol "Nanti".
 *
 * Copy rationale dipindahkan dari welcome (T1-006): manfaat notifikasi
 * transaksi + penenang "hanya hal penting, bisa diubah di Pengaturan".
 * Kegagalan registrasi push diabaikan diam-diam — izin ditolak bukan alasan
 * menghalangi user (sama seperti perilaku welcome dulu).
 */
import { useCallback, useState } from "react"
import { Platform, View } from "react-native"
import { BellRinging } from "phosphor-react-native"

import { api } from "@/lib/api"
import { registerPushDevice } from "@/lib/push-notifications"
import { registerWebPushDevice } from "@/lib/web-push"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

export function PushRationaleSheet({
  visible,
  onClose,
}: {
  /** Tampil — parent mengatur false di onClose. */
  visible: boolean
  /** Dipanggil untuk SEMUA jalur tutup (Aktifkan/Nanti/X/backdrop). */
  onClose: () => void
}) {
  const [enabling, setEnabling] = useState(false)

  const handleEnable = useCallback(async () => {
    if (enabling) return
    setEnabling(true)
    // Logika registrasi dipindahkan verbatim dari app/welcome.tsx
    // (dihapus U5-003): web = FCM Web Push, native = token Expo Push.
    const deviceApi = {
      registerDevice: (body: Parameters<typeof api.notifications.registerDevice>[0]) =>
        api.notifications.registerDevice(body),
      unregisterDevice: (deviceId: string) =>
        api.notifications.unregisterDevice(deviceId),
    }
    try {
      if (Platform.OS === "web") await registerWebPushDevice(deviceApi)
      else await registerPushDevice(deviceApi)
    } catch {
      // tidak ada notif bukan akhir dunia
    } finally {
      setEnabling(false)
      onClose()
    }
  }, [enabling, onClose])

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onClose}
      title="Aktifkan notifikasi?"
      description="Agar Anda tahu saat dana masuk, barang dikirim, atau ada sengketa."
    >
      <View className="gap-4">
        <View className="flex-row items-start gap-3 rounded-md bg-surface-elevated px-4 py-3">
          <Icon icon={BellRinging} size="md" tone="active" />
          <Text variant="caption" tone="secondary" className="flex-1 text-pretty">
            Notifikasi hanya untuk hal penting transaksi. Bisa diubah kapan
            saja di Pengaturan.
          </Text>
        </View>
        <View className="gap-2">
          <Button fullWidth loading={enabling} onPress={() => void handleEnable()}>
            Aktifkan notifikasi
          </Button>
          <Button variant="secondary" fullWidth disabled={enabling} onPress={onClose}>
            Nanti
          </Button>
        </View>
      </View>
    </BottomSheet>
  )
}
