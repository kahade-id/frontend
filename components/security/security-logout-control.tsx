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

  const performLogout = useCallback(async () => {
    setLoggingOut(true)
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
        // Audit Auth 2026-10-10 (#FE-S7): `logout()` hanya melempar bila
        // penanda "signed out" gagal ditulis — token lokal SUDAH dihapus.
        // Dulu layar berhenti di sini dan menyuruh "keluar sekali lagi"
        // padahal ketukan berikutnya pasti gagal (tidak ada token lagi).
        // Kini tetap diarahkan ke login; kegagalan dicatat ke telemetri.
        logWarn("security:logout", err)
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
