/**
 * Kahade — Expo Router root layout.
 *
 * Tanggung jawab file ini (urutan boot):
 *   1. Tahan native splash (preventAutoHideAsync) — dipanggil di module scope,
 *      SEBELUM komponen mount / font mulai load, sesuai docs expo-splash-screen.
 *   2. Load 7 font offline via expo-font `useFonts(fontAssets)`.
 *      Key = nama di `fontFamilyByWeight` (dijamin oleh `satisfies` di fonts.ts).
 *   3. Saat font siap ATAU gagal: sembunyikan native splash dan serahkan ke
 *      <AnimatedSplash> (JS overlay) yang fade-out → app terlihat.
 *   4. Selama belum siap: render HANYA overlay splash, bukan tree app,
 *      sehingga tidak ada FOUT (teks dengan system font sekejap).
 *
 * Kenapa native splash disembunyikan saat `ready`, bukan lebih awal:
 *   Kalau disembunyikan begitu React mount, ada satu frame di mana overlay
 *   JS belum ter-layout → kedip. Menunggu `onLayout` overlay + `ready`
 *   lebih aman. `SplashScreen.setOptions({ fade: true })` (SDK 52+) membuat
 *   native → JS handoff crossfade, bukan cut.
 *
 * - Import global.css SEKALI di sini (wajib untuk NativeWind).
 * - ThemeProvider menyuntikkan CSS variables + mengaktifkan varian dark:.
 * - §11 Web: di >= 768px (prefix `md:`) konten di-cap 520px dan di-center.
 * - StatusBar mengikuti mode efektif dari useTheme().
 */
import "../global.css"

import { useCallback, useEffect, useState } from "react"
import { Linking, Platform, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { Stack, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { useFonts } from "expo-font"
import { installedAppVersion } from "@/lib/runtime-info"

import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { AnimatedSplash } from "@/components/ui/animated-splash"
import { ContentContainer } from "@/components/ui/content-container"
import { ListLoading } from "@/components/ui/paginated-list"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useAuthSession } from "@/lib/use-auth-session"
import { AUTHENTICATED_SCREENS } from "@/lib/protected-routes"
import { compareVersions, safeHttpsUrl } from "@/lib/version"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { Dialog } from "@/components/ui/modal"
import { PortalHost, PortalProvider, PortalScene } from "@/components/ui/portal"
import { SmartAppBanner } from "@/components/ui/smart-app-banner"
import { ToastProvider } from "@/components/ui/toast"
import { api } from "@/lib/api"
import { fontAssets } from "@/lib/fonts"
import { routeForPushData } from "@/lib/notification-routing"
import { setupNotifications, subscribeNotificationOpened } from "@/lib/push-notifications"
import { ROUTES } from "@/lib/routes"
import { refreshUnreadCount } from "@/lib/unread-count"
import { tokens } from "@/lib/tokens"

export { AppErrorBoundary as ErrorBoundary } from "@/components/app-error-boundary"

// Module scope: dieksekusi sekali saat bundle dievaluasi, sebelum render apa pun.
// `.catch` karena di web / fast-refresh promise ini bisa reject jika splash
// sudah hilang — bukan error yang perlu menghentikan app.
SplashScreen.preventAutoHideAsync().catch(() => {})

// SDK 52+: crossfade native splash → konten, durasi ikut motion token.
SplashScreen.setOptions({
  duration: tokens.motion.duration.base,
  fade: true,
})

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets)

  // `ready` = boleh menampilkan app. Font error TETAP dianggap ready:
  // lebih baik app tampil dengan system font daripada stuck di splash.
  const ready = fontsLoaded || fontError != null
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    if (fontError) {
      // Tidak silent: log ke console + (nanti) ke Sentry/observability.
      // Tidak melempar error agar app tetap bisa dipakai.
      console.error(
        "[kahade/fonts] Gagal memuat font offline; app render dengan system font.",
        fontError,
      )
    }
  }, [fontError])

  // Native splash disembunyikan saat resource siap. Dipanggil dari effect,
  // bukan dari onLayout root view, karena root view yang kita render saat
  // belum ready hanyalah overlay — dan overlay itu sendirilah pengganti splash.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  const handleSplashFinish = useCallback(() => setSplashDone(true), [])

  return (
    // GestureHandlerRootView WAJIB membungkus seluruh tree yang memakai
    // <GestureDetector> (Slider, RangeSlider, BottomSheet, PullToRefresh).
    // Ditaruh di root, bukan per-screen, supaya Portal (BottomSheet) yang
    // dirender di luar layar asalnya tetap berada di dalam root gesture.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/*
        App tree HANYA di-mount setelah font siap (atau gagal). Ini yang
        mencegah FOUT — bukan sekadar menutupinya dengan overlay.
      */}
      {ready ? (
        // initialPreference bisa diisi dari storage (mis. SecureStore) dan
        // onPreferenceChange dipakai untuk menyimpannya kembali.
        <ThemeProvider initialPreference="system">
          <AppShell />
        </ThemeProvider>
      ) : null}

      {/* Overlay JS: pulse loop selama loading, fade-out saat ready, lalu unmount. */}
      {!splashDone ? <AnimatedSplash ready={ready} onFinish={handleSplashFinish} /> : null}
    </GestureHandlerRootView>
  )
}

