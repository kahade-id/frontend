/**
 * Tab #5 — Pengaturan
 *
 * Menampilkan:
 *  - <ProfileHeader> sistem (avatar, nama, @username, skeleton, error state)
 *  - Grup menu <ListGroup>/<ListItem> — semua path dari lib/routes.ts,
 *    TIDAK ada string route literal.
 *  - Logout: unregister push device dulu (`POST /v1/notifications/
 *    unregister-device`), baru clearSession() + redirect ke login.
 *
 * Semua menu menunjuk ke screen yang ada (audit #15: 30+ layar yang
 * sebelumnya tidak punya pintu masuk kini dikelompokkan di sini). Item
 * "Hapus Akun" dirender `destructive`.
 *
 * Data: GET /v1/users/me.
 */
import { useCallback, useEffect, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import {
  Bank,
  Bell,
  Briefcase,
  ChartLineUp,
  ChatCircleDots,
  ChatCircleText,
  Compass,
  CrownSimple,
  DeviceMobile,
  EyeSlash,
  FileText,
  Fingerprint,
  Gift,
  GridFour,
  Heart,
  IdentificationCard,
  Images,
  Info,
  Lifebuoy,
  LinkSimple,
  Lock,
  Medal,
  Prohibit,
  Question,
  Scales,
  Shield,
  ShieldCheck,
  ShieldStar,
  SignOut,
  Star,
  Ticket,
  Translate,
  Trash,
  User,
  Copy as CopyIcon,
} from "phosphor-react-native"

import { api, type UserProfile } from "@/lib/api"
import { clearSession } from "@/lib/api/session"
import { unregisterPushDevice } from "@/lib/push-notifications"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Header } from "@/components/ui/header"
import type { IconComponent } from "@/components/ui/icon"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { Dialog } from "@/components/ui/modal"
import { ProfileHeader } from "@/components/ui/profile-header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

// ------------------------------------------------------------------
// Definisi menu
// ------------------------------------------------------------------

type MenuItem = {
  id: string
  icon: IconComponent
  label: string
  /** Route target — semua menu sudah punya screen. */
  route: Href
  /** Aksi merusak (hapus akun) — teks & ikon danger */
  destructive?: boolean
}

type MenuGroup = {
  title: string
  items: MenuItem[]
}

