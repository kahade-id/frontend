/**
 * Kahade — <AppDrawer>: sidebar navigasi kiri (redesign navigasi mobile
 * 2026-09-27).
 *
 * Menggantikan tab "Lainnya" dan menampung semua fitur yang tidak lagi punya
 * slot di bottom navbar:
 *
 *   Profil Saya | Tersimpan | Template | Order Link | Kelola Etalase |
 *   Dompet | History | Voucher | Rekening Bank | Isi Saldo | Tarik Dana |
 *   Kahade Plus | Pengaturan (+ switcher mode Wallet/Etalase di dalamnya)
 *
 * Motion premium ala X:
 * - panel meluncur dari kiri dengan spring `tokens.motion.spring`,
 * - backdrop memudar (fade),
 * - konten utama sedikit terdorong + mengecil (progress dibaca root layout
 *   dari `drawerProgress`),
 * - tutup via swipe kiri atau ketuk backdrop.
 *
 * Reduced motion: buka/tutup instan tanpa spring maupun efek dorong.
 */
import { useCallback, useEffect, useState } from "react"
import { Dimensions, Pressable, ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter, type Href } from "expo-router"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated"
import {
  ArrowUpRight,
  Bank,
  BookmarkSimple,
  CaretRight,
  CrownSimple,
  FileText,
  Gear,
  LinkSimple,
  PencilSimpleLine,
  Plus,
  PlusCircle,
  Question,
  Scales,
  Scroll,
  SignIn,
  Ticket,
  User,
  Wallet,
  X,
} from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ModeSwitcher } from "@/components/ui/mode-switcher"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { api, type UserProfile } from "@/lib/api"
import { useAppMode } from "@/lib/app-mode"
import { closeDrawer, drawerProgress, useDrawerOpen } from "@/lib/drawer"
import { elevationStyle } from "@/lib/elevation"
import { haptic } from "@/lib/haptics"
import { useLanguage, translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { modes, tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { useAuthSession } from "@/lib/use-auth-session"
import { useKahadePlus } from "@/lib/use-kahade-plus"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { useTheme } from "@/components/theme-provider"

/** Lebar panel: 85% layar, maksimal 340dp. */
export const DRAWER_WIDTH = Math.min(
  340,
  Math.round(Dimensions.get("window").width * 0.85),
)

type DrawerMenuItem = {
  id: string
  label: string
  icon: IconComponent
  href: Href
  accessibilityLabel: string
}

/** Menu mode Etalase/E-commerce. */
const COMMERCE_MENU: readonly DrawerMenuItem[] = [
  { id: "saved", label: "Tersimpan", icon: BookmarkSimple, href: ROUTES.saved, accessibilityLabel: "Buka daftar tersimpan" },
  { id: "showcase-create", label: "Buat Karya", icon: Plus, href: ROUTES.showcaseCreate, accessibilityLabel: "Buat karya baru" },
  { id: "showcase-manage", label: "Kelola Etalase", icon: PencilSimpleLine, href: ROUTES.showcaseManagement, accessibilityLabel: "Kelola etalase" },
  { id: "order-links", label: "Order Link", icon: LinkSimple, href: ROUTES.orderLinks, accessibilityLabel: "Buka order link" },
  { id: "templates", label: "Template", icon: FileText, href: ROUTES.transactionTemplates, accessibilityLabel: "Buka template transaksi" },
  { id: "disputes", label: "Sengketa", icon: Scales, href: ROUTES.disputes, accessibilityLabel: "Buka sengketa" },
]

/** Menu mode Wallet/Dompet. */
const WALLET_MENU: readonly DrawerMenuItem[] = [
  { id: "wallet", label: "Dompet Saya", icon: Wallet, href: ROUTES.wallet, accessibilityLabel: "Buka dompet" },
  { id: "wallet-history", label: "History", icon: Scroll, href: ROUTES.walletHistory, accessibilityLabel: "Buka riwayat dompet" },
  { id: "vouchers", label: "Voucher", icon: Ticket, href: ROUTES.vouchers, accessibilityLabel: "Buka voucher" },
  { id: "bank-accounts", label: "Rekening Bank", icon: Bank, href: ROUTES.bankAccounts, accessibilityLabel: "Buka rekening bank" },
  { id: "topup", label: "Isi Saldo", icon: PlusCircle, href: ROUTES.topup, accessibilityLabel: "Isi saldo" },
  { id: "withdraw", label: "Tarik Dana", icon: ArrowUpRight, href: ROUTES.withdraw, accessibilityLabel: "Tarik dana" },
]

const SPRING = tokens.motion.spring

export function AppDrawer() {
  useLanguage()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const open = useDrawerOpen()
  const mode = useAppMode()
  const { token } = useAuthSession()
  const reducedMotion = useReducedMotion()
  // Status langganan untuk badge item menu Kahade Plus (satu-satunya sumber
  // status langganan di UI; aman untuk tamu — tidak menembak endpoint).
  const { isActive: isPlusActive } = useKahadePlus()
  const { mode: themeMode } = useTheme()
  const [mounted, setMounted] = useState(open)

  // Profil hanya diambil saat drawer dibuka (hemat query).
  const profileQuery = useApiQuery(
    "drawer:profile",
    (signal) => api.users.getMeCached(signal),
    open && Boolean(token),
  )
  const profile: UserProfile | null = profileQuery.data ?? null
  const isKycVerified = Boolean(
    (profile as unknown as { isKycVerified?: boolean } | null)?.isKycVerified,
  )

  // Sinkron status buka/tutup → animasi progress 0..1, lalu unmount.
  useEffect(() => {
    if (open) {
      setMounted(true)
      drawerProgress.value = reducedMotion ? 1 : withSpring(1, SPRING)
      return
    }
    if (reducedMotion) {
      drawerProgress.value = 0
      setMounted(false)
      return
    }
    drawerProgress.value = withSpring(0, SPRING, (finished) => {
      if (finished) runOnJS(setMounted)(false)
    })
  }, [open, reducedMotion])

  const go = useCallback(
    (href: Href) => {
      haptic("select")
      closeDrawer()
      router.push(href)
    },
    [router],
  )

  const goProfile = useCallback(() => {
    haptic("select")
    closeDrawer()
    if (!token || !profile?.username) {
      router.push(ROUTES.loginRequired("/showcase"))
      return
    }
    router.push(ROUTES.userProfile(profile.username))
  }, [profile?.username, router, token])

  const goLogin = useCallback(() => {
    haptic("select")
    closeDrawer()
    router.push(ROUTES.login)
  }, [router])

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (drawerProgress.value - 1) * DRAWER_WIDTH }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: drawerProgress.value * 0.5,
  }))

  // Swipe kiri untuk menutup; swipe kanan tidak membuka (hanya hamburger).
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      "worklet"
      drawerProgress.value = Math.min(1, Math.max(0, 1 + event.translationX / DRAWER_WIDTH))
    })
    .onEnd((event) => {
      "worklet"
      const shouldClose =
        event.translationX < -DRAWER_WIDTH * 0.3 || event.velocityX < -500
      if (shouldClose) {
        runOnJS(closeDrawer)()
      } else {
        drawerProgress.value = withSpring(1, SPRING)
      }
    })

  if (!mounted) return null

  const menu = mode === "wallet" ? WALLET_MENU : COMMERCE_MENU

  return (
    <View
      className="absolute inset-0"
      style={{ zIndex: tokens.zIndex.modal }}
      accessibilityRole="menu"
      accessibilityLabel={translate("Menu navigasi")}
    >
      {/* Backdrop memudar — ketuk untuk menutup. */}
      <Reanimated.View style={[{ flex: 1, backgroundColor: "#000" }, backdropStyle]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel={translate("Tutup menu")}
        />
      </Reanimated.View>

      {/* Panel kiri.
          backgroundColor INLINE (bukan className="bg-background"): className
          di Reanimated.View tidak ter-compile ke background di web
          (panel jadi transparan — bug 2026-09-27). Inline dari modes[]
          mode-aware dan konsisten di native + web. */}
      <GestureDetector gesture={pan}>
        <Reanimated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: DRAWER_WIDTH,
              backgroundColor: modes[themeMode].background,
              borderTopRightRadius: 20,
              borderBottomRightRadius: 20,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              ...elevationStyle("high", themeMode),
            },
            panelStyle,
          ]}
        >
          {/* Kepala: profil + tombol tutup. */}
          <View className="flex-row items-center gap-3 px-5 pb-4 pt-2">
            {token && profile ? (
              <PressableScale
                onPress={goProfile}
                accessibilityRole="button"
                accessibilityLabel={translate("Buka profil saya")}
                className="flex-1 flex-row items-center gap-3"
              >
                <Avatar
                  source={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined}
                  name={profile.fullName || profile.username || "Pengguna"}
                  size="lg"
                  verified={isKycVerified}
                />
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-1.5">
                    <Text variant="bodyLarge" weight={600} numberOfLines={1}>
                      {profile.fullName || profile.username}
                    </Text>
                    {isKycVerified ? <Badge tone="success">KYC</Badge> : null}
                  </View>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    @{profile.username}
                  </Text>
                </View>
                <Icon icon={CaretRight} size="sm" tone="default" />
              </PressableScale>
            ) : (
              <View className="flex-1 flex-row items-center gap-3">
                <View
                  className="h-12 w-12 items-center justify-center rounded-full bg-surface"
                >
                  <Icon icon={User} size="md" tone="default" />
                </View>
                <View className="flex-1">
                  <Text variant="bodyLarge" weight={600}>
                    {translate("Selamat datang")}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {translate("Masuk untuk akses penuh")}
                  </Text>
                </View>
                <Button size="sm" onPress={goLogin} accessibilityLabel={translate("Masuk")}>
                  {translate("Masuk")}
                </Button>
              </View>
            )}
            <PressableScale
              onPress={closeDrawer}
              accessibilityRole="button"
              accessibilityLabel={translate("Tutup menu")}
              className="h-10 w-10 items-center justify-center rounded-full"
            >
              <Icon icon={X} size="md" tone="default" />
            </PressableScale>
          </View>

          <Divider />

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingVertical: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Switcher mode Wallet/Etalase — pindahan dari tab bar lama,
                logikanya tidak diubah (ModeSwitcher yang sama). */}
            <View className="gap-2 px-5 py-3">
              <Text variant="caption" tone="secondary" weight={600}>
                {translate("Mode aplikasi").toUpperCase()}
              </Text>
              <ModeSwitcher showLabels />
            </View>

            <Divider />

            {/* Menu utama mengikuti mode aktif. */}
            <View className="py-2">
              <PressableScale
                onPress={goProfile}
                accessibilityRole="menuitem"
                accessibilityLabel={translate("Buka profil saya")}
                className="flex-row items-center gap-4 px-5 py-3"
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface"
                >
                  <Icon icon={User} size="md" tone="default" />
                </View>
                <Text variant="body" weight={500} className="flex-1">
                  {translate("Profil Saya")}
                </Text>
                <Icon icon={CaretRight} size="sm" tone="default" />
              </PressableScale>
              {menu.map((item) => (
                <PressableScale
                  key={item.id}
                  onPress={() => go(item.href)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={translate(item.accessibilityLabel)}
                  className="flex-row items-center gap-4 px-5 py-3"
                >
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full bg-surface"
                  >
                    <Icon icon={item.icon} size="md" tone="default" />
                  </View>
                  <Text variant="body" weight={500} className="flex-1">
                    {translate(item.label)}
                  </Text>
                  <Icon icon={CaretRight} size="sm" tone="default" />
                </PressableScale>
              ))}
            </View>

            <Divider />

            {/* Menu bawah: Kahade Plus + Pengaturan + Bantuan. */}
            <View className="py-2">
              <PressableScale
                onPress={() => go(ROUTES.kahadePlusPlans)}
                accessibilityRole="menuitem"
                accessibilityLabel={translate("Menu langganan Kahade Plus")}
                className="flex-row items-center gap-4 px-5 py-3"
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface"
                >
                  <Icon icon={CrownSimple} size="md" tone="default" />
                </View>
                <Text variant="body" weight={500} className="flex-1">
                  {translate("Kahade Plus")}
                </Text>
                {isPlusActive ? (
                  <Badge tone="success" variant="soft">
                    {translate("Aktif")}
                  </Badge>
                ) : null}
                <Icon icon={CaretRight} size="sm" tone="default" />
              </PressableScale>
              <PressableScale
                onPress={() => go(ROUTES.settings)}
                accessibilityRole="menuitem"
                accessibilityLabel={translate("Buka pengaturan")}
                className="flex-row items-center gap-4 px-5 py-3"
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface"
                >
                  <Icon icon={Gear} size="md" tone="default" />
                </View>
                <Text variant="body" weight={500} className="flex-1">
                  {translate("Pengaturan")}
                </Text>
                <Icon icon={CaretRight} size="sm" tone="default" />
              </PressableScale>
              <PressableScale
                onPress={() => go(ROUTES.support)}
                accessibilityRole="menuitem"
                accessibilityLabel={translate("Buka bantuan")}
                className="flex-row items-center gap-4 px-5 py-3"
              >
                <View
                  className="h-10 w-10 items-center justify-center rounded-full bg-surface"
                >
                  <Icon icon={Question} size="md" tone="default" />
                </View>
                <Text variant="body" weight={500} className="flex-1">
                  {translate("Bantuan")}
                </Text>
                <Icon icon={CaretRight} size="sm" tone="default" />
              </PressableScale>
            </View>
          </ScrollView>

          {/* Kaki: ajakan masuk untuk tamu. */}
          {!token ? (
            <View className="px-5 pb-2 pt-3">
              <Button
                variant="secondary"
                leftIcon={SignIn}
                onPress={goLogin}
                accessibilityLabel={translate("Masuk ke Kahade")}
              >
                {translate("Masuk ke Kahade")}
              </Button>
            </View>
          ) : null}
        </Reanimated.View>
      </GestureDetector>
    </View>
  )
}
