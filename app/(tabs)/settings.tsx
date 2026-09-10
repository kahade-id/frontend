/**
 * Tab #5 — Pengaturan (Settings)
 *
 * Keputusan desain (permintaan produk 2026-09-09):
 *  - Menu TANPA deskripsi. Satu baris = satu judul; hierarki dijaga ukuran
 *    judul (`titleVariant="bodyLarge"` = 16/26 weight 600), bukan teks kedua
 *    yang membuat layar ramai dan memaksa baris jadi dua kali lebih tinggi.
 *  - Pengecualian: teks di KANAN baris tetap ada karena itu STATUS, bukan
 *    penjelasan — Tampilan (Sistem/Terang/Gelap), Bahasa (Indonesia),
 *    Versi Aplikasi (vX.Y.Z), dan badge langganan.
 *  - Kartu cukup LATAR (`bg-surface`) + `rounded-md`, tanpa border dan tanpa
 *    pemisah antar baris. Kelompok ditandai label kecil + jarak + sudut
 *    membulat, jadi layar terbaca sebagai daftar pengaturan yang rapi,
 *    bukan tumpukan kartu bersiku.
 *
 * Struktur:
 *  - ProfileHeader: foto sampul (header image) + avatar + nama + @username,
 *    dengan aksi ubah sampul/profil → /edit-profile.
 *  - Kartu utama: Langganan (Kahade Plus).
 *  - Akun: Edit Profil, Laporan & Analitik, Keamanan, Tipe Akun.
 *  - Preferensi: Tampilan, Notifikasi, Bahasa, Versi Aplikasi.
 *  - Bantuan: Tentang Kami, Umpan Balik, Dukungan Langsung, Tiket Bantuan.
 *  - Legal: Syarat & ketentuan, Kebijakan privasi.
 *  - Komunitas: Telegram, X, Facebook, WhatsApp, Instagram, TikTok.
 *  - Keluar: Dialog konfirmasi destruktif + unregister push device + clear session.
 *
 * Navigasi:
 *  - "Keamanan" → /security = PUSAT pengaturan keamanan (ganti nomor HP,
 *    email, password, PIN, biometrik, 2FA, perangkat & log, hapus akun).
 *  - "Laporan & Analitik" → /analytics = angka ringkasan + unduh riwayat
 *    transaksi/dompet + tautan ke daftar laporan (/reports).
 */
import { useCallback, useState } from "react"
import { Linking, View } from "react-native"
import { router, type Href } from "expo-router"
import {
  Bell,
  Briefcase,
  Buildings,
  Camera,
  CaretRight,
  ChatTeardropDots,
  CrownSimple,
  FacebookLogo,
  FileText,
  Headset,
  Info,
  InstagramLogo,
  Lifebuoy,
  Moon,
  Scales,
  Shield,
  ShieldCheck,
  SignOut,
  TelegramLogo,
  TiktokLogo,
  Translate,
  User,
  WhatsappLogo,
  XLogo,
} from "phosphor-react-native"

import { api, type UserProfile } from "@/lib/api"
import type { SubscriptionStatus } from "@/lib/api/subscriptions"
import { clearSession } from "@/lib/api/session"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { ROUTES } from "@/lib/routes"
import { languageLabel, useLanguage } from "@/lib/i18n"
import { installedAppVersion } from "@/lib/runtime-info"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Stagger } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { ListItem } from "@/components/ui/list-item"
import { Dialog } from "@/components/ui/modal"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ProfileHeader } from "@/components/ui/profile-header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { RouteLink } from "@/components/ui/route-link"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

// ------------------------------------------------------------------
// Data Menu & Komunitas
// ------------------------------------------------------------------

type MenuItemData = {
  id: string
  label: string
  icon: IconComponent
  route: Href
  /** Status di kanan baris (bukan deskripsi) — mis. "Sistem", "Indonesia", "v1.0.0" */
  trailing?: string
}

type SocialCommunityItem = {
  id: string
  label: string
  icon: IconComponent
  url: string
}

const SOCIAL_COMMUNITIES: SocialCommunityItem[] = [
  {
    id: "telegram",
    label: "Telegram",
    icon: TelegramLogo,
    url: "https://t.me/kahade",
  },
  {
    id: "x",
    label: "X",
    icon: XLogo,
    url: "https://x.com/kahade",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: FacebookLogo,
    url: "https://facebook.com/kahade",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: WhatsappLogo,
    url: "https://wa.me/kahade",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: InstagramLogo,
    url: "https://instagram.com/kahade",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: TiktokLogo,
    url: "https://tiktok.com/@kahade",
  },
]

/** Latar polos + rounded — satu kelas untuk semua kelompok menu (tanpa separator antar baris). */
const MENU_GROUP = "w-full overflow-hidden rounded-md bg-surface"