const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Akun",
    items: [
      { id: "edit-profile", icon: User, label: "Edit Profil", route: ROUTES.editProfile },
      {
        id: "kyc",
        icon: IdentificationCard,
        label: "Verifikasi Identitas (KYC)",
        route: ROUTES.kyc,
      },
      { id: "bank-account", icon: Bank, label: "Rekening Bank", route: ROUTES.bankAccounts },
      { id: "account-type", icon: Briefcase, label: "Tipe Akun", route: ROUTES.accountType },
      {
        id: "subscriptions",
        icon: CrownSimple,
        label: "Langganan Premium",
        route: ROUTES.subscriptions,
      },
      { id: "referral", icon: Gift, label: "Referral", route: ROUTES.referral },
      { id: "language", icon: Translate, label: "Bahasa", route: ROUTES.language },
    ],
  },
  {
    title: "Profil publik",
    items: [
      { id: "showcase", icon: Images, label: "Showcase", route: ROUTES.showcase },
      { id: "questions", icon: ChatCircleDots, label: "Tanya Jawab", route: ROUTES.questions },
      { id: "ratings", icon: Star, label: "Ulasan Saya", route: ROUTES.ratings },
      { id: "badges", icon: Medal, label: "Lencana", route: ROUTES.badges },
      { id: "trust-score", icon: ShieldStar, label: "Skor Kepercayaan", route: ROUTES.trustScore },
      { id: "analytics", icon: ChartLineUp, label: "Analitik", route: ROUTES.analytics },
    ],
  },
  {
    title: "Transaksi",
    items: [
      { id: "order-links", icon: LinkSimple, label: "Order Link Saya", route: ROUTES.orderLinks },
      {
        id: "templates",
        icon: CopyIcon,
        label: "Template Transaksi",
        route: ROUTES.transactionTemplates,
      },
      { id: "vouchers", icon: Ticket, label: "Voucher", route: ROUTES.vouchers },
      { id: "disputes", icon: Scales, label: "Sengketa Saya", route: ROUTES.disputes },
      { id: "favorites", icon: Heart, label: "Favorit", route: ROUTES.favorites },
      { id: "discover", icon: Compass, label: "Jelajahi Pengguna", route: ROUTES.discover },
    ],
  },
  {
    title: "Keamanan",
    items: [
      { id: "change-password", icon: Lock, label: "Ubah Password", route: ROUTES.changePassword },
      { id: "change-pin", icon: GridFour, label: "Ubah PIN", route: ROUTES.changePin },
      { id: "biometric", icon: Fingerprint, label: "Biometrik", route: ROUTES.biometricSettings },
      {
        id: "two-factor",
        icon: ShieldCheck,
        label: "Autentikasi Dua Faktor",
        route: ROUTES.twoFactor,
      },
      {
        id: "security",
        icon: DeviceMobile,
        label: "Perangkat & Aktivitas",
        route: ROUTES.security,
      },
      { id: "privacy-settings", icon: EyeSlash, label: "Privasi", route: ROUTES.privacySettings },
      { id: "blocked", icon: Prohibit, label: "Pengguna Diblokir", route: ROUTES.blockedUsers },
    ],
  },
  {
    title: "Notifikasi",
    items: [
      {
        id: "notif-prefs",
        icon: Bell,
        label: "Preferensi Notifikasi",
        route: ROUTES.notificationPreferences,
      },
    ],
  },
  {
    title: "Bantuan",
    items: [
      { id: "support", icon: Lifebuoy, label: "Tiket Bantuan", route: ROUTES.support },
      { id: "faq", icon: Question, label: "FAQ", route: ROUTES.faq },
      { id: "contact", icon: ChatCircleText, label: "Hubungi Kami", route: ROUTES.contact },
    ],
  },
  {
    title: "Tentang",
    items: [
      { id: "app-version", icon: Info, label: "Versi Aplikasi", route: ROUTES.appVersion },
      { id: "privacy", icon: Shield, label: "Kebijakan Privasi", route: ROUTES.privacyPolicy },
      { id: "tos", icon: FileText, label: "Syarat & Ketentuan", route: ROUTES.terms },
    ],
  },
  {
    title: "Zona berbahaya",
    items: [
      {
        id: "delete-account",
        icon: Trash,
        label: "Hapus Akun",
        route: ROUTES.deleteAccount,
        destructive: true,
      },
    ],
  },
]

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const [refreshing, setRefreshing] = useState(false)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const fetchProfile = useCallback(() => {
    setLoading(true)
    setProfileError(null)
    return api.users
      .getMe()
      .then(setProfile)
      .catch(() => setProfileError("Gagal memuat profil."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProfile()
    setRefreshing(false)
  }, [fetchProfile])

  const handleItemPress = useCallback((item: MenuItem) => {
    router.push(item.route)
  }, [])

  const performLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      // Unregister push device SEBELUM token auth dihapus (endpoint butuh
      // access-token) — perangkat lama tidak menerima notifikasi akun ini.
      await unregisterPushDevice({
        registerDevice: (dto) => api.notifications.registerDevice(dto),
        unregisterDevice: () => api.notifications.unregisterDevice(),
      }).catch(() => undefined)
      try {
        await api.auth.logout().catch(() => undefined)
      } finally {
        await clearSession()
      }
      router.replace(ROUTES.login as Href)
    } finally {
      setLoggingOut(false)
    }
  }, [router])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header showBack={false} title="Pengaturan" />

      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {/* ── Header profil ────────────────────────────────── */}
        {profileError ? (
          <View style={styles.profileError}>
            <Text variant="body" tone="danger">
              {profileError}
            </Text>
            <Button variant="ghost" size="sm" fullWidth={false} onPress={fetchProfile}>
              Coba lagi
            </Button>
          </View>
        ) : (
          <ProfileHeader
            name={profile?.fullName ?? "—"}
            handle={profile?.username ? `@${profile.username}` : undefined}
            avatar={{ source: profile?.avatarUrl ?? undefined }}
            loading={loading}
          />
        )}

        <Divider />

        {/* ── Grup menu ────────────────────────────────────── */}
        {MENU_GROUPS.map((group, gi) => (
          <View key={group.title} style={styles.group}>
            <Text variant="label" tone="secondary" style={styles.groupTitle}>
              {group.title}
            </Text>
            <ListGroup>
              {group.items.map((item, ii) => (
                <ListItem
                  key={item.id}
                  title={item.label}
                  leading={item.icon}
                  chevron
                  destructive={item.destructive}
                  divider={ii < group.items.length - 1}
                  onPress={() => handleItemPress(item)}
                />
              ))}
            </ListGroup>
            {gi < MENU_GROUPS.length - 1 ? <Divider /> : null}
          </View>
        ))}

        {/* ── Logout ───────────────────────────────────────── */}
        <View style={styles.logout}>
          <Button variant="destructive" size="md" onPress={() => setLogoutOpen(true)}>
            Keluar
          </Button>
        </View>
      </PullToRefresh>

      {/* Konfirmasi destructive — <Dialog> sistem (berfungsi di web & native,
          tidak seperti Alert.alert yang no-op di react-native-web). */}
      <Dialog
        visible={logoutOpen}
        tone="danger"
        destructive
        icon={SignOut}
        title="Keluar dari Kahade?"
        description="Perangkat ini akan berhenti menerima notifikasi akun. Kamu bisa masuk kembali kapan saja."
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

const styles = StyleSheet.create({
  profileError: {
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.screenPaddingX,
    paddingVertical: tokens.space[4],
  },
  group: {
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.screenPaddingX,
    paddingTop: tokens.space[4],
  },
  groupTitle: {
    paddingHorizontal: tokens.space[1],
  },
  logout: {
    paddingHorizontal: tokens.layout.screenPaddingX,
    paddingTop: tokens.space[8],
  },
})
