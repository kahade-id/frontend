/**
 * Kahade — Tabs Layout (kerangka navigasi utama).
 *
 * Expo Router `<Tabs>` dengan custom `tabBar` menggunakan
 * `<RouterBottomTabBar>` yang sudah ada di components/ui/bottom-tab-bar.tsx.
 *
 * Tab aktif:
 *   home          → Beranda
 *   transactions  → Transaksi
 *   wallet        → Dompet
 *   showcase      → Feed sosial karya/thread
 *   discover      → "Profil" (slot ke-5 dibrandakan ulang: menekannya membuka
 *                   profil publik MILIK SENDIRI di /user/[username], bukan
 *                   layar penemuan pengguna — lihat listener `tabPress` dan
 *                   TAB_BAR_ITEMS di components/ui/bottom-tab-bar.tsx)
 *
 * Notifikasi dan Pengaturan kini menjadi layar Stack tanpa bottom navbar.
 * Unread tetap dipoll di layout ini, lalu badge tampil pada tombol Bell di
 * header Beranda di sebelah tombol Pesan.
 *
 * Badge unread Notifikasi (store bersama `lib/unread-count.ts`):
 *   - Di-poll setiap kali layout mount (AppState focus) + interval 60 detik
 *     saat app aktif di foreground. Interval bukan WebSocket — badge tidak
 *     perlu real-time; 60 detik cukup dan hemat baterai.
 *   - Hanya tampil bila count > 0. Bila response null (bentuk tak dikenal,
 *     lihat readUnreadCount di notifications.ts) → pertahankan state
 *     sebelumnya, agar badge tidak salah hilang.
 *   - Error (network/auth) diabaikan secara diam-diam — badge cukup basi,
 *     tidak perlu error toast hanya karena poll gagal.
 *
 * Koneksi ke alur auth:
 *   welcome.tsx memanggil router.replace(ROUTES.home) → masuk ke tab ini.
 *   _layout.tsx root (app/_layout.tsx) memakai <Stack> — `(tabs)` terdaftar
 *   sebagai satu entry di stack navigasi, sehingga user tidak bisa back ke
 *   auth screen setelah masuk ke sini.
 *
 * Keputusan non-obvious:
 *   - `TAB_ROUTE_NAMES` dari routes.ts dipakai untuk urutan tab; ikut
 *     konstanta itu, bukan didefinisikan ulang di sini.
 *   - `headerShown: false` di screenOptions karena tiap tab screen membangun
 *     header-nya sendiri (atau tidak butuh header).
 *   - `tabBar` prop menerima props @react-navigation; RouterBottomTabBar
 *     mengadaptasinya tanpa mengimpor tipe navigation langsung (pola yang
 *     sudah ada di bottom-tab-bar.tsx).
 *   - AppState listener + interval keduanya diperlukan: AppState supaya badge
 *     langsung update saat user kembali dari background; interval supaya
 *     badge fresh selama user aktif.
 *   - Store eksternal (useSyncExternalStore) bukan state lokal: layar
 *     Notifikasi & push handler bisa menurunkan angka tanpa poll ulang.
 */
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react"
import { router, Tabs } from "expo-router"

import { RouterBottomTabBar, TAB_BAR_ITEMS } from "@/components/ui/bottom-tab-bar"
import { api } from "@/lib/api"
import { logWarn } from "@/lib/telemetry"
import { ROUTES, TAB_ROUTE_NAMES } from "@/lib/routes"
import { useAuthSession } from "@/lib/use-auth-session"
import { useUnreadCount } from "@/lib/unread-count"


/** Props tabBar @react-navigation yang diteruskan ke <Tabs> Expo Router. */
type TabsTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------

export default function TabsLayout() {
  // Store bersama lib/unread-count (poll 60 d + AppState); layar Notifikasi
  // memanggil setUnreadCount/refreshUnreadCount setelah tandai dibaca → badge
  // hilang seketika tanpa menunggu poll berikutnya.
  // Tetap satu pemasangan poll unread; badge kini ditampilkan pada tombol
  // notifikasi di header Beranda, bukan pada bottom navigation.
  //
  // B-05 (audit): poll DIGATE sesi — tamu web yang membuka tab tidak lagi
  // menembak endpoint `auth:"required"` tiap 60 detik (badai 401 → refresh →
  // clearSession). Tanpa token tidak ada badge untuk ditampilkan pula.
  const session = useAuthSession()
  useUnreadCount({ enabled: Boolean(session.token) })

  /**
   * Username sendiri — dibutuhkan tab "Profil" untuk membuka profil publik
   * milik pengguna (/user/[username]). Diambil sekali saat sesi tersedia;
   * kegagalan tidak fatal (tab jatuh ke gate login / layar discover).
   */
  const [meUsername, setMeUsername] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!session.token) {
      setMeUsername(null)
      return undefined
    }
    api.users
      .getMe()
      .then((me) => {
        if (alive) setMeUsername(me?.username ?? null)
      })
      .catch((err) => logWarn("tabs:me-username", err))
    return () => {
      alive = false
    }
  }, [session.token])

  /**
   * Tab ke-5 = "Profil": JANGAN pindah ke layar discover; buka profil publik
   * milik sendiri (profil sendiri merender bottom bar-nya sendiri — lihat
   * app/user/[username].tsx). Tamu tanpa sesi diarahkan ke gate login.
   */
  const profileTabListeners = useMemo(
    () => ({
      tabPress: (event: { preventDefault: () => void }) => {
        event.preventDefault()
        if (meUsername) router.push(ROUTES.userProfile(meUsername))
        else router.push(ROUTES.loginRequired())
      },
    }),
    [meUsername],
  )

  const renderTabBar = useCallback(
    (props: TabsTabBarProps) => (
      <RouterBottomTabBar
        state={props.state}
        navigation={props.navigation}
        items={TAB_BAR_ITEMS}
      />
    ),
    [],
  )

  return (
    <Tabs
      // Rute awal EKSPLISIT: mengandalkan urutan deklarasi membuat tab pertama
      // yang "menang" bergantung pada implementasi navigator — app harus
      // selalu dibuka di Beranda, bukan di tab lain.
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={renderTabBar}
    >
      {TAB_ROUTE_NAMES.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          {...(name === "discover" ? { listeners: profileTabListeners } : {})}
        />
      ))}
    </Tabs>
  )
}
