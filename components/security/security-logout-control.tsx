import { useCallback, useState } from "react"
import { Platform, View } from "react-native"
import { router } from "expo-router"
import { SignOut } from "phosphor-react-native"

import { api } from "@/lib/api"
import { clearSession } from "@/lib/api/session"
import { logWarn } from "@/lib/telemetry"
import { ROUTES } from "@/lib/routes"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { unregisterWebPushDevice } from "@/lib/web-push"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"

/**
 * Keluar adalah aksi eksplisit, bukan bagian dari data/menu Keamanan.
 * `api.auth.logout` tetap membersihkan sesi lokal saat offline dan mengatur
 * percobaan pencabutan server best-effort sesuai kontrak sesi yang ada.
 */
export function SecurityLogoutControl() {
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null)

  const performLogout = useCallback(async () => {
    setLoggingOut(true)
    setLogoutNotice(null)
    try {
      const deviceApi = {
        registerDevice: (dto: Parameters<typeof api.notifications.registerDevice>[0]) =>
          api.notifications.registerDevice(dto),
        unregisterDevice: (deviceId: string) => api.notifications.unregisterDevice(deviceId),
      }
      if (Platform.OS === "web") {
        await unregisterWebPushDevice(deviceApi).catch((err) =>
          logWarn("security:unregister-push", err),
        )
      } else {
        await unregisterPushDevice(deviceApi).catch((err) =>
          logWarn("security:unregister-push", err),
        )
      }

      try {
        await api.auth.logout()
      } catch (err) {
        logWarn("security:logout", err)
        setLogoutOpen(false)
        setLogoutNotice(
          "Penanda sesi perangkat belum tersimpan. Token sudah dihapus; coba keluar sekali lagi untuk memastikan sesi tidak aktif kembali.",
        )
        return
      } finally {
        await clearSession()
      }
      router.replace(ROUTES.login)
    } finally {
      setLoggingOut(false)
    }
  }, [])

  return (
    <View className="gap-2">
      {logoutNotice ? (
        <Alert
          tone="warning"
          title="Perlu konfirmasi keluar"
          onDismiss={() => setLogoutNotice(null)}
        >
          {logoutNotice}
        </Alert>
      ) : null}
      <Button
        variant="destructive"
        size="md"
        leftIcon={SignOut}
        onPress={() => setLogoutOpen(true)}
      >
        Keluar
      </Button>
      <Dialog
        visible={logoutOpen}
        tone="danger"
        destructive
        icon={SignOut}
        title="Keluar dari Kahade?"
        description="Keluar dari akun Kahade di perangkat ini?"
        confirmLabel="Keluar"
        cancelLabel="Batal"
        loading={loggingOut}
        onConfirm={() => void performLogout()}
        onCancel={() => setLogoutOpen(false)}
        onRequestClose={() => setLogoutOpen(false)}
      />
    </View>
  )
}
