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

import { useCallback, useEffect, useRef, useState } from "react"
import { AppState, Linking, Platform, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { Stack, usePathname, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { useFonts } from "expo-font"
import { installedAppVersion } from "@/lib/runtime-info"

import { I18nProvider } from "@/components/i18n-provider"
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { AnimatedSplash } from "@/components/ui/animated-splash"
import { ContentContainer } from "@/components/ui/content-container"
import { APP_TITLE } from "@/components/ui/header"
import { ListLoading } from "@/components/ui/paginated-list"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useAuthSession } from "@/lib/use-auth-session"
import { PendingActionsBanner } from "@/components/pending-actions-banner"
import { AUTHENTICATED_SCREENS, isProtectedPath } from "@/lib/protected-routes"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { compareVersions, safeHttpsUrl } from "@/lib/version"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { Dialog } from "@/components/ui/modal"
import { PortalHost, PortalProvider, PortalScene } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { api, onSessionExpired } from "@/lib/api"
import { fontAssets } from "@/lib/fonts"
import { routeForPushData } from "@/lib/notification-routing"
import { animationDurationForScreen, animationForScreen } from "@/lib/screen-transitions"
import { setupNotifications, subscribeNotificationOpened } from "@/lib/push-notifications"
import { subscribeWebPushMessages } from "@/lib/web-push"
import { ROUTES } from "@/lib/routes"
import { refreshUnreadCount } from "@/lib/unread-count"
import { tokens } from "@/lib/tokens"
import { captureError, installTelemetry, logWarn } from "@/lib/telemetry"
import { consumeOtaUpdateNotice } from "@/lib/ota-notice"
import { translate } from "@/lib/i18n/translate"
import { getLanguage, subscribeLanguage } from "@/lib/i18n/store"
import { AppLockGate } from "@/components/app-lock-gate"
import { useToast } from "@/components/ui/toast"

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

  // Handler global telemetri (unhandled rejection + JS exception) dipasang
  // sekali per proses — idempoten terhadap Hot Reload (D-03).
  useEffect(() => {
    installTelemetry()
  }, [])

  // Web tidak memakai splash/onboarding ala aplikasi: tree langsung
  // dirender (font web ber-FOUT singkat; overlay JS justru terasa situs
  // loading). Native tetap menunggu font siap di balik AnimatedSplash.
  const ready = Platform.OS === "web" || fontsLoaded || fontError != null
  const [splashDone, setSplashDone] = useState(Platform.OS === "web")

  useEffect(() => {
    if (fontError) {
      // Tidak silent: masuk saluran telemetri (dev = console.error, produksi =
      // ring buffer + sink bila terpasang). Tidak melempar error agar app
      // tetap bisa dipakai dengan system font.
      captureError("fonts", fontError)
    }
  }, [fontError])

  // Native splash disembunyikan saat resource siap. Dipanggil dari effect,
  // bukan dari onLayout root view, karena root view yang kita render saat
  // belum ready hanyalah overlay — dan overlay itu sendirilah pengganti splash.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  const handleSplashFinish = useCallback(() => setSplashDone(true), [])

  // Judul dokumen web (audit): expo-router menulis <title> KOSONG sebagai
  // <title> PERTAMA di <head> hasil export statis — browser & mesin pencari
  // memakai <title> pertama, jadi semua tab/hasil pencarian tampil tanpa
  // judul. <Head><title> expo-router tidak membantu di root layout karena
  // Head-nya bergantung useIsFocused() yang selalu false di luar navigator.
  // Set document.title mengisi elemen <title> pertama itu saat app hidup;
  // judul per-halaman (mis. nama order) bisa menimpanya dari layarnya.
  useEffect(() => {
    // Judul DASAR saja. Judul per-layar ditulis oleh <Header> lewat
    // useDocumentTitle() — sebelumnya ini satu-satunya penulisan document.title
    // di app, jadi 98 halaman web berbagi judul tab yang sama.
    if (Platform.OS === "web") document.title = APP_TITLE
  }, [])

  // E-05 (audit): <html lang="id"> statis salah untuk pengguna mode English —
  // screen reader web melafalkan teks EN dengan fonem Indonesia dan SEO
  // kehilangan sinyal bahasa. Output export statis tidak bisa per-bahasa di
  // server, jadi disinkronkan client-side begitu bahasa aktif diketahui/berubah.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return
    const apply = () => {
      document.documentElement.lang = getLanguage()
    }
    apply()
    return subscribeLanguage(apply)
  }, [])

  return (
    <GestureHandlerRootView
      // WAJIB membungkus seluruh tree yang memakai <GestureDetector> (Slider,
      // RangeSlider, BottomSheet). PullToRefresh custom memakai PanResponder
      // RN, bukan GestureDetector. Root ini tetap ditaruh global, bukan
      // per-screen, supaya Portal (BottomSheet) yang dirender di luar layar
      // asalnya tetap berada di dalam root gesture.
      style={{ flex: 1 }}
    >
      {/*
        App tree HANYA di-mount setelah font siap (atau gagal). Ini yang
        mencegah FOUT — bukan sekadar menutupinya dengan overlay.
      */}
      {ready ? (
        // initialPreference bisa diisi dari storage (mis. SecureStore) dan
        // onPreferenceChange dipakai untuk menyimpannya kembali.
        // I18nProvider di LUAR ThemeProvider: teks pada layar splash/penawaran
        // ikut berbahasa benar, dan preferensi bahasa sudah diterapkan sebelum
        // tree app di-render.
        <I18nProvider>
          <ThemeProvider initialPreference="system">
            <AppShell />
          </ThemeProvider>
        </I18nProvider>
      ) : null}

      {/* Overlay JS: pulse loop selama loading, fade-out saat ready, lalu
          unmount. Tidak dirender di web (guest mode, tanpa splash). */}
      {Platform.OS !== "web" && !splashDone ? (
        <AnimatedSplash ready={ready} onFinish={handleSplashFinish} />
      ) : null}
    </GestureHandlerRootView>
  )
}

