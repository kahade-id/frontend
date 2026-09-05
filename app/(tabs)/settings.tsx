/**
 * Tab #5 — Pengaturan
 *
 * Menampilkan:
 *  - Header profil (avatar, nama, username)
 *  - Grup menu: Akun, Keamanan, Notifikasi, Bantuan, Tentang
 *  - Tombol Logout di bagian bawah
 *
 * Data:
 *  - getMe() → profil user
 *  - Logout: panggil clearSession() lalu redirect ke ROUTES.login
 */
import { useCallback, useEffect, useState } from "react"
import { Alert, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import {
  Bell,
  Briefcase,
  CaretRight,
  CircleHalf,
  FileText,
  Fingerprint,
  GridFour,
  Info,
  Landmark,
  Lock,
  MessageCircle,
  Shield,
  User,
} from "phosphor-react-native"

import { getMe } from "@/lib/api/users"
import type { UserProfile } from "@/lib/api/users"
import { clearSession } from "@/lib/api/session"
import { ROUTES } from "@/lib/routes"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

// ------------------------------------------------------------------
// Definisi menu
// ------------------------------------------------------------------

type MenuItem = {
  id: string
  icon: IconComponent
  label: string
  route?: string
  badge?: string
}

type MenuGroup = {
  title: string
  items: MenuItem[]
}

const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Akun",
    items: [
      { id: "edit-profile", icon: User, label: "Edit Profil", route: "/edit-profile" },
      { id: "bank-account", icon: Landmark, label: "Rekening Bank", route: "/bank-accounts" },
      { id: "account-type", icon: Briefcase, label: "Tipe Akun", route: "/account-type" },
    ],
  },
  {
    title: "Keamanan",
    items: [
      { id: "change-password", icon: Lock, label: "Ubah Password", route: "/change-password" },
      { id: "change-pin", icon: GridFour, label: "Ubah PIN", route: "/change-pin" },
      { id: "biometric", icon: Fingerprint, label: "Biometrik", route: "/biometric-settings" },
    ],
  },
  {
    title: "Notifikasi",
    items: [
      {
        id: "notif-prefs",
        icon: Bell,
        label: "Preferensi Notifikasi",
        route: "/notification-preferences",
      },
    ],
  },
  {
    title: "Bantuan",
    items: [
      { id: "faq", icon: CircleHalf, label: "FAQ", route: "/faq" },
      { id: "contact", icon: MessageCircle, label: "Hubungi Kami", route: "/contact" },
    ],
  },
  {
    title: "Tentang",
    items: [
      { id: "app-version", icon: Info, label: "Versi Aplikasi", route: "/app-version" },
      { id: "privacy", icon: Shield, label: "Kebijakan Privasi", route: "/privacy-policy" },
      { id: "tos", icon: FileText, label: "Syarat & Ketentuan", route: "/terms" },
    ],
  },
]

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    getMe()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleMenuPress = useCallback((item: MenuItem) => {
    if (item.route) router.push(item.route as any)
  }, [])

  const handleLogout = useCallback(() => {
    Alert.alert("Keluar", "Apakah kamu yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true)
          try {
            await clearSession()
          } catch {
            // Tetap logout meski API gagal
          } finally {
            setLoggingOut(false)
            router.replace(ROUTES.login)
          }
        },
      },
    ])
  }, [])

  return (
    <Screen edges={["top"]}>
      <Header title="Pengaturan" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profil card — PressableScale konsisten dengan sistem */}
        <PressableScale
          style={styles.profileCard}
          onPress={() => router.push("/edit-profile" as any)}
          scaleOnPress={false}
          accessibilityRole="button"
          accessibilityLabel="Edit profil"
        >
          {/* source menerima string URL atau ImageSourcePropType; size enum xs|sm|md|lg|xl */}
          <Avatar
            source={profile?.avatarUrl ?? undefined}
            name={profile?.fullName ?? "—"}
            size="lg"
          />
          <View style={styles.profileInfo}>
            <Text variant="label" numberOfLines={1}>
              {profile?.fullName ?? "—"}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              @{profile?.username ?? "—"}
            </Text>
          </View>
          <Icon icon={CaretRight} size="sm" />
        </PressableScale>

        <Divider style={styles.divider} />

        {/* Menu groups — ListItem + ListGroup dari sistem */}
        {MENU_GROUPS.map((group, gi) => (
          <View key={group.title} style={gi > 0 ? styles.groupGap : undefined}>
            <Text variant="overline" tone="secondary" style={styles.groupTitle}>
              {group.title}
            </Text>

            <ListGroup>
              {group.items.map((item, ii) => (
                <ListItem
                  key={item.id}
                  title={item.label}
                  leading={item.icon}
                  trailing={
                    item.badge ? (
                      <View className="rounded-full bg-danger px-2 py-[2px]">
                        <Text variant="caption" tone="inverse">
                          {item.badge}
                        </Text>
                      </View>
                    ) : undefined
                  }
                  chevron
                  divider={ii < group.items.length - 1}
                  inset
                  onPress={() => handleMenuPress(item)}
                />
              ))}
            </ListGroup>
          </View>
        ))}

        {/* Logout — variant destructive (bukan danger-outline yang tidak ada) */}
        <Button
          variant="destructive"
          onPress={handleLogout}
          loading={loggingOut}
          style={styles.logoutBtn}
          fullWidth
        >
          Keluar
        </Button>
      </ScrollView>
    </Screen>
  )
}

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  profileInfo: {
    flex: 1,
  },
  divider: {
    marginVertical: 8,
  },
  groupGap: {
    marginTop: 20,
  },
  groupTitle: {
    marginBottom: 6,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  logoutBtn: {
    marginTop: 32,
  },
})