/** Judul kelompok: label 13/600 (bukan H2/H3 agar tidak bersaing dengan baris). */
function MenuGroupLabel({ children }: { children: string }) {
  return (
    <Text variant="label" tone="secondary" className="pt-2">
      {children}
    </Text>
  )
}

export default function SettingsScreen() {
  const toast = useToast()
  const { preference } = useTheme()
  const language = useLanguage()

  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Profile data query
  const profileQuery = useApiQuery<UserProfile>("user-me", (signal) => api.users.getMe(signal))
  const profile = profileQuery.data

  // Subscription status query
  const subscriptionQuery = useApiQuery<SubscriptionStatus | null>(
    "subscription-status",
    (signal) => api.subscriptions.getSubscriptionStatus(signal).catch(() => null),
  )
  const subStatus = subscriptionQuery.data
  const isSubscribed = Boolean(subStatus?.active)

  const handleRefresh = useCallback(async () => {
    await Promise.allSettled([profileQuery.refresh(), subscriptionQuery.refresh()])
  }, [profileQuery, subscriptionQuery])

  const handleSocialPress = useCallback(
    (item: SocialCommunityItem) => {
      void Linking.openURL(item.url).catch(() => {
        toast.show({
          title: `Gagal membuka ${item.label}`,
          description: "Periksa koneksi internet atau aplikasi terkait di perangkat Anda.",
          tone: "danger",
        })
      })
    },
    [toast],
  )

  const performLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      await unregisterPushDevice({
        registerDevice: (dto) => api.notifications.registerDevice(dto),
        unregisterDevice: () => api.notifications.unregisterDevice(),
      }).catch(() => undefined)
      try {
        await api.auth.logout().catch(() => undefined)
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
    { id: "edit-profile", label: "Edit Profil", icon: User, route: ROUTES.editProfile },
    { id: "reports", label: "Laporan & Analitik", icon: FileText, route: ROUTES.analytics },
    { id: "security", label: "Keamanan", icon: ShieldCheck, route: ROUTES.security },
    { id: "account-type", label: "Tipe Akun", icon: Briefcase, route: ROUTES.accountType },
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
    { id: "about-us", label: "Tentang Kami", icon: Buildings, route: ROUTES.faq },
    { id: "feedback", label: "Umpan Balik", icon: ChatTeardropDots, route: ROUTES.contact },
    { id: "live-support", label: "Dukungan Langsung", icon: Headset, route: ROUTES.chat },
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
      <Header showBack={false} title="Pengaturan" />

      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={profileQuery.refreshing || subscriptionQuery.refreshing}
        scrollViewProps={{
          contentContainerStyle: {
            paddingBottom: tokens.space[16],
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
            <ProfileHeader
              name={profile?.fullName ?? "—"}
              handle={profile?.username ? `@${profile.username}` : undefined}
              avatar={{ source: profile?.avatarUrl ?? undefined }}
              cover={{
                source: profile?.headerUrl ?? undefined,
                placeholder: true,
                action: (
                  <IconButton
                    icon={Camera}
                    size="sm"
                    variant="secondary"
                    accessibilityLabel="Ubah foto sampul dan profil"
                    onPress={() => router.push(ROUTES.editProfile)}
                  />
                ),
              }}
              loading={profileQuery.loading}
            />
          )}
        </View>

        <View className="gap-4 px-6 pt-3">
          {/* ── Kartu utama: Langganan ────────────────────────── */}
          {/* <RouteLink> membungkus <Link asChild> di atas PressableScale:
             efek tekan tetap, tetapi web mendapat <a href> sungguhan dan
             screen reader mengumumkan "tautan", bukan "tombol". */}
          <RouteLink
            href={ROUTES.subscriptions}
            accessibilityLabel="Menu Langganan Kahade Plus"
            containerClassName="w-full"
            className="w-full overflow-hidden bg-surface p-4"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center bg-primary">
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

          {/* ── Bergabunglah dengan Komunitas Kami ──────────── */}
          <View className={cn(MENU_GROUP, "gap-3 p-4")}>
            <Text variant="bodyLarge" weight={600} tone="primary">
              Bergabunglah dengan Komunitas Kami
            </Text>

            <View className="flex-row flex-wrap items-center justify-between pt-1">
              {SOCIAL_COMMUNITIES.map((item) => (
                <PressableScale
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Buka komunitas ${item.label}`}
                  onPress={() => handleSocialPress(item)}
                  containerClassName={cn("items-center rounded-md", focusRing)}
                  className="h-12 w-12 items-center justify-center rounded-md bg-surface-elevated"
                >
                  <Icon icon={item.icon} size="md" tone="default" />
                </PressableScale>
              ))}
            </View>
          </View>

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
