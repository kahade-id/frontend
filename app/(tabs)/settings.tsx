/**
 * Tab #5 — Pengaturan (Settings)
 *
 * Sesuai spesifikasi desain v1.1 & audit:
 *  - ProfileHeader dengan avatar, nama lengkap, @username, error & retry handling.
 *  - Tanpa separator garis (divider) antar item atau antar section.
 *  - Setiap kategori dibungkus dalam Card Gray (bg-surface) yang bersih & modern.
 *  - Card Utama: Langganan (Kahade Plus / Subscriptions).
 *  - Card 2: Edit Profil, Laporan, Keamanan, Tipe Akun.
 *  - Card 3: Tampilan, Notifikasi, Bahasa, Versi Aplikasi.
 *  - Card 4: Tentang Kami, Umpan Balik, Dukungan Langsung, Tiket Bantuan.
 *  - Card 5: Syarat & ketentuan, Kebijakan privasi.
 *  - Komunitas: Bergabunglah dengan Komunitas Kami (Telegram, X, Facebook, WhatsApp, Instagram, TikTok).
 *  - Logout: Konfirmasi Dialog destruktif + unregister push device + clear session.
 */
import { useCallback, useState } from "react"
import { Linking, View } from "react-native"
import { router, type Href } from "expo-router"
import {
  Bell,
  Briefcase,
  Buildings,
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
import { unregisterPushDevice } from "@/lib/push-notifications"
import { ROUTES } from "@/lib/routes"
import { installedAppVersion } from "@/lib/runtime-info"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ListItem } from "@/components/ui/list-item"
import { Dialog } from "@/components/ui/modal"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ProfileHeader } from "@/components/ui/profile-header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

// ------------------------------------------------------------------
// Data Menu & Komunitas
// ------------------------------------------------------------------

