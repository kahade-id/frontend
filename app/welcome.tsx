/**
 * Kahade — Welcome Screen (landing page setelah auth selesai).
 *
 * Screen ini muncul SETELAH user berhasil login atau registrasi.
 * Menampilkan pesan selamat datang dan meminta izin untuk fitur-fitur app.
 *
 * Struktur:
 *   <Screen>
 *   VStack gap={8}:
 *     VStack (welcome message + illustration/icon)
 *       Icon besar (HandWaving atau similar)
 *       Heading H1 "Selamat Datang!" atau "Selamat Datang Kembali!"
 *       Text body penjelasan
 *     VStack (permission requests)
 *       PermissionRow: Kamera
 *       PermissionRow: Notifikasi
 *       PermissionRow: Biometrik (optional)
 *     VStack (info text)
 *   Footer:
 *     Button "Mulai" → redirect ke Home
 *
 * Permissions yang dicek:
 *   1. Kamera (expo-camera) — untuk foto KYC, bukti pengiriman, QR code
 *   2. Notifikasi (expo-notifications) — untuk pemberitahuan transaksi
 *   3. Biometrik (expo-local-authentication) — untuk login cepat & konfirmasi
 *
 * Logic:
 *   - Cek status permission saat screen mount
 *   - Tampilkan status: granted / not granted
 *   - User bisa tap "Izinkan" untuk request permission
 *   - Setelah grant → update status
 *   - Tombol "Mulai" selalu aktif (izin tidak mandatory)
 *   - Setelah tap "Mulai" → redirect ke Home (placeholder: login)
 *
 * Keputusan non-obvious:
 *   - Screen ini BUKAN bagian dari alur auth (tidak di folder (auth)).
 *     Ini adalah "landing page" setelah auth selesai, sebelum masuk ke app.
 *   - Pesan welcome berbeda untuk user baru vs user lama:
 *     - User baru (registration state masih ada) → "Selamat Datang di Kahade!"
 *     - User lama (login) → "Selamat Datang Kembali!"
 *   - Izin TIDAK mandatory — user bisa skip dan grant nanti di settings.
 *     Ini menghindari user yang tidak ingin grant permission dari stuck.
 *   - Biometrik optional — tidak semua device punya sensor atau user tidak
 *     ingin pakai. Tampilkan saja sebagai opsi.
 *   - Setelah "Mulai" → clear registration state (kalau ada) → redirect ke Home.
 *     Untuk sekarang Home belum ada, jadi redirect ke login sebagai placeholder.
 *   - Permission status di-check async saat mount. Selama loading, tampilkan
 *     skeleton atau loading state.
 *   - Icon besar di atas memberi kesan "welcome" dan "friendly". Pakai
 *     Phosphor icon HandWaving atau similar.
 */
import { useCallback, useEffect, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Redirect, useRouter } from "expo-router"
import { useCameraPermissions } from "expo-camera"
import * as Notifications from "expo-notifications"
import * as LocalAuthentication from "expo-local-authentication"
import { Camera as CameraIcon, Bell, Fingerprint, HandWaving } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import { Card } from "@/components/ui/card"
import { getAccessToken } from "@/lib/api"
import { clearRegistrationState, getRegistrationState } from "@/lib/registration"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

/** Ukuran icon welcome (pixels) */
const WELCOME_ICON_SIZE = 96
/** Ukuran container icon (pixels) */
const WELCOME_ICON_CONTAINER_SIZE = 96

type PermissionRowProps = {
  icon: React.ComponentType<any>
  title: string
  description: string
  granted: boolean | null
  onRequest: () => void
  disabled?: boolean
}

function PermissionRow({ icon, title, description, granted, onRequest, disabled }: PermissionRowProps) {
  return (
    <Card variant="elevated" className="w-full">
      <View className="flex-row items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
          <Icon icon={icon} size="md" tone={granted ? "success" : "default"} />
        </View>

        <View className="flex-1">
          <Text variant="h3" tone="primary">
            {title}
          </Text>
          <Text variant="caption" tone="secondary" className="mt-1">
            {description}
          </Text>
        </View>

        {granted === null ? (
          <Text variant="caption" tone="tertiary">
            Memeriksa…
          </Text>
        ) : granted ? (
          <View className="rounded-full bg-success-soft px-3 py-1">
            <Text variant="caption" weight={600} tone="success">
              Aktif
            </Text>
          </View>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onPress={onRequest}
            disabled={disabled}
          >
            Izinkan
          </Button>
        )}
      </View>
    </Card>
  )
}

