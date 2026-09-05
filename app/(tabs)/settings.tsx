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
 *
 * Keputusan non-obvious:
 *  - M6: skeleton profil pakai <Skeleton> + <SkeletonGroup> sistem —
 *    bukan animate-pulse manual — supaya animasi & aksesibilitas konsisten.
 *  - P6: error state getMe() ditampilkan eksplisit (teks + tombol retry),
 *    bukan silent fallback "—" yang membingungkan user.
 *  - Spacing memakai tokens.space[n] bukan angka literal.
 *  - router.push(route as Href) menggantikan `as any`.
 */
import { useCallback, useEffect, useState } from "react"
import { Alert, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href } from "expo-router"
import {
  Bell,
  Briefcase,
  CaretRight,
  FileText,
  Fingerprint,
  GridFour,
  Info,
  Landmark,
  Lock,
  MessageCircle,
  Question,
  Shield,
  User,
} from "phosphor-react-native"

import { getMe } from "@/lib/api/users"
import type { UserProfile } from "@/lib/api/users"
import { clearSession } from "@/lib/api/session"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
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
      { id: "faq", icon: Question, label: "FAQ", route: "/faq" },
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
// Skeleton placeholder profil (M6: pakai Skeleton sistem)
// ------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <SkeletonGroup>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.space[3],
          paddingVertical: tokens.space[4],
          paddingHorizontal: tokens.layout.screenPaddingX,
        }}
      >
        <Skeleton shape="circle" width={56} height={56} />
        <View style={{ gap: tokens.space[1] }}>
          <Skeleton height={16} width={144} />
          <Skeleton height={13} width={96} />
        </View>
      </View>
    </SkeletonGroup>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)

  // P6: error state getMe() — tampil eksplisit, bukan silent fallback
  const fetchProfile = useCallback(() => {
    setLoading(true)
    setProfileError(null)
    getMe()
      .then(setProfile)
      .catch(() => setProfileError("Gagal memuat profil."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleLogout = useCallback(() => {
    Alert.alert("Keluar", "Apakah kamu yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: async () => {
          await clearSession()
          router.replace(ROUTES.login as Href)
        },
      },
    ])
  }, [])

  return (
    <Screen edges={["top"]}>
      <Header title="Pengaturan" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + tokens.space[8],
        }}
      >
        {/* ── Header profil ────────────────────────────────── */}
        {loading ? (
          <ProfileSkeleton />
        ) : profileError ? (
          // P6: error eksplisit + tombol retry
          <View
            style={{
              paddingHorizontal: tokens.layout.screenPaddingX,
              paddingVertical: tokens.space[4],
              gap: tokens.space[2],
            }}
          >
            <Text variant="caption" tone="danger">{profileError}</Text>
            <Button variant="ghost" size="sm" onPress={fetchProfile}>
              Coba lagi
            </Button>
          </View>
        ) : (
          <PressableScale
            onPress={() => router.push("/edit-profile" as Href)}
            accessibilityLabel="Edit profil"
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.space[3],
                paddingVertical: tokens.space[4],
                paddingHorizontal: tokens.layout.screenPaddingX,
              }}
            >
              <Avatar
                name={profile?.name ?? ""}
                uri={profile?.avatarUrl}
                size="lg"
              />
              <View style={{ flex: 1 }}>
                <Text variant="h3">{profile?.name ?? "—"}</Text>
                {profile?.username ? (
                  <Text variant="body" tone="secondary">@{profile.username}</Text>
                ) : null}
              </View>
              <Icon icon={CaretRight} size="sm" tone="secondary" />
            </View>
          </PressableScale>
        )}

        <Divider />

        {/* ── Grup menu ────────────────────────────────────── */}
        {MENU_GROUPS.map((group, gi) => (
          <View key={group.title}>
            <ListGroup title={group.title}>
              {group.items.map((item, ii) => (
                <ListItem
                  key={item.id}
                  leftIcon={item.icon}
                  label={item.label}
                  badge={item.badge}
                  rightIcon={CaretRight}
                  divider={ii < group.items.length - 1}
                  onPress={
                    item.route
                      ? () => router.push(item.route! as Href)
                      : undefined
                  }
                />
              ))}
            </ListGroup>
            {gi < MENU_GROUPS.length - 1 && <Divider />}
          </View>
        ))}

        {/* ── Logout ───────────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: tokens.layout.screenPaddingX,
            paddingTop: tokens.space[8],
          }}
        >
          <Button
            variant="ghost"
            tone="danger"
            size="lg"
            onPress={handleLogout}
          >
            Keluar
          </Button>
        </View>
      </ScrollView>
    </Screen>
  )
}
