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
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"

import { getMe } from "@/lib/api/users"
import type { UserProfile } from "@/lib/api/users"
import { clearSession } from "@/lib/api/session"
import { ROUTES } from "@/lib/routes"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

// ------------------------------------------------------------------
// Definisi menu
// ------------------------------------------------------------------

type MenuItem = {
  id: string
  icon: string
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
      { id: "edit-profile", icon: "user", label: "Edit Profil", route: "/edit-profile" },
      { id: "bank-account", icon: "landmark", label: "Rekening Bank", route: "/bank-accounts" },
      { id: "account-type", icon: "briefcase", label: "Tipe Akun", route: "/account-type" },
    ],
  },
  {
    title: "Keamanan",
    items: [
      { id: "change-password", icon: "lock", label: "Ubah Password", route: "/change-password" },
      { id: "change-pin", icon: "grid-2x2", label: "Ubah PIN", route: "/change-pin" },
      { id: "biometric", icon: "fingerprint", label: "Biometrik", route: "/biometric-settings" },
    ],
  },
  {
    title: "Notifikasi",
    items: [
      {
        id: "notif-prefs",
        icon: "bell",
        label: "Preferensi Notifikasi",
        route: "/notification-preferences",
      },
    ],
  },
  {
    title: "Bantuan",
    items: [
      { id: "faq", icon: "circle-help", label: "FAQ", route: "/faq" },
      { id: "contact", icon: "message-circle", label: "Hubungi Kami", route: "/contact" },
    ],
  },
  {
    title: "Tentang",
    items: [
      { id: "app-version", icon: "info", label: "Versi Aplikasi", route: "/app-version" },
      { id: "privacy", icon: "shield", label: "Kebijakan Privasi", route: "/privacy-policy" },
      { id: "tos", icon: "file-text", label: "Syarat & Ketentuan", route: "/terms" },
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
        {/* Profil card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push("/edit-profile" as any)}
          activeOpacity={0.75}
        >
          <Avatar
            uri={profile?.avatarUrl ?? null}
            name={profile?.fullName ?? "—"}
            size={56}
            loading={loading}
          />
          <View style={styles.profileInfo}>
            <Text variant="label" numberOfLines={1}>
              {profile?.fullName ?? "—"}
            </Text>
            <Text variant="caption" color="muted" numberOfLines={1}>
              @{profile?.username ?? "—"}
            </Text>
          </View>
          <Icon name="chevron-right" size={18} color="muted" />
        </TouchableOpacity>

        <Divider style={styles.divider} />

        {/* Menu groups */}
        {MENU_GROUPS.map((group, gi) => (
          <View key={group.title} style={gi > 0 ? styles.groupGap : undefined}>
            <Text variant="overline" color="muted" style={styles.groupTitle}>
              {group.title}
            </Text>

            <View style={styles.group}>
              {group.items.map((item, ii) => (
                <View key={item.id}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleMenuPress(item)}
                    activeOpacity={0.7}
                  >
                    <Icon name={item.icon} size={20} style={styles.menuIcon} />
                    <Text variant="body" style={styles.menuLabel}>
                      {item.label}
                    </Text>
                    {item.badge ? (
                      <View style={styles.badge}>
                        <Text variant="caption" color="inverse" style={styles.badgeText}>
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                    <Icon name="chevron-right" size={16} color="faint" />
                  </TouchableOpacity>
                  {ii < group.items.length - 1 && <Divider indent={52} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <Button
          variant="danger-outline"
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
    gap: 0,
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
  group: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 4,
    gap: 12,
  },
  menuIcon: {
    width: 24,
    alignItems: "center",
  },
  menuLabel: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E53E3E",
  },
  badgeText: {
    fontSize: 11,
  },
  logoutBtn: {
    marginTop: 32,
  },
})
