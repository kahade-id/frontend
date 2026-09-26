/**
 * Layar Stack — Pengaturan (dibuka dari identitas/avatar Beranda)
 *
 * Keputusan desain (permintaan produk 2026-09-09):
 *  - Menu TANPA deskripsi. Satu baris = satu judul; hierarki dijaga ukuran
 *    judul (`titleVariant="bodyLarge"` = 16/26 weight 600), bukan teks kedua
 *    yang membuat layar ramai dan memaksa baris jadi dua kali lebih tinggi.
 *  - Pengecualian: teks di KANAN baris tetap ada karena itu STATUS, bukan
 *    penjelasan — Tampilan (Sistem/Terang/Gelap), Bahasa (bahasa aktif),
 *    Versi Aplikasi (vX.Y.Z), dan badge langganan.
 *  - Kartu cukup LATAR (`bg-surface`) + `rounded-md`, tanpa border dan tanpa
 *    pemisah antar baris. Kelompok ditandai label kecil + jarak + sudut
 *    membulat, jadi layar terbaca sebagai daftar pengaturan yang rapi,
 *    bukan tumpukan kartu bersiku. Kartu Langganan dan kotak ikonnya memakai
 *    `rounded-md` yang SAMA dengan kelompok menu: radius yang berbeda di layar
 *    yang sama terbaca sebagai "kartu ini dari sistem lain".
 *
 * Struktur:
 *  - ProfileHeader: avatar + nama + @username (tanpa foto sampul — lihat
 *    catatan di pemanggilannya).
 *  - Kartu utama: Langganan (Kahade Plus).
 *  - Akun: Edit Profil, Laporan & Analitik, Keamanan, Tipe Akun.
 *  - Preferensi: Tampilan, Notifikasi, Bahasa, Versi Aplikasi.
 *  - Bantuan: Tentang Kami, Umpan Balik, Asisten Bantuan, Tiket Bantuan.
 *  - Legal: Syarat & ketentuan, Kebijakan privasi.
 *  - Keluar: Dialog konfirmasi destruktif + unregister push device + clear session.
 *
 * Navigasi:
 *  - "Keamanan" → /security = PUSAT pengaturan keamanan (ganti nomor HP,
 *    email, password, PIN, biometrik, 2FA, perangkat & log, hapus akun).
 *  - "Laporan & Analitik" → /analytics = angka ringkasan + unduh riwayat
 *    transaksi/dompet + tautan ke daftar laporan (/reports).
 */
import { useCallback, useState } from "react"
import { Platform, View } from "react-native"
import { router, type Href } from "expo-router"
import {
  Bell,
  Briefcase,
  Buildings,
  CaretRight,
  ChatTeardropDots,
  CrownSimple,
  FileText,
  Headset,
  Info,
  Lifebuoy,
  Moon,
  Scales,
  Shield,
  ShieldCheck,
  SignOut,
  Storefront,
  Translate,
  User,
  Bookmark,
} from "phosphor-react-native"

import { api, type UserProfile } from "@/lib/api"
import { useKahadePlus } from "@/lib/use-kahade-plus"
import { queryKeys } from "@/lib/query-keys"
import { clearSession } from "@/lib/api/session"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { unregisterWebPushDevice } from "@/lib/web-push"
import { ROUTES } from "@/lib/routes"
import { languageLabel, useLanguage } from "@/lib/i18n"
import { installedAppVersion } from "@/lib/runtime-info"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { logWarn } from "@/lib/telemetry"

import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Stagger } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ListItem } from "@/components/ui/list-item"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Dialog } from "@/components/ui/modal"
import { ProfileHeader } from "@/components/ui/profile-header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { RouteLink } from "@/components/ui/route-link"
import { MenuGroupLabel } from "@/components/ui/section"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

// ------------------------------------------------------------------
// Data Menu
// ------------------------------------------------------------------

type MenuItemData = {
  id: string
  label: string
  icon: IconComponent
  route: Href
  /** Status di kanan baris (bukan deskripsi) — mis. "Sistem", "Indonesia", "v1.0.0" */
  trailing?: string
}

/** Latar polos + rounded — satu kelas untuk semua kelompok menu (tanpa separator antar baris). */
const MENU_GROUP = "w-full overflow-hidden rounded-md bg-surface"