type MenuItemData = {
  id: string
  label: string
  subtitle?: string
  icon: IconComponent
  route: Href
  trailing?: string
  destructive?: boolean
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

export default function SettingsScreen() {
  const toast = useToast()
  const { preference } = useTheme()

  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Profile data query
  const profileQuery = useApiQuery<UserProfile>("user-me", () => api.users.getMe())
  const profile = profileQuery.data

  // Subscription status query
  const subscriptionQuery = useApiQuery<SubscriptionStatus | null>(
    "subscription-status",
    () => api.subscriptions.getSubscriptionStatus().catch(() => null),
  )
  const subStatus = subscriptionQuery.data
  const isSubscribed = Boolean(subStatus?.active)

  const handleRefresh = useCallback(async () => {
    await Promise.allSettled([profileQuery.refresh(), subscriptionQuery.refresh()])
  }, [profileQuery, subscriptionQuery])

  const handleItemPress = useCallback((route: Href) => {
    router.push(route)
  }, [])

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

  // Card 2: Edit Profil, Laporan, Keamanan, Tipe Akun
  const card2Items: MenuItemData[] = [
    {
      id: "edit-profile",
      label: "Edit Profil",
      subtitle: "Nama, bio, avatar & tautan publik",
      icon: User,
      route: ROUTES.editProfile,
    },
    {
      id: "reports",
      label: "Laporan",
      subtitle: "Daftar laporan & riwayat penanganan",
      icon: FileText,
      route: ROUTES.reports(),
    },
    {
      id: "security",
      label: "Keamanan",
      subtitle: "Password, PIN, 2FA & sesi aktif",
      icon: ShieldCheck,
      route: ROUTES.security,
    },
    {
      id: "account-type",
      label: "Tipe Akun",
      subtitle: "Status verifikasi & batas transaksi",
      icon: Briefcase,
      route: ROUTES.accountType,
    },
  ]

  // Card 3: Tampilan, Notifikasi, Bahasa, Versi Aplikasi
  const card3Items: MenuItemData[] = [
    {
      id: "appearance",
      label: "Tampilan",
      icon: Moon,
      route: ROUTES.appearance,
      trailing: themeLabel,
    },
    {
      id: "notifications",
      label: "Notifikasi",
      subtitle: "Preferensi push notifikasi & email",
      icon: Bell,
      route: ROUTES.notificationPreferences,
    },
    {
      id: "language",
      label: "Bahasa",
      icon: Translate,
      route: ROUTES.language,
      trailing: "Indonesia (ID)",
    },
    {
      id: "app-version",
      label: "Versi Aplikasi",
      icon: Info,
      route: ROUTES.appVersion,
      trailing: appVersionStr,
    },
  ]

  // Card 4: Tentang Kami, Umpan Balik, Dukungan Langsung, Tiket Bantuan
  const card4Items: MenuItemData[] = [
    {
      id: "about-us",
      label: "Tentang Kami",
      subtitle: "Informasi lengkap platform Kahade",
      icon: Buildings,
      route: ROUTES.faq,
    },
    {
      id: "feedback",
      label: "Umpan Balik",
      subtitle: "Kirim saran & evaluasi layanan",
      icon: ChatTeardropDots,
      route: ROUTES.contact,
    },
    {
      id: "live-support",
      label: "Dukungan Langsung",
      subtitle: "Chat langsung dengan tim bantuan",
      icon: Headset,
      route: ROUTES.chat,
    },
    {
      id: "support-tickets",
      label: "Tiket Bantuan",
      subtitle: "Riwayat & status tiket bantuan",
      icon: Lifebuoy,
      route: ROUTES.support,
    },
  ]

  // Card 5: Syarat & ketentuan, Kebijakan privasi
  const card5Items: MenuItemData[] = [
    {
      id: "terms",
      label: "Syarat & ketentuan",
      subtitle: "Ketentuan penggunaan platform",
      icon: Scales,
      route: ROUTES.terms,
    },
    {
      id: "privacy-policy",
      label: "Kebijakan privasi",
      subtitle: "Kebijakan perlindungan privasi data",
      icon: Shield,
      route: ROUTES.privacyPolicy,
    },
  ]

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
        {/* ── Profile Header ───────────────────────────────── */}
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
              loading={profileQuery.loading}
            />
          )}
        </View>

        <View className="gap-4 px-6 pt-3">
          {/* ── Card Utama: Langganan ───────────────────────── */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Menu Langganan Kahade Plus"
            onPress={() => router.push(ROUTES.subscriptions)}
            containerClassName="w-full"
            className="w-full overflow-hidden rounded-md border border-border bg-surface p-4"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-sm bg-primary">
                <Icon icon={CrownSimple} size="sm" tone="inverse" weight="fill" />
              </View>

              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-2">
                  <Text variant="body" weight={600} tone="primary">
                    Langganan
                  </Text>
                  <Badge tone={isSubscribed ? "success" : "neutral"} variant="soft">
                    {isSubscribed ? "Plus Aktif" : "Kahade Plus"}
                  </Badge>
                </View>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {isSubscribed
                    ? `Paket ${subStatus?.plan ?? "Premium"} aktif · Kelola langganan`
                    : "Bebas biaya transaksi & fitur prioritas"}
                </Text>
              </View>

              <Icon icon={CaretRight} size="sm" tone="default" />
            </View>
          </PressableScale>

          {/* ── Card 2: Akun & Keamanan ─────────────────────── */}
          <View className="w-full overflow-hidden rounded-md border border-border bg-surface">
            {card2Items.map((item) => (
              <ListItem
                key={item.id}
                title={item.label}
                subtitle={item.subtitle}
                leading={item.icon}
                chevron
                divider={false}
                padded={false}
                className="px-4 py-3"
                onPress={() => handleItemPress(item.route)}
              />
            ))}
          </View>

          {/* ── Card 3: Tampilan & Preferensi ────────────────── */}
          <View className="w-full overflow-hidden rounded-md border border-border bg-surface">
            {card3Items.map((item) => (
              <ListItem
                key={item.id}
                title={item.label}
                subtitle={item.subtitle}
                leading={item.icon}
                trailing={item.trailing}
                chevron
                divider={false}
                padded={false}
                className="px-4 py-3"
                onPress={() => handleItemPress(item.route)}
              />
            ))}
          </View>

          {/* ── Card 4: Bantuan & Layanan ────────────────────── */}
          <View className="w-full overflow-hidden rounded-md border border-border bg-surface">
            {card4Items.map((item) => (
              <ListItem
                key={item.id}
                title={item.label}
                subtitle={item.subtitle}
                leading={item.icon}
                chevron
                divider={false}
                padded={false}
                className="px-4 py-3"
                onPress={() => handleItemPress(item.route)}
              />
            ))}
          </View>

          {/* ── Card 5: Legal & Kebijakan ────────────────────── */}
          <View className="w-full overflow-hidden rounded-md border border-border bg-surface">
            {card5Items.map((item) => (
              <ListItem
                key={item.id}
                title={item.label}
                subtitle={item.subtitle}
                leading={item.icon}
                chevron
                divider={false}
                padded={false}
                className="px-4 py-3"
                onPress={() => handleItemPress(item.route)}
              />
            ))}
          </View>

          {/* ── Bergabunglah dengan Komunitas Kami ──────────── */}
          <View className="w-full gap-3 overflow-hidden rounded-md border border-border bg-surface p-4">
            <View className="gap-1">
              <Text variant="body" weight={600} tone="primary">
                Bergabunglah dengan Komunitas Kami
              </Text>
              <Text variant="caption" tone="secondary">
                Ikuti berita terbaru dan terhubung dengan komunitas Kahade.
              </Text>
            </View>

            <View className="flex-row flex-wrap items-center justify-between pt-1">
              {SOCIAL_COMMUNITIES.map((item) => (
                <PressableScale
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Buka komunitas ${item.label}`}
                  onPress={() => handleSocialPress(item)}
                  containerClassName="items-center"
                  className="h-12 w-12 items-center justify-center rounded-md border border-border bg-surface-elevated"
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