/** Interval minimum antar pemeriksaan force-update saat kembali foreground (B-10). */
const VERSION_RECHECK_MS = 6 * 60 * 60 * 1000

/**
 * B-09 (audit): pengguna perlu tahu SEBERAPA JAUH versinya tertinggal, bukan
 * hanya ambang minimumnya — `latestVersion` dari server kini ikut disebut.
 */
function forceUpdateDescription(
  detail: { minVersion: string; latestVersion?: string; message?: string | null } | null,
): string {
  const minVersion = detail?.minVersion ?? "yang didukung"
  const latest = detail?.latestVersion
  const target = latest && latest !== detail?.minVersion ? `${latest} (minimum ${minVersion})` : minVersion
  // Teks ini melewati `translate()` (dengan variabel objek, bukan template
  // literal di dalam atribut JSX) supaya kalimatnya ikut terkatalog i18n —
  // generator katalog tidak memindai ekspresi `{...}` pada atribut JSX.
  const base = translate(
    "Versi aplikasi Anda tidak lagi didukung. Silakan perbarui ke versi {x} untuk terus menggunakan Kahade.",
    { x: target },
  )
  return detail?.message ? `${base}\n\n${detail.message}` : base
}

function AppShell() {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const router = useRouter()
  const session = useAuthSession()
  const reducedMotion = useReducedMotion()
  const [skipRestoreError, setSkipRestoreError] = useState(false)

  // Web guest mode: seluruh Stack terdaftar (guard tak pernah mencabut
  // layar), lalu tamu tanpa akun yang membuka layar ber-auth melihat
  // ajakan login sebagai lapisan penuh, bukan redirect paksa. Native
  // tetap memakai guard sesi seperti semula.
  const pathname = usePathname()
  const isWebGuest = Platform.OS === "web" && !session.token
  const guestBlocked = isWebGuest && isProtectedPath(pathname)

  // Satu-satunya tempat yang mendengarkan "sesi habis" dari API client
  // (client.ts memanggil emitSessionExpired saat 401 tak bisa di-refresh).
  // Client tidak boleh import expo-router (arah dependency UI → lib), jadi
  // redirect ke login dipasang di sini, di dalam navigator — Stack sudah
  // ter-mount karena AppShell merendernya.
  //
  // B-03 (audit): subscriber ini SEBELUMNYA tidak pernah ada — emitSessionExpired
  // memanggil ruang kosong, sesi habis tanpa navigasi ke login. Web sengaja
  // tidak di-redirect: token yang hilang sudah memicu guest gate
  // (GuestLoginPrompt) untuk rute terproteksi, dan tamu web memang tidak
  // punya sesi sejak awal (redirect akan menendang mereka dari halaman publik).
  useEffect(() => {
    return onSessionExpired(() => {
      if (Platform.OS === "web") return
      router.replace(ROUTES.login)
    })
  }, [router])

  // Handler foreground + Android channel notification dipasang sekali di
  // boot (idempoten) — channel wajib ada sebelum notifikasi tampil di
  // Android 26+. Pendaftaran token ke backend tetap di Welcome/logout flow.
  useEffect(() => {
    void setupNotifications().catch((err) => {
      if (__DEV__) console.warn("[kahade/push] setupNotification gagal:", err)
    })
  }, [])

  // Pesan FCM Web saat tab terbuka (foreground) + klik notifikasi web.
  // Cermin handler tap native di bawah: pemetaan tunggal
  // lib/notification-routing. "foreground" hanya menyegarkan badge (tanpa
  // navigasi — pengguna sedang memakai app); "tap" menavigasi. Di native,
  // subscribeWebPushMessages adalah no-op (lihat lib/web-push.ts).
  useEffect(() => {
    if (Platform.OS !== "web") return
    if (session.restoring || session.error) return
    return subscribeWebPushMessages((data, source) => {
      if (source === "foreground") {
        if (session.token) void refreshUnreadCount()
        return
      }
      const target = routeForPushData(data) ?? ROUTES.notifications
      router.push(session.token ? target : ROUTES.login)
      if (session.token) void refreshUnreadCount()
    })
  }, [router, session.restoring, session.error, session.token])

  // Tap notifikasi push → buka entitas terkait (order, sengketa, chat, …)
  // lewat pemetaan tunggal lib/notification-routing; tak dikenali → tab
  // Notifikasi. Badge unread disegarkan karena server biasanya menandai
  // notifikasi yang ditap sebagai terbaca. Gate sesi: bila belum login,
  // app/index.tsx & onSessionExpired tetap mengarahkan ke login.
  useEffect(() => {
    if (session.restoring || session.error) return
    return subscribeNotificationOpened((data, source) => {
      const resolved = routeForPushData(data)
      // Cold start: hanya navigasi bila payload menunjuk entitas SPESIFIK.
      // Payload kosong/tak dikenal = tetap di Beranda (initial route) —
      // fallback ke Notifikasi di sini membuat setiap cold start mendarat
      // di tab yang salah. Tap saat app hidup tetap jatuh ke Notifikasi
      // karena niat penggunanya jelas (mereka mengetuk notifikasinya).
      if (source === "cold-start" && !resolved) return
      const target = resolved ?? ROUTES.notifications
      router.push(session.token ? target : ROUTES.login)
      if (session.token) void refreshUnreadCount()
    })
  }, [router, session.restoring, session.error, session.token])

  // OTA gate: cek versi minimum dari GET /v1/public/app-version (hanya
  // force-update bila versi lokal < minVersion). Tidak boleh melempar error:
  // jaringan gagal → lanjut pakai versi lokal (update tidak wajib synchronous).
  const [versionCheck, setVersionCheck] = useState(0)
  // B-10 (audit): app yang hidup berhari-hari di background tidak pernah tahu
  // versi minimum naik — cek ulang saat kembali foreground, dibatasi 6 jam
  // agar tidak menembak endpoint tiap buka-tutup app.
  const lastVersionCheckAt = useRef(Date.now())
  const [forceUpdate, setForceUpdate] = useState<{
    minVersion: string
    latestVersion?: string
    message?: string | null
    /** B-09 (audit): `web` ikut — normalizer sudah membacanya (storeUrl.web). */
    storeUrl?: { ios?: string; android?: string; web?: string } | null
  } | null>(null)

  useEffect(() => {
    /**
     * B-09 (audit): pemeriksaan versi juga berjalan di WEB.
     *
     * `/v1/public/app-version` mengembalikan nilai per platform (termasuk
     * `web`, lihat `normalizeAppVersion`) — sebelumnya cabang `Platform.OS
     * === "web"` membuat bundle web basi tidak pernah ketahuan selain lewat
     * notifikasi service worker. `installedAppVersion()` di web membaca versi
     * bundle yang SEDANG berjalan, jadi perbandingannya tetap bermakna.
     */
    lastVersionCheckAt.current = Date.now()
    const appVersion = installedAppVersion()
    let alive = true
    api.public
      .getAppVersion()
      .then((v) => {
        // Bandingkan SEKALI dan simpan hasilnya: sebelumnya compareVersions
        // dipanggil dua-tiga kali per respons (termasuk non-null assertion)
        // untuk keputusan yang sama — boros dan rawan salah ketik saat
        // diubah. `null` (data versi tidak valid) tidak pernah memaksa
        // update maupun membersihkan dialog yang sudah tampil.
        const minVersion = v.minVersion
        // minVersion hilang/tidak valid → jangan paksa update DAN jangan
        // menutup dialog yang sudah tampil (perilaku sebelumnya).
        if (!alive || typeof minVersion !== "string") return
        const comparison = compareVersions(appVersion, minVersion)
        if (comparison === null) return
        if (comparison === -1)
          setForceUpdate({ ...v, minVersion, latestVersion: v.latestVersion })
        else setForceUpdate(null)
      })
      .catch(() => {
        // A failed minimum-version check never blocks offline access.
      })
    return () => {
      alive = false
    }
  }, [versionCheck])

  useEffect(() => {
    if (Platform.OS === "web") return
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return
      if (Date.now() - lastVersionCheckAt.current < VERSION_RECHECK_MS) return
      setVersionCheck((value) => value + 1)
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    // B-09 (audit): web tidak punya AppState — `visibilitychange` adalah
    // padanannya untuk tab/PWA yang dibiarkan terbuka lama. Ambang waktu yang
    // sama (VERSION_RECHECK_MS) dipakai agar tab yang dibuka-tutup tidak
    // menembak endpoint ini terus-menerus.
    if (Platform.OS !== "web" || typeof document === "undefined") return
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastVersionCheckAt.current < VERSION_RECHECK_MS) return
      setVersionCheck((value) => value + 1)
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  /**
   * B-09 (audit): `storeUrl.web` ikut dibaca — sebelumnya web selalu memakai
   * tautan Android (satu-satunya cabang non-iOS).
   */
  const storeUrl = safeHttpsUrl(
    forceUpdate?.storeUrl
      ? Platform.OS === "ios"
        ? forceUpdate.storeUrl.ios
        : Platform.OS === "android"
          ? forceUpdate.storeUrl.android
          : forceUpdate.storeUrl.web
      : undefined,
  )
  /** Di web versi terbaru selalu berjarak satu reload (dokumen network-first). */
  const reloadWebApp = () => {
    if (typeof window !== "undefined") window.location.reload()
  }

  return (
    // PortalProvider + ToastProvider HARUS di dalam ThemeProvider (kita sudah
    // di dalamnya — AppShell dirender oleh ThemeProvider) agar overlay yang
    // diteleport (BottomSheet, Modal, Banner, Tooltip, SearchOverlay,
    // LoadingScreen) dan Toast tetap menerima CSS variable dari vars().
    // Tanpa provider ini, setiap komponen overlay melempar error saat mount.
    <PortalProvider>
      <ToastProvider>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        {/* Pemberitahuan global non-blocking (OTA baru termuat, SW web baru) —
            harus DI DALAM ToastProvider, di luar Stack. */}
        <GlobalNotices />

        {/*
          Ajakan pasang aplikasi untuk pengunjung web seluler dulu berupa kartu
          mengalir (<SmartAppInstallCard>) di Beranda — Beranda dihapus, jadi
          kartu itu ikut ditarik; pintu pasang kini hanya metadata PWA.
        */}

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
        {/* J-04 (audit): aksi uang menggantung (QRIS/top-up/withdraw OTP)
            ditawarkan lagi di boot, di tab mana pun — catatan di
            lib/pending-actions, resolve di layar uangnya. */}
        <PendingActionsBanner />
        <View className="flex-1 items-center">
          <ContentContainer bordered>
            <PortalScene>
              {session.restoring ? (
                <View className="px-5">
                  <ListLoading />
                </View>
              ) : session.error && !skipRestoreError ? (
                <View className="flex-1 px-5">
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
                  {/* Web: guard selalu true (semua layar terdaftar);
                      pemblokiran tamu ditangani GuestLoginPrompt di bawah. */}
                  <Stack.Protected
                    guard={Platform.OS === "web" ? true : Boolean(session.token)}
                  >
                    {AUTHENTICATED_SCREENS.map((name) => (
                      <Stack.Screen
                        key={name}
                        name={name}
                        options={{
                          // v2: push vs modal-like vs list→detail (lib/screen-transitions).
                          animation: animationForScreen(name, reducedMotion),
                          animationDuration: animationDurationForScreen(),
                        }}
                      />
                    ))}
                  </Stack.Protected>
                </Stack>
              )}
              {/* Tamu web membuka layar ber-auth → ajakan login penuh di
                  atas layar (Stack tetap terpasang di baliknya). */}
              {guestBlocked ? (
                <View className="absolute inset-0 bg-background">
                  <GuestLoginPrompt next={pathname} />
                </View>
              ) : null}
            </PortalScene>
            <PortalHost />
          </ContentContainer>
          {/* A-04 (audit): kunci aplikasi (§14 re-auth setelah background >1
              menit). Dirender SETELAH konten agar menutupi seluruh tree saat
              terkunci; no-op di web dan tanpa sesi. */}
          {Platform.OS !== "web" ? <AppLockGate sessionActive={Boolean(session.token)} /> : null}
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
        description={forceUpdateDescription(forceUpdate)}
        visible={!!forceUpdate}
        hideCancel
        confirmLabel={storeUrl ? "Buka Toko Aplikasi" : Platform.OS === "web" ? "Muat ulang halaman" : "Periksa kembali"}
        onConfirm={() => {
          if (!storeUrl && Platform.OS === "web") {
            // B-09 (audit): tanpa tautan toko, aksi yang benar-benar memulihkan
            // pengguna web adalah memuat ulang dokumen (bundle terbaru), bukan
            // memeriksa ulang versi yang sama.
            reloadWebApp()
            return
          }
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

/**
 * Pemberitahuan global sekali-jalan (F-14 OTA + I-06 PWA).
 *
 * - OTA (native): bundle baru terdeteksi lewat `consumeOtaUpdateNotice()` →
 *   toast informatif sekali per update. Pengguna tidak lagi melihat perubahan
 *   mendadak tanpa penjelasan.
 * - PWA (web): service worker baru mengambil alih (skipWaiting) → event
 *   `kahade:sw-updated` dari register-sw.js → toast ajakan memuat ulang.
 *   Dokumen network-first + aset cache-first berarti sesi yang sedang berjalan
 *   bisa mencampur bundle lama/baru; reload adalah pemulihannya.
 */
function GlobalNotices() {
  const toast = useToast()
  const showToast = toast.show

  useEffect(() => {
    if (Platform.OS === "web") return
    consumeOtaUpdateNotice()
      .then((notice) => {
        if (!notice) return
        showToast({
          title: "Aplikasi baru saja diperbarui",
          description: "Perubahan terbaru sudah aktif di perangkat Anda.",
          tone: "info",
          duration: 6000,
        })
      })
      .catch((err) => logWarn("ota:notice", err))
  }, [showToast])

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return
    const onUpdated = () => {
      showToast({
        title: "Versi baru Kahade tersedia",
        description: "Muat ulang halaman untuk memakai versi terbaru.",
        tone: "info",
        duration: 10000,
      })
    }
    window.addEventListener("kahade:sw-updated", onUpdated)
    return () => window.removeEventListener("kahade:sw-updated", onUpdated)
  }, [showToast])

  return null
}
