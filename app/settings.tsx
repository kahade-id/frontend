/**
 * Layar Stack — Pengaturan (dibuka dari identitas/avatar Beranda)
 *
 * Keputusan desain (permintaan produk 2026-09-09):
 *  - Menu TANPA deskripsi. Satu baris = satu judul; hierarki dijaga ukuran
 *    judul (`titleVariant="bodyLarge"` = 16/26 weight 600), bukan teks kedua
 *    yang membuat layar ramai dan memaksa baris jadi dua kali lebih tinggi.
 *  - Pengecualian: teks di KANAN baris tetap ada karena itu STATUS, bukan
 *    penjelasan — Tampilan (Sistem/Terang/Gelap), Bahasa (bahasa aktif),
 *    Versi Aplikasi (vX.Y.Z).
 *  - Kartu cukup LATAR (`bg-surface`) + `rounded-md`, tanpa border dan tanpa
 *    pemisah antar baris. Kelompok ditandai label kecil + jarak + sudut
 *    membulat, jadi layar terbaca sebagai daftar pengaturan yang rapi,
 *    bukan tumpukan kartu bersiku.
 *
 * Keputusan produk 2026-09-27:
 *  - TANPA header profil (avatar + nama + @username) — identitas pengguna
 *    sudah ada di atas sidebar; menampilkannya lagi di halaman ini hanya
 *    duplikasi.
 *  - TANPA kartu Langganan — menu Kahade+ (langganan) adalah item menu
 *    tersendiri di sidebar, bukan di dalam halaman Pengaturan.
 *
 * Struktur:
 *  - Akun: Profil Tersimpan, Edit Profil, Laporan & Analitik, Keamanan,
 *    Tipe Akun, Verifikasi Bisnis.
 *  - Toko & Pesanan: Katalog Produk, Retur Saya, Produk Saya.
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
import { useCallback, useMemo, useState } from "react"
import { Platform, ScrollView, View } from "react-native"
import { router, type Href } from "expo-router"
import Constants from "expo-constants"
import {
  ArrowUDownLeft,
  Bell,
  Briefcase,
  Buildings,
  ChatTeardropDots,
  FileText,
  Headset,
  Info,
  Lifebuoy,
  MapPin,
  Moon,
  Scales,
  Shield,
  ShieldCheck,
  ShoppingBag,
  SignOut,
  Storefront,
  Ticket,
  AirplaneTilt,
  UsersThree,
  CalendarCheck,
  Translate,
  User,
  Bookmark,
} from "phosphor-react-native"

import { api } from "@/lib/api"
import { clearSession } from "@/lib/api/session"
import type { UserProfile } from "@/lib/api/users"
import type { NotificationPreferences } from "@/lib/api/notifications"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { unregisterWebPushDevice } from "@/lib/web-push"
import { summarizeNotificationPreferences } from "@/lib/notification-effective"
import { queryKeys } from "@/lib/query-keys"
import { useApiQuery } from "@/lib/use-api-query"
import { ROUTES } from "@/lib/routes"
import { languageLabel, useLanguage } from "@/lib/i18n"
import { installedAppVersion } from "@/lib/runtime-info"
import { maskEmail, maskPhone } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { logWarn } from "@/lib/telemetry"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Stagger } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { type IconComponent } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { ListItem } from "@/components/ui/list-item"
import { Text } from "@/components/ui/text"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Dialog } from "@/components/ui/modal"
import { MenuGroupLabel } from "@/components/ui/section"
import { Screen } from "@/components/ui/screen"

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

  // FE-IMP-3 #93 — nama/@username untuk dialog konfirmasi keluar. Query ringan
  // (cache bersama queryKeys.me()); gagal muat → dialog tetap jalan tanpa nama.
  const meQuery = useApiQuery<UserProfile>(queryKeys.me(), (signal) =>
    api.users.getMe(signal),
  )
  const me = meQuery.data

  // FE-IMP-3 #91 — status kanan baris "Notifikasi": "N dari 7 jenis aktif",
  // atau "Senyap 22:00–07:00" bila quiet hours menyala. Belum dimuat/gagal →
  // tanpa trailing (bukan angka yang menyesatkan).
  const notifPrefsQuery = useApiQuery<NotificationPreferences>(
    "notification-preferences",
    (signal) => api.notifications.getNotificationPreferences(signal),
  )
  const notifTrailing =
    summarizeNotificationPreferences(notifPrefsQuery.data ?? null) ?? undefined

  // FE-IMP-3 #103 — identitas tersamarkan di baris menu Keamanan (nomor HP
  // bila ada, kalau tidak email) — cegah shoulder-surfing identitas akun
  // penuh. Belum dimuat/gagal → tanpa trailing.
  const securityTrailing = me?.phoneNumber
    ? maskPhone(me.phoneNumber)
    : me?.email
      ? maskEmail(me.email)
      : undefined

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

  const rawVersion = installedAppVersion() ?? Constants.expoConfig?.version
  const appVersionStr = rawVersion ? `v${rawVersion}` : "—"
  const themeLabel =
    preference === "system" ? "Sistem" : preference === "dark" ? "Gelap" : "Terang"

  // ── Akun ────────────────────────────────────────────────────────
  const accountItems: MenuItemData[] = [
    { id: "saved", label: "Profil Tersimpan", icon: Bookmark, route: ROUTES.saved },
    { id: "edit-profile", label: "Edit Profil", icon: User, route: ROUTES.editProfile },
    // Batch 43 (item 2): buku alamat pengiriman.
    { id: "addresses", label: "Buku Alamat", icon: MapPin, route: ROUTES.addresses },
    { id: "reports", label: "Laporan & Analitik", icon: FileText, route: ROUTES.analytics },
    { id: "security", label: "Keamanan", icon: ShieldCheck, route: ROUTES.security, trailing: securityTrailing },
    { id: "account-type", label: "Tipe Akun", icon: Briefcase, route: ROUTES.accountType },
    {
      id: "business-verification",
      label: "Verifikasi Bisnis",
      icon: Storefront,
      route: ROUTES.businessVerification,
    },
  ]

  // ── Toko & Pesanan (Gap-D: katalog, retur, produk seller) ──────────────
  const shopItems: MenuItemData[] = [
    { id: "products", label: "Katalog Produk", icon: ShoppingBag, route: ROUTES.products },
    { id: "returns", label: "Retur Saya", icon: ArrowUDownLeft, route: ROUTES.returns },
    { id: "seller-products", label: "Produk Saya", icon: Storefront, route: ROUTES.sellerProducts },
    // Batch 43 (item 9): voucher toko penjual.
    { id: "seller-vouchers", label: "Voucher Toko", icon: Ticket, route: ROUTES.sellerVouchers },
    // Batch 43 (item 15): trip jastip host.
    { id: "jastip", label: "Jastip Saya", icon: AirplaneTilt, route: ROUTES.jastip },
    // Batch 43 (item 16): grup patungan.
    { id: "patungan", label: "Patungan", icon: UsersThree, route: ROUTES.patungan },
    // Batch 43 (item 12): booking jasa buyer.
    { id: "service-bookings", label: "Booking Jasa", icon: CalendarCheck, route: ROUTES.serviceBookings },
  ]

  // ── Preferensi ──────────────────────────────────────────────────
  const preferenceItems: MenuItemData[] = [
    { id: "appearance", label: "Tampilan", icon: Moon, route: ROUTES.appearance, trailing: themeLabel },
    {
      id: "notifications",
      label: "Notifikasi",
      icon: Bell,
      route: ROUTES.notificationPreferences,
      trailing: notifTrailing,
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

  // ── A15 (batch 139): pencarian LOKAL — hanya memfilter menu pengaturan
  // yang SUDAH ADA di atas. Tidak ada destinasi/tujuan baru.
  const [query, setQuery] = useState("")
  const groups = useMemo(
    () => [
      { title: "Akun", items: accountItems },
      { title: "Toko & Pesanan", items: shopItems },
      { title: "Preferensi", items: preferenceItems },
      { title: "Bantuan", items: supportItems },
      { title: "Legal", items: legalItems },
    ],
    [accountItems, shopItems, preferenceItems, supportItems, legalItems],
  )
  const q = query.trim().toLowerCase()
  const filteredGroups = useMemo(
    () =>
      q
        ? groups
            .map((g) => ({
              ...g,
              items: g.items.filter((item) => item.label.toLowerCase().includes(q)),
            }))
            .filter((g) => g.items.length > 0)
        : groups,
    [groups, q],
  )
  const searching = q.length > 0
  const noResults = searching && filteredGroups.length === 0

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

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + tokens.space[16],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-4 px-5 pt-3">
          {/* A15: pencarian lokal — hanya memfilter menu yang sudah ada. */}
          <Input
            variant="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Cari pengaturan"
            accessibilityLabel="Cari pengaturan"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {/*
           * v2: 4 grup menu reveal bertingkat. Jarak geser kecil (4px, bukan
           * 8px) karena daftar menu rapat — gerak mengikuti densitas. Tombol
           * Keluar SENGAJA statis: tombol destruktif tidak boleh bergeser
           * saat jari mendekat.
           */}
          {noResults ? (
            <View className="items-center gap-1 py-8">
              <Text variant="body" weight={600}>
                Tidak ditemukan
              </Text>
              <Text variant="caption" tone="secondary" className="text-center text-pretty">
                Tidak ada pengaturan yang cocok dengan “{query.trim()}”.
              </Text>
            </View>
          ) : (
            <Stagger duration="fast" step={50} distance={tokens.space[1]}>
              {filteredGroups.map((group) => (
                <View key={group.title} className="gap-2">
                  <MenuGroupLabel>{group.title}</MenuGroupLabel>
                  {renderGroup(group.items)}
                </View>
              ))}
            </Stagger>
          )}

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
      </ScrollView>

      {/* ── Dialog Konfirmasi Logout ────────────────────────── */}
      <Dialog
        visible={logoutOpen}
        tone="danger"
        destructive
        icon={SignOut}
        title="Keluar dari Kahade?"
        description={
          // FE-IMP-3 #93 — tampilkan akun yang akan keluar supaya tidak salah
          // akun (perangkat bersama / multi-akun).
          me?.username
            ? `Keluar dari akun ${me.fullName || me.username} (@${me.username}) di perangkat ini? Perangkat ini akan berhenti menerima notifikasi akun. Anda bisa masuk kembali kapan saja.`
            : "Perangkat ini akan berhenti menerima notifikasi akun. Anda bisa masuk kembali kapan saja."
        }
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
