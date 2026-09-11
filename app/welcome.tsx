/**
 * Kahade — Welcome Screen (gate setelah auth).
 *
 * Ditampilkan setelah:
 *   a. User baru menyelesaikan setup profil (Setup Profil → welcome?newUser=1)
 *   b. User lama berhasil login (Login → welcome)
 *
 * Tugas screen ini:
 *   1. Minta izin push notification (sekali, dengan rationale)
 *   2. Redirect ke Beranda setelah user tap tombol / setelah izin selesai
 *
 * Param:
 *   newUser=1  → sapaan "Selamat datang di Kahade" (onboarding selesai)
 *   (kosong)   → sapaan "Selamat kembali"
 *
 * Keputusan non-obvious:
 *   - Push notification diminta di sini (bukan di splash / root _layout)
 *     karena ini titik pertama user melihat UI app yang bermakna — rationale
 *     "agar Anda dapat notifikasi transaksi" relevan konteksnya.
 *   - `router.replace` (bukan push) ke ROUTES.home agar Welcome tidak masuk
 *     back stack — user tidak bisa back ke sini setelah masuk Beranda.
 *   - `registerPushDevice` (lib/push-notifications.ts) membungkus Expo
 *     Notifications + POST /v1/notifications/register-device dengan DTO
 *     RegisterDeviceDto (token, platform, deviceId) persis spec.
 *     Error diabaikan secara diam-diam: izin ditolak bukan alasan menolak
 *     user masuk app.
 *   - Judul memakai <DisplayHeading> (EB Garamond) + Logo lockup — sama
 *     dengan onboarding (§1.4 / §3.1).
 */
import { useLocalSearchParams } from "expo-router"
import { useRouter } from "expo-router"
import { Platform, View } from "react-native"

import { api } from "@/lib/api"
import { registerPushDevice } from "@/lib/push-notifications"
import { ROUTES } from "@/lib/routes"
import { registerWebPushDevice } from "@/lib/web-push"

import { Button } from "@/components/ui/button"
import { Stagger } from "@/components/ui/fade-in"
import { DisplayHeading } from "@/components/ui/heading"
import { Logo } from "@/components/ui/logo"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"

export default function WelcomeScreen() {
  const router = useRouter()
  const { newUser } = useLocalSearchParams<{ newUser?: string }>()
  const isNewUser = newUser === "1"

  async function handleStart() {
    // Web memakai FCM Web Push (lib/web-push.web.ts), native memakai Expo
    // push token (lib/push-notifications.ts). Keduanya bermuara ke endpoint
    // register-device yang sama dengan `platform` berbeda. Keduanya no-op
    // yang aman bila belum dikonfigurasi / izin ditolak — kegagalan push
    // tidak boleh menghalangi user masuk app.
    const deviceApi = {
      registerDevice: (body: Parameters<typeof api.notifications.registerDevice>[0]) =>
        api.notifications.registerDevice(body),
      unregisterDevice: () => api.notifications.unregisterDevice(),
    }
    try {
      if (Platform.OS === "web") await registerWebPushDevice(deviceApi)
      else await registerPushDevice(deviceApi)
    } catch {
      // tidak ada notif bukan akhir dunia
    }
    router.replace(ROUTES.home)
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <VStack flex justify="center" align="center" gap={6}>
        {/* v2: sambutan reveal bertingkat (logo → teks → tombol). Satu dari
            sedikit layar yang boleh sedikit teatrikal — momen emosional
            pertama (atau kembalinya) pengguna. */}
        <Stagger duration="base" step={80}>
          <Logo variant="lockup" size="md" />
          <View className="items-center gap-3">
            <DisplayHeading className="text-center">
              {isNewUser ? "Selamat datang\ndi Kahade" : "Selamat kembali"}
            </DisplayHeading>
            <Text variant="body" tone="secondary" className="text-center">
              {isNewUser
                ? "Akun Anda sudah siap. Mari mulai transaksi aman bersama Kahade."
                : "Transaksi escrow aman, mudah, dan terpercaya."}
            </Text>
          </View>

          <Button onPress={handleStart}>
            {isNewUser ? "Mulai" : "Masuk ke beranda"}
          </Button>
        </Stagger>
      </VStack>
    </Screen>
  )
}