export default function WelcomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()

  // Guard: butuh access token (user sudah login)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)

  // Permission states
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [notificationPermission, setNotificationPermission] = useState<boolean | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>(false)
  const [biometricPermission, setBiometricPermission] = useState<boolean | null>(null)

  // Check token on mount
  useEffect(() => {
    let alive = true
    getAccessToken().then((t) => {
      if (alive) setHasToken(!!t)
    })
    return () => {
      alive = false
    }
  }, [])

  // Check permissions on mount
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // Notifications
        const notificationStatus = await Notifications.getPermissionsAsync()
        if (!alive) return
        setNotificationPermission(notificationStatus.status === "granted")

        // Biometric (check if available first)
        const isBiometricAvailable = await LocalAuthentication.hasHardwareAsync()
        if (!alive) return
        setBiometricAvailable(isBiometricAvailable)
        if (isBiometricAvailable) {
          const isEnrolled = await LocalAuthentication.isEnrolledAsync()
          if (!alive) return
          setBiometricPermission(isEnrolled)
        }
      } catch (error) {
        // Silent fail — permissions are optional, user can grant later in settings
        if (__DEV__) {
          console.warn("[welcome] Permission check failed:", error)
        }
      } finally {
        if (alive) setPermissionsLoaded(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Redirect kalau belum login
  if (hasToken === null) return null
  if (!hasToken) return <Redirect href={ROUTES.login} />

  // Determine welcome message
  const regState = getRegistrationState()
  const isNewUser = !!regState
  const welcomeTitle = isNewUser ? "Selamat Datang di Kahade!" : "Selamat Datang Kembali!"
  const welcomeDescription = isNewUser
    ? "Akun Anda siap digunakan. Izinkan akses untuk pengalaman terbaik."
    : "Senang melihat Anda kembali. Izinkan akses untuk fitur lengkap."

  // Derived: permission granted states
  const cameraGranted = cameraPermission === null ? null : cameraPermission.status === "granted"

  const handleRequestCamera = useCallback(async () => {
    try {
      await requestCameraPermission()
    } catch (error) {
      if (__DEV__) {
        console.warn("[welcome] Camera permission request failed:", error)
      }
    }
  }, [requestCameraPermission])

  const handleRequestNotification = useCallback(async () => {
    try {
      const result = await Notifications.requestPermissionsAsync()
      setNotificationPermission(result.status === "granted")
    } catch (error) {
      if (__DEV__) {
        console.warn("[welcome] Notification permission request failed:", error)
      }
    }
  }, [])

  const handleRequestBiometric = useCallback(async () => {
    // Biometric tidak ada "request" seperti camera/notification.
    // User harus enroll di settings OS dulu.
    // Kita hanya bisa check apakah sudah enrolled atau tidak.
    try {
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()
      setBiometricPermission(isEnrolled)
    } catch (error) {
      if (__DEV__) {
        console.warn("[welcome] Biometric check failed:", error)
      }
    }
  }, [])

  const handleStart = useCallback(() => {
    // Clear registration state (kalau user baru)
    if (regState) {
      clearRegistrationState()
    }
    // TODO: redirect ke Home/Beranda saat screen tersedia
    // Untuk sekarang, redirect ke login sebagai placeholder
    router.replace(ROUTES.login)
  }, [regState, router])

  // Show loading until permissions are checked
  if (!permissionsLoaded) {
    return (
      <Screen padded={false} edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" tone="secondary">
            Memeriksa izin…
          </Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-6 py-8"
        showsVerticalScrollIndicator={false}
      >
        <VStack gap={8} className="flex-1">
          {/* Welcome message */}
          <VStack gap={4} className="items-center pt-8">
            <View
              className="items-center justify-center rounded-full bg-primary"
              style={{
                width: WELCOME_ICON_CONTAINER_SIZE,
                height: WELCOME_ICON_CONTAINER_SIZE,
              }}
            >
              <HandWaving
                size={WELCOME_ICON_SIZE / 2}
                color={tokens.colors[mode].primaryForeground}
                weight="fill"
              />
            </View>

            <VStack gap={2} className="items-center">
              <Text variant="h1" className="text-center text-balance">
                {welcomeTitle}
              </Text>
              <Text variant="body" tone="secondary" className="text-center text-pretty max-w-[320px]">
                {welcomeDescription}
              </Text>
            </VStack>
          </VStack>

          {/* Permission requests */}
          <VStack gap={3}>
            <PermissionRow
              icon={CameraIcon}
              title="Kamera"
              description="Untuk memotret dokumen verifikasi dan bukti pengiriman"
              granted={cameraGranted}
              onRequest={handleRequestCamera}
            />

            <PermissionRow
              icon={Bell}
              title="Notifikasi"
              description="Untuk pemberitahuan transaksi dan pesan penting"
              granted={notificationPermission}
              onRequest={handleRequestNotification}
            />

            {biometricAvailable && (
              <PermissionRow
                icon={Fingerprint}
                title="Biometrik"
                description="Untuk login cepat dan konfirmasi transaksi tanpa PIN"
                granted={biometricPermission}
                onRequest={handleRequestBiometric}
              />
            )}
          </VStack>

          {/* Info text */}
          <VStack gap={2} className="items-center">
            <Text variant="caption" tone="tertiary" className="text-center">
              Anda dapat mengubah izin ini kapan saja di Pengaturan
            </Text>
          </VStack>
        </VStack>
      </ScrollView>

      {/* Footer button */}
      <View
        className="w-full border-t border-border bg-background px-6 pt-4"
        style={{ paddingBottom: tokens.space[4] + insets.bottom }}
      >
        <Button onPress={handleStart} size="md">
          Mulai
        </Button>
      </View>
    </Screen>
  )
}
