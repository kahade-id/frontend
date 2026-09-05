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
import Constants from "expo-constants"

import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { AnimatedSplash } from "@/components/ui/animated-splash"
import { Dialog } from "@/components/ui/modal"
import { PortalHost, PortalProvider, PortalScene } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { api, onSessionExpired } from "@/lib/api"
import { fontAssets } from "@/lib/fonts"
import { setupNotifications } from "@/lib/push-notifications"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

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
      {!splashDone ? (
        <AnimatedSplash ready={ready} onFinish={handleSplashFinish} />
      ) : null}
    </GestureHandlerRootView>
  )
}

function AppShell() {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const router = useRouter()

  // Satu-satunya tempat yang mendengarkan "sesi habis" dari API client
  // (client.ts memanggil emitSessionExpired saat 401 tak bisa di-refresh).
  // Client tidak boleh import expo-router (arah dependency UI → lib), jadi
  // redirect ke login dipasang di sini, di dalam navigator.
  useEffect(() => onSessionExpired(() => router.replace(ROUTES.login)), [router])

  // Handler foreground + Android channel notification dipasang sekali di
  // boot (idempoten) — channel wajib ada sebelum notifikasi tampil di
  // Android 26+. Pendaftaran token ke backend tetap di Welcome/logout flow.
  useEffect(() => {
    void setupNotifications().catch((err) => {
      if (__DEV__) console.warn("[kahade/push] setupNotification gagal:", err)
    })
  }, [])

  // OTA gate: cek versi minimum dari GET /v1/public/app-version (hanya
  // force-update bila versi lokal < minVersion). Tidak boleh melempar error:
  // jaringan gagal → lanjut pakai versi lokal (update tidak wajib synchronous).
  const [forceUpdate, setForceUpdate] = useState<{
    minVersion: string
    latestVersion: string
    message?: string | null
    storeUrl?: { ios?: string; android?: string } | null
  } | null>(null)

  useEffect(() => {
    const appVersion = Constants.expoConfig?.version ?? "0.1.0"
    const parse = (v: string) =>
      v
        .split(".")
        .map((x) => Number.parseInt(x, 10) || 0)
        .reduce((acc, n) => acc * 1000 + n, 0)
    api.public
      .getAppVersion()
      .then((v) => {
        if (v && parse(appVersion) < parse(v.minVersion)) setForceUpdate(v)
      })
      .catch(() => {
        // OTA check gagal = jangan blokir aplikasi; versi minimum tidak diketahui.
      })
  }, [])

  const storeUrl = forceUpdate?.storeUrl
    ? forceUpdate.storeUrl[Platform.OS === "ios" ? "ios" : "android"] ??
      forceUpdate.storeUrl.ios ??
      forceUpdate.storeUrl.android
    : undefined

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
          <View className="w-full flex-1 md:max-w-content md:border-x md:border-border">
            <PortalScene>
              <Stack
                screenOptions={{
                  headerShown: false,
                  // Stack native tidak bisa di-style via className; ambil dari tokens
                  // agar transisi header/scene tetap flat & konsisten.
                  contentStyle: { backgroundColor: palette.background },
                  animation: "slide_from_right",
                  animationDuration: tokens.motion.duration.base,
                }}
              />
            </PortalScene>
            <PortalHost />
          </View>
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
        description={
          `Versi aplikasi Anda tidak lagi didukung. Silakan perbarui ke versi ${forceUpdate?.latestVersion ?? "terbaru"} untuk terus menggunakan Kahade.${forceUpdate?.message ? `\n\n${forceUpdate.message}` : ""}`
        }
        visible={!!forceUpdate}
        hideCancel
        confirmLabel="Buka Toko Aplikasi"
        onConfirm={() => {
          if (storeUrl) void Linking.openURL(storeUrl).catch(() => undefined)
        }}
        onRequestClose={() => undefined}
        destructive={false}
      />
    </PortalProvider>
  )
}
