/**
 * Kahade — Expo Router root layout.
 *
 * Tanggung jawab file ini (urutan boot):
 *   1. Tahan native splash (preventAutoHideAsync) — dipanggil di module scope,
 *      SEBELUM komponen mount / font mulai load, sesuai docs expo-splash-screen.
 *   2. Load SEMUA font offline via expo-font `useFonts(fontAssetsBlocking)`.
 *      REVISI 2026-09-30 (keputusan kualitas user): split lazy ST-003 + FE-073
 *      (SemiBold/Bold/AzeretMono/EBGaramond lazy setelah first paint)
 *      DIHAPUS — heading yang "melompat" (FOUT) saat font lazy-load
 *      memperparah keluhan "teks ga enak dilihat". Semua file di-bundle
 *      lokal (<1MB total); splash menunggu semua, tanpa FOUT.
 *      Key = nama di `fontFamilyByWeight`/`fontFamilyItalicByWeight`
 *      (dijamin oleh `satisfies` di fonts.ts).
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
 *
 * ST-001 — BATASAN JUJUR asyncRoutes (PERF-FIX 2026-09-29):
 * `app.json` memakai `"asyncRoutes": { "web": "production", "default": false }`.
 * Klaim "asyncRoutes" HANYA berlaku untuk WEB production: di sana expo-router
 * memecah bundle per rute (chunk terpisah, payload awal menyusut). Di NATIVE,
 * pemisahan file TIDAK TERJADI — by design, "Native production builds still
 * load routes synchronously" (docs Expo
 * https://docs.expo.dev/router/web/async-routes/): artefak native tetap satu
 * file .hbc (~10.1MB) dan semua modul rute dievaluasi saat boot.
 * Penghematan native dicapai lewat PENUNDAAN EVALUASI modul, bukan pemisahan
 * file: ST-003 (font non-kritis), ST-004 (konten legal via dynamic import),
 * ST-005 (socket.io lazy), ST-009 (init setelah first paint + lazy di bawah),
 * dan pola "thin shell + React.lazy" untuk layar berat di luar tab utama
 * (contoh: app/scan.tsx → components/scan-screen.tsx).
 * Code-splitting file-level di native = DEFERRED-BY-DESIGN: tidak didukung
 * Expo Router; menunggu dukungan resmi Expo (bukan sesuatu yang bisa
 * di-fix dari sisi aplikasi).
 */
import "../global.css"

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AppState, BackHandler, Linking, Platform, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import Reanimated, { useAnimatedStyle } from "react-native-reanimated"
import { Stack, useGlobalSearchParams, usePathname, useRouter, type Href } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as SplashScreen from "expo-splash-screen"
import { useFonts, loadAsync as loadFontsAsync } from "expo-font"
import { installedAppVersion } from "@/lib/runtime-info"