function AppShell() {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const router = useRouter()
  const session = useAuthSession()
  const reducedMotion = useReducedMotion()
  const [skipRestoreError, setSkipRestoreError] = useState(false)

  // Satu-satunya tempat yang mendengarkan "sesi habis" dari API client
  // (client.ts memanggil emitSessionExpired saat 401 tak bisa di-refresh).
  // Client tidak boleh import expo-router (arah dependency UI → lib), jadi
  // redirect ke login dipasang di sini, di dalam navigator.
  // Stack.Protected reacts to token invalidation; never navigate before the root Stack mounts.

  // Handler foreground + Android channel notification dipasang sekali di
  // boot (idempoten) — channel wajib ada sebelum notifikasi tampil di
  // Android 26+. Pendaftaran token ke backend tetap di Welcome/logout flow.
  useEffect(() => {
    void setupNotifications().catch((err) => {
      if (__DEV__) console.warn("[kahade/push] setupNotification gagal:", err)
    })
  }, [])

  // Tap notifikasi push → buka entitas terkait (order, sengketa, chat, …)
  // lewat pemetaan tunggal lib/notification-routing; tak dikenali → tab
  // Notifikasi. Badge unread disegarkan karena server biasanya menandai
  // notifikasi yang ditap sebagai terbaca. Gate sesi: bila belum login,
  // app/index.tsx & onSessionExpired tetap mengarahkan ke login.
  useEffect(() => {
    if (session.restoring || session.error) return
    return subscribeNotificationOpened((data) => {
      const target = routeForPushData(data) ?? ROUTES.notifications
      router.push(session.token ? target : ROUTES.login)
      if (session.token) void refreshUnreadCount()
    })
  }, [router, session.restoring, session.error, session.token])

  // OTA gate: cek versi minimum dari GET /v1/public/app-version (hanya
  // force-update bila versi lokal < minVersion). Tidak boleh melempar error:
  // jaringan gagal → lanjut pakai versi lokal (update tidak wajib synchronous).
  const [versionCheck, setVersionCheck] = useState(0)
  const [forceUpdate, setForceUpdate] = useState<{
    minVersion: string
    latestVersion?: string
    message?: string | null
    storeUrl?: { ios?: string; android?: string } | null
  } | null>(null)

  useEffect(() => {
    if (Platform.OS === "web") return
    const appVersion = installedAppVersion()
    let alive = true
    api.public
      .getAppVersion()
      .then((v) => {
        if (alive && v.minVersion && compareVersions(appVersion, v.minVersion) === -1) {
          setForceUpdate({ ...v, minVersion: v.minVersion, latestVersion: v.latestVersion })
        } else if (
          alive &&
          compareVersions(appVersion, v.minVersion) != null &&
          compareVersions(appVersion, v.minVersion)! >= 0
        )
          setForceUpdate(null)
      })
      .catch(() => {
        // A failed minimum-version check never blocks offline access.
      })
    return () => {
      alive = false
    }
  }, [versionCheck])

  const storeUrl = safeHttpsUrl(
    forceUpdate?.storeUrl
      ? forceUpdate.storeUrl[Platform.OS === "ios" ? "ios" : "android"]
      : undefined,
  )

  return (
    // PortalProvider + ToastProvider HARUS di dalam ThemeProvider (kita sudah
    // di dalamnya — AppShell dirender oleh ThemeProvider) agar overlay yang
    // diteleport (BottomSheet, Modal, Banner, Tooltip, SearchOverlay,
    // LoadingScreen) dan Toast tetap menerima CSS variable dari vars().
    // Tanpa provider ini, setiap komponen overlay melempar error saat mount.
    <PortalProvider>
      <ToastProvider>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />

        {/*
          Ajakan pasang aplikasi untuk pengunjung web seluler. Komponennya
          mengembalikan null di native dan di desktop, jadi aman dirender
          tanpa syarat di sini. Ditaruh sebelum kolom konten supaya
          `position: fixed`-nya menempel di tepi atas viewport, di atas
          Header milik tiap screen.
        */}
        <SmartAppBanner />

        {/*
          Outer: full-bleed background (bg-background sudah di ThemeProvider).
          Inner: w-full di mobile; di >= md di-cap max-w-content (520px) & center.
          Border kiri-kanan tipis di web lebar memberi batas visual tanpa shadow.
          PortalHost berada di dalam kolom konten yang sama supaya overlay
          (sheet/modal) ikut ter-cap 520px di web lebar (§11), bukan full-bleed.
          PortalScene (audit #3) menyembunyikan <Stack> dari screen reader saat
          Modal/BottomSheet/SearchOverlay/LoadingOverlay terbuka; Toast berada
          di luar Scene (ToastProvider) agar tetap terbaca sebagai alert.
        */}
        <View className="flex-1 items-center">
          <ContentContainer bordered>
            <PortalScene>
              {session.restoring ? (
                <View className="px-6">
                  <ListLoading />
                </View>
              ) : session.error && !skipRestoreError ? (
                <View className="flex-1 px-6">
                  <ErrorState
                    title="Sesi belum dapat dipulihkan"
                    description={session.error}
                    onRetry={session.retry}
                  />
                  <Button variant="ghost" onPress={() => setSkipRestoreError(true)}>
                    Buka halaman masuk
                  </Button>
                </View>
              ) : (
                <Stack
                  screenOptions={{
                    headerShown: false,
                    // Stack native tidak bisa di-style via className; ambil dari tokens
                    // agar transisi header/scene tetap flat & konsisten.
                    contentStyle: { backgroundColor: palette.background },
                    animation: reducedMotion ? "none" : "slide_from_right",
                    animationDuration: tokens.motion.duration.base,
                  }}
                >
                  <Stack.Protected guard={Boolean(session.token)}>
                    {AUTHENTICATED_SCREENS.map((name) => (
                      <Stack.Screen key={name} name={name} />
                    ))}
                  </Stack.Protected>
                </Stack>
              )}
            </PortalScene>
            <PortalHost />
          </ContentContainer>
        </View>
      </ToastProvider>

      {/*
        Modal force-update (OTA): tampil di atas seluruh tree, tidak bisa
        ditutup — versi lokal di bawah minimum server tidak boleh dipakai.
        Buka storeUrl bila tersedia; fallback: tidak ada aksi (pengguna harus
        update dari toko aplikasi).
      */}
      <Dialog
        title="Perbarui aplikasi"
        description={`Versi aplikasi Anda tidak lagi didukung. Silakan perbarui ke versi minimum ${forceUpdate?.minVersion ?? "yang didukung"} untuk terus menggunakan Kahade.${forceUpdate?.message ? `\n\n${forceUpdate.message}` : ""}`}
        visible={!!forceUpdate}
        hideCancel
        confirmLabel={storeUrl ? "Buka Toko Aplikasi" : "Periksa kembali"}
        onConfirm={() => {
          if (storeUrl)
            void Linking.openURL(storeUrl).catch(() =>
              setForceUpdate((current) =>
                current
                  ? {
                      ...current,
                      message:
                        "Toko aplikasi tidak dapat dibuka. Periksa koneksi, lalu coba kembali.",
                    }
                  : null,
              ),
            )
          else {
            setVersionCheck((value) => value + 1)
            setForceUpdate((current) =>
              current
                ? {
                    ...current,
                    message:
                      "Memeriksa kembali tautan pembaruan resmi. Pembaruan aplikasi tetap diperlukan.",
                  }
                : null,
            )
          }
        }}
        onRequestClose={() => undefined}
        destructive={false}
      />
    </PortalProvider>
  )
}
