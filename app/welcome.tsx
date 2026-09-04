/**
 * Kahade — Welcome Screen (landing page setelah auth selesai).
 *
 * Screen ini muncul SETELAH user berhasil login atau registrasi.
 * Menampilkan pesan selamat datang dan meminta izin untuk fitur-fitur app.
 *
 * Struktur:
 *   <Screen>
 *   VStack gap={8}:
 *     VStack (welcome message + icon)
 *     VStack (permission rows: Kamera, Notifikasi, Biometrik*)
 *     caption "Anda dapat mengubah izin ini kapan saja di Pengaturan"
 *   Footer:
 *     Button "Mulai" → redirect ke Home (placeholder: login)
 *
 * Permissions yang dicek:
 *   1. Kamera (expo-camera) — untuk foto KYC, bukti pengiriman, QR code
 *   2. Notifikasi (expo-notifications) — untuk pemberitahuan transaksi
 *   3. Biometrik (expo-local-authentication) — hanya bila hardware tersedia
 *
 * Keputusan non-obvious:
 *   - Screen ini BUKAN bagian dari alur auth (tidak di folder (auth)).
 *     Ini adalah "landing page" setelah auth selesai, sebelum masuk ke app.
 *   - Sapaan user baru vs lama ditentukan dari route param `newUser`
 *     (`ROUTES.welcome({ newUser: true })`), BUKAN dari registration state.
 *     Setup Profil sudah memanggil `clearRegistrationState()` sebelum pindah
 *     ke sini, sehingga membaca state di sini selalu menghasilkan "user lama".
 *   - Izin TIDAK mandatory — user bisa skip dan grant nanti di settings.
 *   - Izin yang DITOLAK PERMANEN (`canAskAgain: false`) tidak bisa diminta
 *     ulang lewat dialog OS; tombol berubah menjadi "Pengaturan" yang membuka
 *     Settings app (`Linking.openSettings`). Tanpa ini tombol "Izinkan" terasa
 *     rusak — ditekan tapi tidak terjadi apa-apa.
 *   - Biometrik tidak punya "request permission": user harus mendaftarkan
 *     sidik jari/wajah di OS. Bila hardware ada tapi belum enrolled, baris
 *     menampilkan "Belum diatur" + tombol "Pengaturan" — bukan tombol
 *     "Izinkan" yang hanya mengecek ulang.
 *   - Semua hook dipanggil SEBELUM early-return (guard token) — Rules of
 *     Hooks. Versi sebelumnya memanggil useCallback setelah `return null`,
 *     yang crash ("Rendered more hooks") begitu pembacaan token selesai.
 *   - Setelah "Mulai" → registration state dibersihkan (jaga-jaga) → redirect
 *     ke Home. Home belum ada, jadi ke login sebagai placeholder.
 */