import { I18nProvider } from "@/components/i18n-provider"
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { AnimatedSplash } from "@/components/ui/animated-splash"
import { ContentContainer } from "@/components/ui/content-container"
// PERF-FIX (bundle): APP_TITLE dari leaf module `@/lib/app-meta` (tanpa
// import) — bukan dari `@/components/ui/header` yang menarik ~10 modul UI.
import { APP_TITLE } from "@/lib/app-meta"
import { ListLoading } from "@/components/ui/paginated-list"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useAuthSession } from "@/lib/use-auth-session"
import { RealtimeProvider } from "@/lib/realtime/socket-provider"
import { RealtimeGlobalListeners } from "@/components/realtime-global-listeners"
import { PendingActionsBanner } from "@/components/pending-actions-banner"
import { MaintenanceGate } from "@/components/maintenance-screen"
import {
  AUTHENTICATED_SCREENS,
  isNativeGuardedPath,
  isPreSessionAuthPath,
  isProtectedPath,
} from "@/lib/protected-routes"
// ST-009 (PERF-FIX 2026-09-29): <GuestLoginPrompt> hanya dirender untuk
// tamu WEB di rute terproteksi (bukan first paint) — dimuat lazy agar
// modulnya (+ empty-state, screen) tidak dievaluasi saat boot dan tidak
// masuk chunk entry web. Dipakai juga oleh layar-layar tab via import
// statis mereka sendiri; yang di sini hanya menunda jalur root layout.
const GuestLoginPrompt = lazy(() =>
  import("@/components/web-guest-gate").then((m) => ({
    default: m.GuestLoginPrompt,
  })),
)
import { compareVersions, safeHttpsUrl } from "@/lib/version"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { Dialog } from "@/components/ui/modal"
import { PortalHost, PortalProvider, PortalScene } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { DeviceIntegrityProvider } from "@/components/security/device-integrity-provider"
// PERF-FIX (bundle): import domain langsung, bukan barrel `@/lib/api`
// (±35 domain, ~700KB + rantai expo-image-picker) — root layout dievaluasi
// paling awal saat boot. Preseden: components/maintenance-screen.tsx:18.
import * as notificationsApi from "@/lib/api/notifications"
import * as publicApi from "@/lib/api/public"
import { onSessionExpired } from "@/lib/api/session"
import { fontAssetsBlocking, fontAssetsDeferred } from "@/lib/fonts"
import { routeForPushData } from "@/lib/notification-routing"
import { saveLastNativeRoute, suppressLastRouteRestore } from "@/lib/last-route"
import { animationDurationForScreen, animationForScreen, getScreenId } from "@/lib/screen-transitions"
import { setupNotifications, subscribeNotificationOpened } from "@/lib/push-notifications"
// PERF-FIX (bundle, 2026-09-30): `expo-notifications` (±1.6MB) kini dimuat
// LAZY di dalam `lib/push-notifications.ts` (loadNotifications) — import
// statis modul ini sudah murah dan tidak lagi menarik modul native saat
// boot. `subscribeNotificationOpened` tetap dipasang di efek boot segera;
// tap cold-start tetap terbaca via getLastNotificationResponseAsync()
// (respons di-cache di level OS). `setupNotifications`-nya sendiri sudah
// ditunda via afterFirstPaint di bawah.
// ST-009 (PERF-FIX 2026-09-29): `@/lib/web-push` SENGAJA tidak diimpor
// statis. Varian web-nya (`lib/web-push.web.ts`) menarik `firebase/app` +
// `firebase/messaging` yang berat ke chunk entry web; ia dimuat via dynamic
// import di efek web di bawah (hanya berjalan di web). Di native, stub
// `lib/web-push.ts` pun ditunda evaluasinya sampai efek berjalan.
import {
  CONFIRM_RECEIPT_ACTION,
  confirmReceipt,
  orderIdFromPushData,
} from "@/lib/order-confirm"
import { userMessage } from "@/lib/api/errors"
import { setPendingNext } from "@/lib/login-redirect"
import { initConnectivity } from "@/lib/connectivity"
import { initOtpFlow } from "@/lib/otp-flow"
import {
  initOfflineQueue,
  onSocialActionQueued,
  onSocialQueueDrained,
} from "@/lib/offline-queue"
import { OfflineBanner } from "@/components/offline-banner"
import { ROUTES } from "@/lib/routes"
import { refreshUnreadCount } from "@/lib/unread-count"
import { tokens } from "@/lib/tokens"
import { captureError, installTelemetry, logWarn } from "@/lib/telemetry"
import { installSentrySink } from "@/lib/telemetry-sentry"
import { consumeOtaUpdateNotice } from "@/lib/ota-notice"
import { translate } from "@/lib/i18n/translate"
import { getLanguage, subscribeLanguage } from "@/lib/i18n/store"
// PERF-FIX (bundle, pola FE-075): AppLockGate menarik expo-local-authentication
// + pin-input + phosphor + expo-haptics — dievaluasi saat boot untuk SEMUA
// pengguna padahal no-op tanpa sesi. Lazy + latch: import dimulai hanya saat
// sesi pertama ada.
const AppLockGate = lazy(() =>
  import("@/components/app-lock-gate").then((m) => ({ default: m.AppLockGate })),
)
import { ShellTabBar, isShellTabPath } from "@/components/ui/shell-tab-bar"
import { popPreviousShellTab, rememberShellTabVisit, resetShellTabHistory } from "@/lib/shell-tabs"
// FE-075: drawer & sheet dimuat LAZY — modul beratnya (beserta seluruh
// subtree importnya) baru diunduh/dieksekusi saat pertama dibutuhkan, bukan
// saat boot. `lazy` SAJA tidak cukup bila komponen tetap dirender langsung
// (import dimulai saat boot) — render di bawah di-gate oleh latch
// `drawerNeeded`/`createSheetNeeded`.
const AppDrawer = lazy(() =>
  import("@/components/ui/app-drawer").then((m) => ({ default: m.AppDrawer })),
)
const CreateSheet = lazy(() =>
  import("@/components/ui/create-sheet").then((m) => ({ default: m.CreateSheet })),
)
import { drawerProgress, useDrawerOpen } from "@/lib/drawer"
import { useCreateSheetOpen } from "@/lib/create-sheet"
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

/**
 * ST-009 (PERF-FIX 2026-09-29): jalankan callback SETELAH first paint.
 * Init berat (pembuatan channel notifikasi Android, restore + replay antrean
 * offline) tidak dibutuhkan sebelum frame pertama ter-commit — menundanya
 * satu frame mencegah init mencuri waktu render pertama. requestAnimationFrame
 * di native terpicu setelah frame ter-render; fallback setTimeout untuk
 * web/edge-case. Kembalikan fungsi pembatal.
 */