export default function SettingsScreen() {
  const { preference } = useTheme()
  const language = useLanguage()
  const insets = useSafeAreaInsets()

  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Profile data query
  const profileQuery = useApiQuery<UserProfile>(queryKeys.me(), (signal) => api.users.getMe(signal))
  const profile = profileQuery.data

  // Status langganan — WAJIB lewat `useKahadePlus()` (satu-satunya sumber
  // status langganan di UI); jangan menembak endpoint status langsung.
  const { isActive: isSubscribed, refetch: refetchPlus } = useKahadePlus()
  const [plusRefreshing, setPlusRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setPlusRefreshing(true)
    try {
      await Promise.allSettled([profileQuery.refresh(), refetchPlus()])
    } finally {
      setPlusRefreshing(false)
    }
  }, [profileQuery, refetchPlus])


  const performLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      // Web: lepas token FCM Web + hapus token-nya; native: lepas Expo token.
      // Keduanya no-op yang aman bila push tidak aktif — logout tetap jalan.
      const deviceApi = {
        registerDevice: (dto: Parameters<typeof api.notifications.registerDevice>[0]) =>
          api.notifications.registerDevice(dto),
        unregisterDevice: () => api.notifications.unregisterDevice(),
      }
      if (Platform.OS === "web")
        await unregisterWebPushDevice(deviceApi).catch((err) => logWarn("settings:unregister-push", err))
      else await unregisterPushDevice(deviceApi).catch((err) => logWarn("settings:unregister-push", err))
      try {
        await api.auth.logout().catch((err) => logWarn("settings:logout", err))
      } finally {
        await clearSession()
      }
      router.replace(ROUTES.login)
    } finally {
      setLoggingOut(false)
    }
  }, [])

  const appVersionStr = installedAppVersion() ? `v${installedAppVersion()}` : "v1.0.0"
  const themeLabel =
    preference === "system" ? "Sistem" : preference === "dark" ? "Gelap" : "Terang"

  // ── Akun ────────────────────────────────────────────────────────
  const accountItems: MenuItemData[] = [
    { id: "saved", label: "Profil Tersimpan", icon: Bookmark, route: ROUTES.saved },
    { id: "edit-profile", label: "Edit Profil", icon: User, route: ROUTES.editProfile },
    { id: "reports", label: "Laporan & Analitik", icon: FileText, route: ROUTES.analytics },
    { id: "security", label: "Keamanan", icon: ShieldCheck, route: ROUTES.security },
    { id: "account-type", label: "Tipe Akun", icon: Briefcase, route: ROUTES.accountType },
    {
      id: "business-verification",
      label: "Verifikasi Bisnis",
      icon: Storefront,
      route: ROUTES.businessVerification,
    },
  ]

  // ── Preferensi ──────────────────────────────────────────────────
  const preferenceItems: MenuItemData[] = [
    { id: "appearance", label: "Tampilan", icon: Moon, route: ROUTES.appearance, trailing: themeLabel },
    {
      id: "notifications",
      label: "Notifikasi",
      icon: Bell,
      route: ROUTES.notificationPreferences,
    },
    {
      id: "language",
      label: "Bahasa",
      icon: Translate,
      route: ROUTES.language,
      // Status baris = bahasa yang SEDANG aktif, bukan teks tetap. Dulu
      // hardcode "Indonesia", jadi memilih English di /language tidak mengubah
      // apa pun yang terlihat — gejala yang dilaporkan: "cuma ada Indonesia".
      trailing: languageLabel(language),
    },
    {
      id: "app-version",
      label: "Versi Aplikasi",
      icon: Info,
      route: ROUTES.appVersion,
      trailing: appVersionStr,
    },
  ]

  // ── Bantuan ─────────────────────────────────────────────────────
  const supportItems: MenuItemData[] = [
    { id: "about-us", label: "Tentang Kami", icon: Buildings, route: ROUTES.about },
    { id: "feedback", label: "Umpan Balik", icon: ChatTeardropDots, route: ROUTES.feedback },
    { id: "live-support", label: "Asisten Bantuan", icon: Headset, route: ROUTES.liveSupport },
    { id: "support-tickets", label: "Tiket Bantuan", icon: Lifebuoy, route: ROUTES.support },
  ]

  // ── Legal ───────────────────────────────────────────────────────
  const legalItems: MenuItemData[] = [
    { id: "terms", label: "Syarat & Ketentuan", icon: Scales, route: ROUTES.terms },
    { id: "privacy-policy", label: "Kebijakan Privasi", icon: Shield, route: ROUTES.privacyPolicy },
  ]

  const renderGroup = (items: MenuItemData[]) => (
    <View className={MENU_GROUP}>
      {items.map((item) => (
        <ListItem
          key={item.id}
          title={item.label}
          titleVariant="bodyLarge"
          leading={item.icon}
          trailing={item.trailing}
          chevron
          divider={false}
          padded={false}
          className="px-4 py-3"
          href={item.route}
        />
      ))}
    </View>
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pengaturan" />

      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={profileQuery.refreshing || plusRefreshing}
        scrollViewProps={{
          contentContainerStyle: {
            paddingBottom: insets.bottom + tokens.space[16],
          },
        }}
      >
        {/* ── Profile Header (sampul + avatar) ───────────────── */}
        <View className="pt-2 pb-1">
          {profileQuery.error ? (
            <ErrorState
              compact
              title="Gagal memuat profil"
              description={profileQuery.error}
              onRetry={() => void profileQuery.reload()}
              retrying={profileQuery.loading}
            />
          ) : (
            /*
             * TANPA `cover`. Foto sampul adalah milik halaman profil dan
             * /edit-profile — di layar Pengaturan ia hanya mendorong menu ke
             * bawah lipatan layar tanpa menambah satu pun tindakan yang belum
             * tersedia di baris "Edit Profil". Yang dibutuhkan layar ini dari
             * identitas pengguna adalah "akun mana yang sedang saya atur":
             * avatar + nama + @username cukup, dan sampul justru membuatnya
             * terlihat seperti halaman profil kedua.
             */
            <ProfileHeader
              name={profile?.fullName ?? "—"}
              handle={profile?.username ? `@${profile.username}` : undefined}
              avatar={{ source: profile?.avatarUrl ?? undefined }}
              loading={profileQuery.loading}
            />
          )}
        </View>

        <View className="gap-4 px-5 pt-3">
          {/* ── Kartu utama: Langganan ────────────────────────── */}
          {/* <RouteLink> membungkus <Link asChild> di atas PressableScale:
             efek tekan tetap, tetapi web mendapat <a href> sungguhan dan
             screen reader mengumumkan "tautan", bukan "tombol". */}
          <RouteLink
            href={ROUTES.kahadePlusPlans}
            accessibilityLabel="Menu Langganan Kahade Plus"
            containerClassName="w-full"
            className="w-full overflow-hidden rounded-md bg-surface p-4"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-md bg-primary">
                <Icon icon={CrownSimple} size="sm" tone="inverse" weight="fill" />
              </View>

              <View className="flex-1 flex-row items-center gap-2">
                <Text variant="bodyLarge" weight={600} tone="primary">
                  Langganan
                </Text>
                <Badge tone={isSubscribed ? "success" : "neutral"} variant="soft">
                  {isSubscribed ? "Plus Aktif" : "Kahade Plus"}
                </Badge>
              </View>

              <Icon icon={CaretRight} size="sm" tone="default" />
            </View>
          </RouteLink>

          {/*
           * v2: 4 grup menu reveal bertingkat. Jarak geser kecil (4px, bukan
           * 8px) karena daftar menu rapat — gerak mengikuti densitas. Kartu
           * Langganan, komunitas, dan tombol Keluar SENGAJA statis: hero di
           * atas harus stabil, dan tombol destruktif tidak boleh bergeser
           * saat jari mendekat.
           */}
          <Stagger duration="fast" step={50} distance={tokens.space[1]}>
            {/* ── Akun ─────────────────────────────────────────── */}
            <View className="gap-2">
              <MenuGroupLabel>Akun</MenuGroupLabel>
              {renderGroup(accountItems)}
            </View>

            {/* ── Preferensi ───────────────────────────────────── */}
            <View className="gap-2">
              <MenuGroupLabel>Preferensi</MenuGroupLabel>
              {renderGroup(preferenceItems)}
            </View>

            {/* ── Bantuan ──────────────────────────────────────── */}
            <View className="gap-2">
              <MenuGroupLabel>Bantuan</MenuGroupLabel>
              {renderGroup(supportItems)}
            </View>

            {/* ── Legal ────────────────────────────────────────── */}
            <View className="gap-2">
              <MenuGroupLabel>Legal</MenuGroupLabel>
              {renderGroup(legalItems)}
            </View>
          </Stagger>

          {/* ── Keluar ───────────────────────────────────────── */}
          <View className="pt-2">
            <Button
              variant="destructive"
              size="md"
              leftIcon={SignOut}
              onPress={() => setLogoutOpen(true)}
            >
              Keluar
            </Button>
          </View>
        </View>
      </PullToRefresh>

      {/* ── Dialog Konfirmasi Logout ────────────────────────── */}
      <Dialog
        visible={logoutOpen}
        tone="danger"
        destructive
        icon={SignOut}
        title="Keluar dari Kahade?"
        description="Perangkat ini akan berhenti menerima notifikasi akun. Anda bisa masuk kembali kapan saja."
        confirmLabel="Keluar"
        cancelLabel="Batal"
        loading={loggingOut}
        onConfirm={() => void performLogout()}
        onCancel={() => setLogoutOpen(false)}
        onRequestClose={() => setLogoutOpen(false)}
      />
    </Screen>
  )
}