import { useCallback, useEffect, useState } from "react"
import { Linking, Platform, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { useCameraPermissions } from "expo-camera"
import * as Notifications from "expo-notifications"
import * as LocalAuthentication from "expo-local-authentication"
import { Camera as CameraIcon, Bell, Fingerprint, HandWaving } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import { getAccessToken } from "@/lib/api"
import { clearRegistrationState } from "@/lib/registration"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

/** Diameter lingkaran ikon welcome (px) — hero, di luar skala ikon §7. */
const WELCOME_BADGE_SIZE = tokens.space[12] * 2
/** Ukuran glyph di dalam lingkaran (px). */
const WELCOME_GLYPH_SIZE = tokens.space[12]

/**
 * Status izin yang dipahami UI:
 *   - "checking"  : belum selesai dibaca
 *   - "granted"   : aktif
 *   - "denied"    : belum diberikan, masih bisa diminta lewat dialog OS
 *   - "blocked"   : ditolak permanen / harus diatur di Settings
 */
type PermissionStatus = "checking" | "granted" | "denied" | "blocked"

type PermissionRowProps = {
  icon: IconComponent
  title: string
  description: string
  status: PermissionStatus
  /** Label helper saat "blocked" (mis. "Belum diatur di perangkat") */
  blockedHint?: string
  onRequest: () => void
  onOpenSettings: () => void
}

function PermissionRow({
  icon,
  title,
  description,
  status,
  blockedHint,
  onRequest,
  onOpenSettings,
}: PermissionRowProps) {
  return (
    <Card variant="elevated" className="w-full">
      <View className="flex-row items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
          <Icon icon={icon} size="md" tone={status === "granted" ? "success" : "default"} />
        </View>

        <View className="flex-1">
          <Text variant="h3" tone="primary">
            {title}
          </Text>
          <Text variant="caption" tone="secondary" className="mt-1">
            {status === "blocked" && blockedHint ? blockedHint : description}
          </Text>
        </View>

        {status === "checking" ? (
          <Text variant="caption" tone="tertiary">
            Memeriksa…
          </Text>
        ) : status === "granted" ? (
          <View className="rounded-full bg-success-soft px-3 py-1">
            <Text variant="caption" weight={600} tone="success">
              Aktif
            </Text>
          </View>
        ) : status === "blocked" ? (
          <Button variant="secondary" size="sm" onPress={onOpenSettings}>
            Pengaturan
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onPress={onRequest}>
            Izinkan
          </Button>
        )}
      </View>
    </Card>
  )
}

/** Peta response permission Expo → status UI. */
function toStatus(p: { granted: boolean; canAskAgain: boolean } | null | undefined): PermissionStatus {
  if (!p) return "checking"
  if (p.granted) return "granted"
  return p.canAskAgain ? "denied" : "blocked"
}

export default function WelcomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { newUser } = useLocalSearchParams<{ newUser?: string }>()
  const isNewUser = newUser === "1"

  // Guard: butuh access token (user sudah login)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)

  // Permission states
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const [notificationStatus, setNotificationStatus] = useState<PermissionStatus>("checking")
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricStatus, setBiometricStatus] = useState<PermissionStatus>("checking")

  useEffect(() => {
    let alive = true
    getAccessToken().then((t) => {
      if (alive) setHasToken(!!t)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const notif = await Notifications.getPermissionsAsync()
        if (!alive) return
        setNotificationStatus(toStatus(notif))

        const hasHardware = await LocalAuthentication.hasHardwareAsync()
        if (!alive) return
        setBiometricAvailable(hasHardware)
        if (hasHardware) {
          const enrolled = await LocalAuthentication.isEnrolledAsync()
          if (!alive) return
          // Tidak ada dialog OS untuk biometrik: belum enrolled = harus ke Settings.
          setBiometricStatus(enrolled ? "granted" : "blocked")
        }
      } catch (error) {
        // Izin bersifat opsional — gagal membaca status tidak menghentikan user.
        if (__DEV__) console.warn("[welcome] Permission check failed:", error)
      } finally {
        if (alive) setPermissionsLoaded(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const openSettings = useCallback(() => {
    if (Platform.OS === "web") return
    Linking.openSettings().catch((error) => {
      if (__DEV__) console.warn("[welcome] openSettings failed:", error)
    })
  }, [])

  const handleRequestCamera = useCallback(async () => {
    try {
      await requestCameraPermission()
    } catch (error) {
      if (__DEV__) console.warn("[welcome] Camera permission request failed:", error)
    }
  }, [requestCameraPermission])

  const handleRequestNotification = useCallback(async () => {
    try {
      const result = await Notifications.requestPermissionsAsync()
      setNotificationStatus(toStatus(result))
    } catch (error) {
      if (__DEV__) console.warn("[welcome] Notification permission request failed:", error)
    }
  }, [])

  const handleRecheckBiometric = useCallback(async () => {
    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      setBiometricStatus(enrolled ? "granted" : "blocked")
    } catch (error) {
      if (__DEV__) console.warn("[welcome] Biometric check failed:", error)
    }
  }, [])

  const handleStart = useCallback(() => {
    // Jaga-jaga bila jalur masuk tidak melewati Setup Profil (yang sudah membersihkan).
    clearRegistrationState()
    // TODO: redirect ke Home/Beranda saat screen tersedia; login = placeholder.
    router.replace(ROUTES.login)
  }, [router])

  // ── Guard dijalankan SETELAH semua hook di atas ─────────────────────
  if (hasToken === null) return null
  if (!hasToken) return <Redirect href={ROUTES.login} />

  const welcomeTitle = isNewUser ? "Selamat datang di Kahade!" : "Selamat datang kembali!"
  const welcomeDescription = isNewUser
    ? "Akun Anda siap digunakan. Izinkan akses berikut untuk pengalaman terbaik."
    : "Senang melihat Anda kembali. Izinkan akses berikut untuk fitur lengkap."

  const cameraStatus = toStatus(cameraPermission)

  if (!permissionsLoaded) {
    return (
      <Screen padded={false} edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" tone="secondary" accessibilityLiveRegion="polite">
            Memeriksa izin…
          </Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen padded={false} edges={["top"]}>
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
              // Ukuran hero dihitung dari tokens.space — nilai numerik, jadi style.
              style={{ width: WELCOME_BADGE_SIZE, height: WELCOME_BADGE_SIZE }}
            >
              <Icon icon={HandWaving} size={WELCOME_GLYPH_SIZE} tone="inverse" weight="fill" />
            </View>

            <VStack gap={2} className="items-center px-4">
              <Text variant="h1" className="text-center text-balance" accessibilityRole="header">
                {welcomeTitle}
              </Text>
              <Text variant="body" tone="secondary" className="text-center text-pretty">
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
              status={cameraStatus}
              blockedHint="Akses ditolak. Aktifkan lewat Pengaturan perangkat."
              onRequest={() => void handleRequestCamera()}
              onOpenSettings={openSettings}
            />

            <PermissionRow
              icon={Bell}
              title="Notifikasi"
              description="Untuk pemberitahuan transaksi dan pesan penting"
              status={notificationStatus}
              blockedHint="Akses ditolak. Aktifkan lewat Pengaturan perangkat."
              onRequest={() => void handleRequestNotification()}
              onOpenSettings={openSettings}
            />

            {biometricAvailable ? (
              <PermissionRow
                icon={Fingerprint}
                title="Biometrik"
                description="Untuk masuk cepat dan konfirmasi transaksi tanpa PIN"
                status={biometricStatus}
                blockedHint="Belum diatur. Daftarkan sidik jari/wajah di Pengaturan perangkat."
                onRequest={() => void handleRecheckBiometric()}
                onOpenSettings={openSettings}
              />
            ) : null}
          </VStack>

          <Text variant="caption" tone="tertiary" className="text-center">
            Anda dapat mengubah izin ini kapan saja di Pengaturan
          </Text>
        </VStack>
      </ScrollView>

      {/* Footer: inset bawah dijumlahkan di sini (Screen edges top saja) agar tidak ganda */}
      <View
        className="w-full border-t border-border bg-background px-6 pt-4"
        style={{ paddingBottom: tokens.space[4] + insets.bottom }}
      >
        <Button onPress={handleStart}>Mulai</Button>
      </View>
    </Screen>
  )
}