function afterFirstPaint(cb: () => void): () => void {
  let raf = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = () => {
    timer = setTimeout(cb, 0)
  }
  if (typeof requestAnimationFrame === "function") {
    raf = requestAnimationFrame(run)
  } else {
    run()
  }
  return () => {
    if (raf) cancelAnimationFrame(raf)
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * NAV-007: ubah Href (string ATAU objek expo-router) menjadi path konkret
 * untuk `pendingNext`. Template segmen dinamis ("/order/[id]") disubstitusi
 * dari `params`; bila ada segmen yang tak terisi → null (login redirect
 * tidak boleh mendarat di 404).
 *
 * PERF-FIX (P2 nav): hasil di-cache per href+params — fungsi ini dipanggil di
 * jalur panas tap notifikasi; regex substitusi tidak perlu diulang untuk
 * input yang sama.
 */
// PERF-FIX (P2 nav): cache konkretisasi href — regex + encodeURIComponent
// tidak diulang untuk href objek identik yang muncul di tiap render (deep
// link guard, pending-next login, dsb). Map.has dipakai agar hasil `null`
// yang valid ikut ter-cache.
const concretePathCache = new Map<string, string | null>()
function hrefToConcretePath(href: Href): string | null {
  const cacheKey =
    typeof href === "string"
      ? `s:${href}`
      : `o:${(href as { pathname?: unknown }).pathname ?? ""}:${JSON.stringify((href as { params?: unknown }).params ?? {})}`
  const cached = concretePathCache.get(cacheKey)
  if (cached !== undefined) return cached
  const result = hrefToConcretePathUncached(href)
  // Batas kecil: jumlah href unik di jalur notifikasi terbatas.
  if (concretePathCache.size > 100) concretePathCache.clear()
  concretePathCache.set(cacheKey, result)
  return result
}

function hrefToConcretePathUncached(href: Href): string | null {
  if (typeof href === "string") return href || null
  const obj = href as { pathname?: unknown; params?: unknown }
  if (typeof obj.pathname !== "string" || !obj.pathname) return null
  const params =
    obj.params != null && typeof obj.params === "object"
      ? (obj.params as Record<string, unknown>)
      : {}
  const cacheKey = `${obj.pathname}|${JSON.stringify(params)}`
  if (concretePathCache.has(cacheKey)) return concretePathCache.get(cacheKey) ?? null
  const path = obj.pathname.replace(/\[([^\]/]+)\]/g, (_m, key: string) => {
    const value = params[key]
    return typeof value === "string" || typeof value === "number"
      ? encodeURIComponent(String(value))
      : ""
  })
  // Segmen dinamis tersisa (mis. catch-all) = tidak bisa dikonkretkan.
  if (path.includes("[") || path.includes("]")) {
    concretePathCache.set(cacheKey, null)
    return null
  }
  concretePathCache.set(cacheKey, path)
  return path
}

export default function RootLayout() {
  // REVISI 2026-09-30: SEMUA font blocking (keputusan kualitas user — lihat
  // komentar di lib/fonts.ts). Splash menunggu sampai semua siap: tanpa FOUT.
  const [fontsLoaded, fontError] = useFonts(fontAssetsBlocking)

  // Handler global telemetri (unhandled rejection + JS exception) dipasang
  // sekali per proses — idempoten terhadap Hot Reload (D-03).
  useEffect(() => {
    installTelemetry()
    // G476: sink produksi — default aman (tanpa DSN tidak mengirim apa pun).
    installSentrySink()
  }, [])

  // Pulihkan state alur OTP dari SecureStore (tahan restart di tengah alur —
  // mis. user pindah ke WhatsApp lalu OS mematikan aplikasi di background).
  // Dijalankan paralel dengan font loading; `ready` menunggu keduanya agar
  // layar whatsapp-trigger/verify-otp tidak mount dengan state kosong.
  const [otpFlowReady, setOtpFlowReady] = useState(false)
  useEffect(() => {
    let alive = true
    void initOtpFlow()
      .catch(() => {})
      .finally(() => {
        if (alive) setOtpFlowReady(true)
      })
    return () => {
      alive = false
    }
  }, [])

  // Web tidak memakai splash/onboarding ala aplikasi: tree langsung
  // dirender (font web ber-FOUT singkat; overlay JS justru terasa situs
  // loading). Native tetap menunggu font siap di balik AnimatedSplash.
  // otpFlowReady: jangan render rute sampai state alur OTP dipulihkan —
  // mencegah layar whatsapp-trigger/verify-otp mount dengan state kosong
  // (layar putih) setelah restart di tengah alur.
  const ready =
    (Platform.OS === "web" || fontsLoaded || fontError != null) && otpFlowReady
  const [splashDone, setSplashDone] = useState(Platform.OS === "web")

  // REVISI 2026-09-30: tidak ada lagi font lazy — `fontAssetsDeferred`
  // kini peta kosong (dipertahankan agar call-site tidak berubah).
  // loadAsync({}) resolve seketika; blok dipertahankan sebagai no-op yang
  // aman bila di masa depan ada lagi font non-kritis.
  useEffect(() => {
    if (!ready) return
    let alive = true
    void loadFontsAsync(fontAssetsDeferred)
      .then(() => {
        if (__DEV__ && alive) console.debug("[kahade/fonts] deferred fonts loaded")
      })
      .catch((err: unknown) => {
        if (alive) captureError("fonts:deferred", err)
      })
    return () => {
      alive = false
    }
  }, [ready])

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

/** Route subscriptions are isolated from the providers and native Stack. */
function GuestRouteOverlay({ token }: { token: string | null }) {
  const pathname = usePathname()
  if (Platform.OS !== "web" || token || !isProtectedPath(pathname)) return null
  return (
    <View className="absolute inset-0 bg-background">
      <Suspense fallback={null}><GuestLoginPrompt next={pathname} /></Suspense>
    </View>
  )
}

function ShellRouteEffects({ session, setRealtimeNeeded }: {
  session: ReturnType<typeof useAuthSession>
  setRealtimeNeeded: (needed: boolean) => void
}) {
  const router = useRouter()
  // Web guest mode: seluruh Stack terdaftar (guard tak pernah mencabut
  // layar), lalu tamu tanpa akun yang membuka layar ber-auth melihat
  // ajakan login sebagai lapisan penuh, bukan redirect paksa. Native
  // tetap memakai guard sesi seperti semula.
  const pathname = usePathname()
  const previousSessionToken = useRef(session.token)

  useEffect(() => {
    rememberShellTabVisit(pathname)
  }, [pathname])

  useEffect(() => {
    if (previousSessionToken.current && !session.token) resetShellTabHistory()
    previousSessionToken.current = session.token
  }, [session.token])

  // Android Back on a tab follows visit order, not the navigator's tab stack.
  // With no previous tab, explicitly use the normal OS exit affordance so the
  // handler can never trap the user on the first tab.
  useEffect(() => {
    if (Platform.OS !== "android") return
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!isShellTabPath(pathname)) return false
      const previousTab = popPreviousShellTab(pathname)
      if (previousTab) {
        router.navigate(previousTab.href as never)
        return true
      }
      BackHandler.exitApp()
      return true
    })
    return () => subscription.remove()
  }, [pathname, router])

  // FE-074: koneksi socket realtime DITUNDA sampai kebutuhan chat pertama.
  // Provider TETAP mount (layar chat mengandalkan context), tapi token hanya
  // diteruskan setelah pengguna masuk tab/room chat (`/chat*`). Latch tetap
  // aktif untuk sisa sesi; reset saat logout. Cold start pengguna login tidak
  // lagi membuka socket — push foreground sudah menginvalidasi cache query,
  // jadi data tetap segar tanpa socket di boot.
  useEffect(() => {
    if (!session.token) {
      setRealtimeNeeded(false)
      return
    }
    if (pathname === "/chat" || pathname.startsWith("/chat/")) setRealtimeNeeded(true)
  }, [pathname, session.token])

  // Resume the last safe screen after the OS kills the process. The route
  // store contains pathname only (no query data) and is cleared on logout.
  useEffect(() => {
    if (Platform.OS === "web" || !session.token || session.restoring) return
    void saveLastNativeRoute(pathname).catch((error) => logWarn("navigation:last-route", error))
  }, [pathname, session.token, session.restoring])

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
  //
  // AUT-007: tetapi "tidak di-redirect" JANGAN berarti "diam total" — bila
  // pengguna web MEMANG punya sesi yang baru kedaluwarsa, tampilkan modal
  // "Sesi berakhir, silakan masuk kembali" + tombol Masuk. Tamu tanpa sesi
  // (hadSessionRef false) tidak diganggu: GuestLoginPrompt tetap yang
  // menangani mereka per B-03.
  const hadSessionRef = useRef(false)
  const [webSessionExpired, setWebSessionExpired] = useState(false)
  // `next` saat modal "Sesi berakhir" (web) ditekan — disimpan di ref karena
  // onConfirm berjalan belakangan, bukan saat event kedaluwarsa.
  const webExpiredNextRef = useRef<string | null>(null)
  useEffect(() => {
    if (session.token) hadSessionRef.current = true
  }, [session.token])

  // UX-NAV-009: `next` dibangun dari pathname + query string (mis.
  // /order/123?tab=milestones), bukan pathname saja — deep link yang lewat
  // login tidak boleh kehilangan konteks tab/filter. Param rute dinamis
  // (mis. id) ikut terserialisasi sebagai query — diabaikan layar tujuan
  // yang membaca param rutenya sendiri, jadi tidak merusak apa pun.
  // Pintu masuk auth dikecualikan agar tak terbentuk loop login → login.
  const searchParams = useGlobalSearchParams()
  const buildNext = useCallback((): string | null => {
    if (pathname === "/login" || pathname === "/login-required") return null
    const parts: string[] = []
    for (const [key, value] of Object.entries(searchParams)) {
      if (value == null) continue
      const values = Array.isArray(value) ? value : [value]
      for (const v of values) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
    }
    return parts.length > 0 ? `${pathname}?${parts.join("&")}` : pathname
  }, [pathname, searchParams])

  // Mengalihkan ke /login dengan membawa `next` (bila ada) — dipakai baik
  // oleh handler sesi-kedaluwarsa (UX-NAV-001) maupun guard deep-link
  // NAV-007 di bawah, supaya polanya konsisten.
  const redirectToLoginWithNext = useCallback(
    (next: string | null) => {
      if (next) {
        setPendingNext(next)
        // Literal "/login" (= ROUTES.login): bentuk objek `as const` butuh
        // pathname literal agar lolos tipe Href expo-router.
        router.replace({ pathname: "/login", params: { next } } as const)
      } else {
        router.replace(ROUTES.login)
      }
    },
    [router],
  )

  useEffect(() => {
    return onSessionExpired(() => {
      // UX-NAV-001: sesi kedaluwarsa di tengah tugas (mis. mengisi form
      // sengketa) — SIMPAN tujuan dulu, konsisten dengan guard NAV-007 di
      // bawah, supaya login ulang kembali ke konteks semula, bukan Beranda.
      const rawNext = buildNext()
      /**
       * AUDIT 2026-10-01 (layar blank setelah trigger WhatsApp) — dua pagar:
       *
       * 1. `next` TIDAK PERNAH boleh menunjuk halaman pra-sesi
       *    (/verify-otp, /whatsapp-trigger, /register, …). Setelah login,
       *    `next` itu mendarat kembali di layar OTP tanpa state alur (state
       *    alur ada di memori/SecureStore, bukan query param) → layar kosong.
       * 2. `emitSessionExpired()` menyala juga untuk pengguna yang memang
       *    BELUM punya sesi (refresh token tidak ada → 401 dari endpoint
       *    refresh). Itu bukan "sesi berakhir" — jangan tendang pengguna dari
       *    alur pra-sesi yang sedang ia kerjakan. Redirect hanya bila di
       *    proses ini memang pernah ada sesi, ATAU pengguna berada di rute
       *    yang di-guard sesi (NAV-007 menangani deep link dari logout).
       */
      const next = rawNext && isPreSessionAuthPath(rawNext) ? null : rawNext
      if (Platform.OS === "web") {
        if (hadSessionRef.current) {
          webExpiredNextRef.current = next
          setWebSessionExpired(true)
        }
        return
      }
      if (!hadSessionRef.current && !isNativeGuardedPath(pathname)) return
      redirectToLoginWithNext(next)
    })
  }, [router, buildNext, redirectToLoginWithNext, pathname])

  // NAV-007 (2026-09-28): deep link native ke rute proteksi saat logout
  // (mis. kahade.id/order/xxx dari share WA → dibuka aplikasi via universal
  // link) mendarat di layar KOSONG — `Stack.Protected` mencabut layarnya dari
  // navigator tanpa fallback. Alihkan ke /login dengan tujuan tersimpan
  // (`next` + setPendingNext) supaya alur login/welcome melanjutkannya.
  // Web dikecualikan: guard web selalu true + GuestLoginPrompt menangani tamu.
  const redirectedDeepLink = useRef(false)
  useEffect(() => {
    if (Platform.OS === "web") return
    // Reset: sesi pulih ATAU sudah di rute publik → logout berikutnya dalam
    // proses yang sama boleh mengalihkan lagi (tanpa ini, deep link kedua
    // setelah login–logout mendarat di layar kosong lagi).
    if (session.token || !isNativeGuardedPath(pathname)) {
      redirectedDeepLink.current = false
      return
    }
    if (redirectedDeepLink.current) return
    if (session.restoring || session.error) return
    redirectedDeepLink.current = true
    // UX-NAV-009: bawa query string dalam `next` (buildNext), bukan cuma
    // pathname — deep link /order/123?tab=milestones tetap mendarat di tab
    // yang dibagikan setelah login.
    redirectToLoginWithNext(buildNext())
  }, [router, session.restoring, session.error, session.token, pathname, buildNext, redirectToLoginWithNext])

  return (
      <Dialog
        title="Sesi berakhir"
        description="Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan."
        visible={webSessionExpired}
        hideCancel
        confirmLabel="Masuk"
        onConfirm={() => {
          setWebSessionExpired(false)
          hadSessionRef.current = false
          // UX-NAV-001 (web): bawa tujuan yang tersimpan saat sesi berakhir
          // supaya login ulang kembali ke tugas semula, bukan Beranda.
          const next = webExpiredNextRef.current
          webExpiredNextRef.current = null
          redirectToLoginWithNext(next)
        }}
        onRequestClose={() => undefined}
        destructive={false}
      />
  )
}

