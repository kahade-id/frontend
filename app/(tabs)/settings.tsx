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
 * Menu yang screen-nya belum dibuat menampilkan toast info (bukan push ke
 * route yang tidak ada) — ketika file route dibuat, cukup ganti handler.
 *
 * Data: GET /v1/users/me.
 */
import { useCallback, useEffect, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import {
  Bank,
  Bell,
  Briefcase,
  ChatCircleText,
  FileText,
  Fingerprint,
  GridFour,
  Info,
  Lock,
  Question,
  Shield,
  SignOut,
  User,
} from "phosphor-react-native"

import { api, type UserProfile } from "@/lib/api"
import { clearSession } from "@/lib/api/session"
import { useComingSoon } from "@/lib/navigation"
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
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

// ------------------------------------------------------------------
// Definisi menu
// ------------------------------------------------------------------

type MenuItem = {
  id: string
  icon: IconComponent
  label: string
  /** Route target; undefined = fitur belum ada (toast info). */
  route?: Href
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
      { id: "bank-account", icon: Bank, label: "Rekening Bank", route: ROUTES.bankAccounts },
      { id: "account-type", icon: Briefcase, label: "Tipe Akun", route: ROUTES.accountType },
    ],
  },
  {
    title: "Keamanan",
    items: [
      { id: "change-password", icon: Lock, label: "Ubah Password", route: ROUTES.changePassword },
      { id: "change-pin", icon: GridFour, label: "Ubah PIN", route: ROUTES.changePin },
      { id: "biometric", icon: Fingerprint, label: "Biometrik", route: ROUTES.biometricSettings },
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
]

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const comingSoon = useComingSoon()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const fetchProfile = useCallback(() => {
    setLoading(true)
    setProfileError(null)
    api.users
      .getMe()
      .then(setProfile)
      .catch(() => setProfileError("Gagal memuat profil."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleItemPress = useCallback(
    (item: MenuItem) => {
      if (item.route) {
        router.push(item.route)
        return
      }
      comingSoon(item.label)
    },
    [comingSoon],
  )

  const performLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      // Unregister push device SEBELUM token auth dihapus (endpoint butuh
      // access-token) — perangkat lama tidak menerima notifikasi akun ini.
      await unregisterPushDevice({
        registerDevice: (dto) => api.notifications.registerDevice(dto),
        unregisterDevice: () => api.notifications.unregisterDevice(),
      })
      await clearSession()
      router.replace(ROUTES.login as Href)
    } finally {
      setLoggingOut(false)
    }
  }, [router])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pengaturan" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
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
      </ScrollView>

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