function AppShellInner() {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const router = useRouter()
  const session = useAuthSession()
  const reducedMotion = useReducedMotion()
  const stackScreenOptions = useMemo(() => ({
    headerShown: false,
    contentStyle: { backgroundColor: palette.background },
    animation: reducedMotion ? "none" as const : "slide_from_right" as const,
    animationDuration: tokens.motion.duration.base,
  }), [palette.background, reducedMotion])

  const [skipRestoreError, setSkipRestoreError] = useState(false)
  // Dipakai oleh efek item #24/#27 di bawah (push action + antrean offline).
  const toast = useToast()

  // FE-075: latch "pernah dibutuhkan" untuk drawer & sheet. Store
  // (useDrawerOpen/useCreateSheetOpen) ringan — langganan ini tidak memicu
  // import modul berat. Saat store pertama dibuka, latch memasang komponen
  // lazy (import dimulai); setelah itu komponen tetap mount agar animasi
  // penutupan tidak terpotong dan buka-berikutnya instan.
  const drawerOpen = useDrawerOpen()
  const createSheetOpen = useCreateSheetOpen()
  const [drawerNeeded, setDrawerNeeded] = useState(false)
  const [createSheetNeeded, setCreateSheetNeeded] = useState(false)
  // PERF-FIX (bundle): latch yang sama untuk AppLockGate — gate no-op tanpa
  // sesi, jadi import modulnya (expo-local-authentication dkk) ditunda
  // sampai sesi pertama ada. Setelah latch, tetap mount agar kunci setelah
  // background >1 menit tetap menutupi seluruh tree.
  const [lockGateNeeded, setLockGateNeeded] = useState(false)
  useEffect(() => {
    if (drawerOpen) setDrawerNeeded(true)
  }, [drawerOpen])
  useEffect(() => {
    if (createSheetOpen) setCreateSheetNeeded(true)
  }, [createSheetOpen])
  useEffect(() => {
    if (session.token) setLockGateNeeded(true)
  }, [session.token])

  // PERF-FIX (P2 nav): memoize daftar Stack.Screen (~100 entri) agar tidak
  // dihitung ulang tiap render AppShellInner. getId untuk rute dinamis
  // mencegah penumpukan instance (A→B→A); durasi animasi adaptif untuk
  // layar berat (thin shell + lazy).
  const authenticatedScreens = useMemo(
    () =>
      AUTHENTICATED_SCREENS.map((name) => (
        <Stack.Screen
          key={name}
          name={name}
          getId={getScreenId(name)}
          options={{
            // v2: push vs modal-like vs list→detail (lib/screen-transitions).
            animation: animationForScreen(name, reducedMotion),
            animationDuration: animationDurationForScreen(name),
          }}
        />
      )),
    [reducedMotion],
  )

  // Efek dorong konten ala X saat drawer dibuka (2026-09-27): konten sedikit
  // bergeser kanan + mengecil dengan sudut membulat, mengikuti progress
  // animasi drawer (`drawerProgress`). Reduced motion: tanpa transform.
  const drawerContentStyle = useAnimatedStyle(() => {
    "worklet"
    if (reducedMotion) return {}
    const p = drawerProgress.value
    return {
      transform: [{ translateX: p * 48 }, { scale: 1 - p * 0.05 }],
      borderRadius: p * 24,
      overflow: "hidden" as const,
    }
  }, [reducedMotion])

  const [realtimeNeeded, setRealtimeNeeded] = useState(false)

  // ST-009: handler foreground + Android channel dipasang setelah first
  // paint (idempoten) — channel wajib ada sebelum notifikasi tampil di
  // Android 26+, tetapi tidak dibutuhkan untuk me-render frame pertama.
  // Cold-start tap TIDAK ditunda: subscribeNotificationOpened (di bawah)
  // tetap langsung, agar tap notifikasi yang meluncurkan app tidak terlewat.
  useEffect(() => {
    const cancel = afterFirstPaint(() => {
      void setupNotifications().catch((err) => {
        if (__DEV__) console.warn("[kahade/push] setupNotification gagal:", err)
      })
    })
    return cancel
  }, [])

  // Item #27 — konektivitas & antrean offline, sekali per proses:
  //   - `initConnectivity()`: satu langganan NetInfo; gerbang fail-closed di
  //     transport menolak mutasi non-sosial saat jelas offline.
  //   - `initOfflineQueue()`: pulihkan sisa antrean + eksekusi saat reconnect.
  //   - Feedback toast untuk kedua arah antrean (masuk & terkirim).
  useEffect(() => {
    // PERF-FIX (bundle, 2026-09-30): `initConnectivity()` ikut ditunda
    // setelah first paint seperti `initOfflineQueue()`. `NetInfo.fetch()`
    // pertama di Android dapat menempati JS thread 50–200ms dan berkompetisi
    // dengan render pertama. Jendela satu frame tanpa langganan NetInfo aman:
    // gerbang fail-closed transport default "online" sampai status pasti
    // diketahui (perilaku yang sama seperti sebelum init dipanggil).
    const cancelDeferred = afterFirstPaint(() => {
      initConnectivity()
      initOfflineQueue()
    })
    const show = toast.show
    const offQueued = onSocialActionQueued((label) => {
      show({
        title: `Offline — ${label} diantrekan`,
        description: "Akan dikirim otomatis saat tersambung kembali.",
        tone: "warning",
        duration: 3500,
      })
    })
    const offDrained = onSocialQueueDrained(({ executed, failed }) => {
      if (executed === 0 && failed === 0) return
      show({
        title: "Tersambung kembali",
        description:
          failed > 0
            ? `${executed} aksi terkirim, ${failed} gagal — coba lagi manual.`
            : `${executed} aksi yang tertunda terkirim.`,
        tone: failed > 0 ? "warning" : "success",
        duration: 4000,
      })
    })
    return () => {
      cancelDeferred()
      offQueued()
      offDrained()
    }
  }, [toast.show])

  // Pesan FCM Web saat tab terbuka (foreground) + klik notifikasi web.
  // Cermin handler tap native di bawah: pemetaan tunggal
  // lib/notification-routing. "foreground" hanya menyegarkan badge (tanpa
  // navigasi — pengguna sedang memakai app); "tap" menavigasi.
  // ST-009: modul dimuat via dynamic import (bukan import statis) agar
  // `firebase/messaging` tidak masuk chunk entry web; di native, stub
  // no-op `lib/web-push.ts` juga tidak dievaluasi saat boot.
  useEffect(() => {
    if (Platform.OS !== "web") return
    if (session.restoring || session.error) return
    let alive = true
    let unsubscribe: (() => void) | undefined
    void import("@/lib/web-push").then((m) => {
      if (!alive) return
      unsubscribe = m.subscribeWebPushMessages((data, source) => {
        if (source === "foreground") {
          if (session.token) void refreshUnreadCount()
          return
        }
        const target = routeForPushData(data) ?? ROUTES.notifications
        // PERF-FIX (P1 nav): replace → navigate (dedup stack): tap push ke
        // rute yang sudah terbuka tidak menumpuk duplikat.
        router.navigate(session.token ? target : ROUTES.login)
        if (session.token) void refreshUnreadCount()
      })
    })
    return () => {
      alive = false
      unsubscribe?.()
    }
  }, [router, session.restoring, session.error, session.token])

  // Tap notifikasi push → buka entitas terkait (order, sengketa, chat, …)
  // lewat pemetaan tunggal lib/notification-routing; tak dikenali → tab
  // Notifikasi. Badge unread disegarkan karena server biasanya menandai
  // notifikasi yang ditap sebagai terbaca. Gate sesi: bila belum login,
  // app/index.tsx & onSessionExpired tetap mengarahkan ke login.
  useEffect(() => {
    if (session.restoring || session.error) return
    return subscribeNotificationOpened((data, source, actionIdentifier) => {
      // E1-001: callback listener native — ErrorBoundary TIDAK menangkap
      // throw di sini (bukan render). Satu payload rusak tidak boleh
      // membunuh seluruh handler tap: catat lalu fallback ke Notifikasi.
      try {
        // Item #24 — action button "Konfirmasi terima" dari push: verifikasi
        // ulang kelayakan via API (fail-closed) lalu eksekusi; setelah aksi,
        // buka detail order agar pengguna melihat status terbaru.
        if (actionIdentifier === CONFIRM_RECEIPT_ACTION) {
          if (source === "cold-start") suppressLastRouteRestore()
          void (async () => {
            if (!session.token) {
              router.push(ROUTES.login)
              return
            }
            const orderId = orderIdFromPushData(data)
            if (!orderId) {
              toast.show({
                title: "Konfirmasi gagal",
                description: "Notifikasi ini tidak menaut ke pesanan yang valid.",
                tone: "danger",
              })
              return
            }
            try {
              await confirmReceipt(orderId)
              toast.show({
                title: "Pesanan dikonfirmasi diterima",
                description: "Dana escrow diteruskan ke penjual.",
                tone: "success",
                duration: 4000,
              })
              // E1-004: navigasi pasca-aksi ikut dijaga di dalam try — bila
              // router belum siap (tap push saat cold start), IIFE tidak
              // reject tanpa handler.
              // PERF-FIX (P1 nav): push → navigate: bila user sudah di
              // detail order itu (mis. via notifikasi), tidak ada duplikat.
              router.navigate(ROUTES.orderDetail(orderId))
              void refreshUnreadCount()
            } catch (err: unknown) {
              toast.show({
                title: "Konfirmasi gagal",
                description: userMessage(err),
                tone: "danger",
              })
            }
          })()
          return
        }
        const resolved = routeForPushData(data)
        // Cold start: hanya navigasi bila payload menunjuk entitas SPESIFIK.
        // Payload kosong/tak dikenal = tetap di Beranda (initial route) —
        // fallback ke Notifikasi di sini membuat setiap cold start mendarat
        // di tab yang salah. Tap saat app hidup tetap jatuh ke Notifikasi
        // karena niat penggunanya jelas (mereka mengetuk notifikasinya).
        if (source === "cold-start" && !resolved) return
        if (source === "cold-start") suppressLastRouteRestore()
        const target = resolved ?? ROUTES.notifications
        // NAV-007: tap notifikasi saat logout — simpan tujuan supaya alur
        // login melanjutkannya (takePendingNext; U5-003: tanpa layar welcome), bukan hilang.
        // Href objek harus dikonkretkan dulu: menyimpan template mentah
        // ("/order/[id]") membuat redirect login mendarat di 404.
        if (!session.token) {
          setPendingNext(hrefToConcretePath(target))
        }
        // PERF-FIX (P1 nav): dedup — tap push ke rute aktif tidak menumpuk.
        router.navigate(session.token ? target : ROUTES.login)
        if (session.token) {
          // CN-012: tap push = notifikasi dibaca. Backend menyertakan
          // `notificationId` (notifId publik) di payload push.
          const d = (data ?? {}) as Record<string, unknown>
          const notifId =
            typeof d.notificationId === "string"
              ? d.notificationId
              : typeof d.notifId === "string"
                ? d.notifId
                : null
          if (notifId) {
            notificationsApi.markNotificationRead(notifId).catch(() => {
              // Sunyi: badge di-refresh di bawah; kegagalan sesekali tidak
              // boleh mengganggu navigasi.
            })
          }
          void refreshUnreadCount()
        }
      } catch (err) {
        logWarn("notif:opened", err)
        if (source === "cold-start") suppressLastRouteRestore()
        router.push(ROUTES.notifications)
      }
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
    publicApi
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
    <>
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
      {/* Item #27: banner ramping "Anda sedang offline" — non-blocking,
          hanya tampil saat NetInfo pasti melaporkan offline. */}
      <OfflineBanner />
      {/*
        GAP-B2 (G102): satu koneksi realtime per akun untuk seluruh app.
        Token dari sesi — provider menutup socket saat logout (token null)
        dan re-handshake saat token di-refresh. Layar chat memakai
        `useChatRoomRealtime`; polling REST tetap sebagai fallback
        (G119/G120).
      */}
      {/* Item #29: gerbang mode pemeliharaan — cek GET /v1/public/maintenance
          saat start; saat aktif, seluruh konten diganti layar informatif
          (pesan server + tombol coba lagi), bukan crash. */}
      <MaintenanceGate>
      <RealtimeProvider token={realtimeNeeded ? session.token : null}>
      {/* SYS-C-403: listener realtime global per-user (dialog login perangkat
          baru + invalidasi saldo dompet) — di atas seluruh tree agar sampai
          kapan pun layar sedang terbuka. */}
      <RealtimeGlobalListeners />
      <View className="flex-1 items-center">
        {/*
          Efek dorong konten ala X saat drawer dibuka (2026-09-27):
          konten sedikit bergeser kanan + mengecil dengan sudut membulat.
          Progress dibaca dari `drawerProgress` (ditulis komponen drawer).
          Reduced motion: tanpa transform.
        */}
        <Reanimated.View
          style={[
            { flex: 1, width: "100%", alignItems: "center" },
            drawerContentStyle,
          ]}
        >
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
                screenOptions={stackScreenOptions}
              >
                {/* Web: guard selalu true (semua layar terdaftar);
                    pemblokiran tamu ditangani GuestLoginPrompt di bawah. */}
                <Stack.Protected
                  guard={Platform.OS === "web" ? true : Boolean(session.token)}
                >
                  {authenticatedScreens}
                </Stack.Protected>
              </Stack>
            )}
            {/* Tamu web membuka layar ber-auth → ajakan login penuh di
                atas layar (Stack tetap terpasang di baliknya). */}
            <GuestRouteOverlay token={session.token} />
          </PortalScene>
          <PersistentShellBar />
          <PortalHost />
        </ContentContainer>
        </Reanimated.View>
        {/*
          Drawer/sidebar navigasi (2026-09-27): overlay di atas konten,
          di bawah AppLockGate — kunci aplikasi tetap menutupi semuanya.
        */}
        {/* FE-075: drawer/sidebar — modul berat, di-render (dan di-import)
            hanya setelah pertama dibutuhkan. */}
        {drawerNeeded ? (
          <Suspense fallback={null}>
            <AppDrawer />
          </Suspense>
        ) : null}
        {/* FE-075: sheet global "Buat baru" (2026-09-28): dibuka dari (+)
            header Etalase & pensil drawer via `openCreateSheet()` — lazy
            seperti drawer. */}
        {createSheetNeeded ? (
          <Suspense fallback={null}>
            <CreateSheet />
          </Suspense>
        ) : null}
        {/* A-04 (audit): kunci aplikasi (§14 re-auth setelah background >1
            menit). Dirender SETELAH konten agar menutupi seluruh tree saat
            terkunci; no-op di web dan tanpa sesi.
            PERF-FIX (bundle): lazy + latch — modul baru dievaluasi setelah
            sesi pertama ada, bukan saat boot. */}
        {Platform.OS !== "web" && lockGateNeeded ? (
          <Suspense fallback={null}>
            <AppLockGate sessionActive={Boolean(session.token)} />
          </Suspense>
        ) : null}
      </View>
      </RealtimeProvider>
      </MaintenanceGate>

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
      {/*
        AUT-007 (audit): sesi web kedaluwarsa — JANGAN diam. Modal ini hanya
        muncul bila pengguna memang punya sesi sebelumnya (tamu tanpa sesi
        tidak diganggu; lihat efek onSessionExpired di atas + B-03).
      */}
      <ShellRouteEffects session={session} setRealtimeNeeded={setRealtimeNeeded} />
    </>
  )
}

/**
 * HOTFIX 2026-09-28 — kahade.id down ("Halaman tidak dapat ditampilkan").
 *
 * Akar masalah: `AppShell` memanggil `useToast()` di badan komponennya
 * sendiri, padahal `<ToastProvider>` baru di-render DI DALAM JSX AppShell.
 * Context tidak bisa dikonsumsi oleh komponen yang menyediakannya —
 * `useToast()` melempar di setiap render pertama sehingga seluruh aplikasi
 * jatuh ke error boundary (commit 8dbd61f, item #27).
 *
 * Perbaikan: pecah dua lapis — provider dipasang di `AppShell` (luar),
 * seluruh hook & konten pindah ke `AppShellInner` (dalam). Jangan panggil
 * `useToast()` (atau context lain yang disediakan di sini) di badan
 * `AppShell` lagi.
 */
function AppShell() {
  return (
    // PortalProvider + ToastProvider HARUS di dalam ThemeProvider (kita sudah
    // di dalamnya — AppShell dirender oleh ThemeProvider) agar overlay yang
    // diteleport (BottomSheet, Modal, Banner, Tooltip, SearchOverlay,
    // LoadingScreen) dan Toast tetap menerima CSS variable dari vars().
    // Tanpa provider ini, setiap komponen overlay melempar error saat mount.
    <PortalProvider>
      <ToastProvider>
        {/* M-1 (audit ronde-2): panaskan deteksi root/jailbreak saat start. */}
        <DeviceIntegrityProvider>
          <AppShellInner />
        </DeviceIntegrityProvider>
      </ToastProvider>
    </PortalProvider>
  )
}

/**
 * Persistent bottom nav — satu instance untuk semua halaman tab.
 *
 * Revisi 2026-09-27 (redesign navigasi mobile): bar TETAP berisi
 * Etalase | Transaksi | (+) | Pesan | Notifikasi — tidak lagi mengikuti mode
 * aplikasi. Ditampilkan hanya di empat halaman tab persis (`isShellTabPath`)
 * agar layar detail (order, chat room, settings) tidak tertutup.
 */
function PersistentShellBar() {
  const pathname = usePathname()
  // Bar disembunyikan untuk rute non-tab (detail, form, dll) agar tidak
  // menutupi konten detail.
  const visible = isShellTabPath(pathname)
  if (!visible) return null
  return <ShellTabBar />
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
