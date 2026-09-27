/**
 * Kahade — <AppDrawer>: sidebar navigasi kiri (redesign drawer 2026-09-27).
 *
 * Struktur (sesuai spesifikasi user, dari atas):
 *   1. Header profil: foto di atas, nama + username di bawahnya (vertikal,
 *      rata kiri). TANPA chevron. Tombol X tepat di pojok kanan atas header.
 *   2. Kahade Plus — kartu section tersendiri yang menonjol.
 *   3. Menu utama: Profile, Dompet, Etalase, Template, Order Link, Laporan.
 *   4. Menu bawah: Umpan Balik, Bantuan Langsung, Tiket Bantuan
 *      (revisi 2026-09-28, permintaan produk).
 *   5. Utility bar di kaki drawer (revisi 2026-09-28): pil berisi
 *      gear (Pengaturan), pill pencarian expandable (→ /search?q=…),
 *      dan pensil (sheet global "Buat baru"). Motion saat diklik +
 *      expand/collapse pencarian; reduced motion = instan.
 *
 * Desain list: ikon TANPA background, varian Phosphor bold, judul BOLD,
 * TANPA chevron di semua item. Light/dark via token.
 *
 * Motion premium ala X (tidak diubah):
 * - panel meluncur dari kiri dengan spring `tokens.motion.spring`,
 * - backdrop memudar (fade),
 * - konten utama sedikit terdorong + mengecil (progress dibaca root layout
 *   dari `drawerProgress`),
 * - tutup via swipe kiri atau ketuk backdrop.
 *
 * Reduced motion: buka/tutup instan tanpa spring maupun efek dorong.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Dimensions, Pressable, ScrollView, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter, type Href } from "expo-router"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Reanimated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated"
import {
  ChartBar,
  ChatCircle,
  CrownSimple,
  FileText,
  Gear,
  Headset,
  LinkSimple,
  MagnifyingGlass,
  Pencil,
  SignIn,
  Storefront,
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
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { api, type UserProfile } from "@/lib/api"
import { closeDrawer, drawerProgress, useDrawerOpen } from "@/lib/drawer"
import { openCreateSheet } from "@/lib/create-sheet"
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
  /** Salah satu: href statis, atau aksi khusus (mis. profil yang sadar tamu). */
  href?: Href
  onPress?: () => void
  accessibilityLabel: string
}

/** Menu utama — urutan sesuai spesifikasi user. */
const MAIN_MENU: readonly DrawerMenuItem[] = [
  { id: "profile", label: "Profile", icon: User, accessibilityLabel: "Buka profil saya" },
  { id: "wallet", label: "Dompet", icon: Wallet, href: ROUTES.wallet, accessibilityLabel: "Buka dompet" },
  { id: "etalase", label: "Etalase", icon: Storefront, href: ROUTES.showcaseManagement, accessibilityLabel: "Buka etalase" },
  { id: "templates", label: "Template", icon: FileText, href: ROUTES.transactionTemplates, accessibilityLabel: "Buka template transaksi" },
  { id: "order-links", label: "Order Link", icon: LinkSimple, href: ROUTES.orderLinks, accessibilityLabel: "Buka order link" },
  { id: "reports", label: "Laporan", icon: ChartBar, href: ROUTES.reports(), accessibilityLabel: "Buka laporan saya" },
]

/** Menu bawah — revisi 2026-09-28 (permintaan produk). */
const BOTTOM_MENU: readonly DrawerMenuItem[] = [
  { id: "feedback", label: "Umpan Balik", icon: ChatCircle, href: ROUTES.feedback, accessibilityLabel: "Buka umpan balik" },
  { id: "live-support", label: "Bantuan Langsung", icon: Headset, href: ROUTES.liveSupport, accessibilityLabel: "Buka bantuan langsung" },
  { id: "support-tickets", label: "Tiket Bantuan", icon: Ticket, href: ROUTES.support, accessibilityLabel: "Buka tiket bantuan" },
]

const SPRING = tokens.motion.spring

/** Baris menu: ikon bold tanpa background + judul bold, tanpa chevron. */
export function DrawerMenuRow({
  item,
  onNavigate,
}: {
  item: DrawerMenuItem
  onNavigate: (item: DrawerMenuItem) => void
}) {
  return (
    <PressableScale
      onPress={() => onNavigate(item)}
      accessibilityRole="menuitem"
      accessibilityLabel={translate(item.accessibilityLabel)}
      className="flex-row items-center gap-4 px-5 py-3"
    >
      <Icon icon={item.icon} size="md" tone="active" weight="bold" />
      <Text variant="bodyLarge" weight={600} className="flex-1">
        {translate(item.label)}
      </Text>
    </PressableScale>
  )
}

/**
 * Utility bar di kaki drawer (revisi 2026-09-28, permintaan produk):
 *
 *   [ ⚙ ]  [ 🔍 Pencarian ]  [ ✏ ]
 *
 * - Gear → Pengaturan. Pensil → sheet global "Buat baru".
 * - Pill pencarian EXPANDABLE: ketuk → bar berubah jadi kolom input
 *   (fade in; reduced motion = instan), submit → /search?q=… , X → tutup.
 * - Pil hitam mode-aware: `primary` (hitam di light, putih di dark) dengan
 *   ikon/teks `inverse` — sesuai gambar referensi user.
 * - Motion saat diklik: PressableScale di tiap tombol + haptic ringan.
 */
function DrawerUtilityBar() {
  useLanguage()
  const router = useRouter()
  const { mode: themeMode } = useTheme()
  const reducedMotion = useReducedMotion()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<TextInput>(null)

  const barBg = modes[themeMode].primary
  const onBar = modes[themeMode].primaryForeground

  // Fokus ke input setelah expand (beri jeda animasi fade-in).
  useEffect(() => {
    if (!searchOpen) return
    const t = setTimeout(
      () => inputRef.current?.focus(),
      reducedMotion ? 0 : 160,
    )
    return () => clearTimeout(t)
  }, [searchOpen, reducedMotion])

  const goSettings = useCallback(() => {
    haptic("select")
    closeDrawer()
    router.push(ROUTES.settings)
  }, [router])

  const openSearch = useCallback(() => {
    haptic("light")
    setSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery("")
  }, [])

  const submitSearch = useCallback(() => {
    const q = query.trim()
    haptic("select")
    closeDrawer()
    closeSearch()
    router.push(
      (q ? { pathname: ROUTES.search, params: { q } } : ROUTES.search) as Href,
    )
  }, [query, router, closeSearch])

  const openCompose = useCallback(() => {
    haptic("select")
    closeDrawer()
    openCreateSheet()
  }, [])

  return (
    <View className="px-5 pb-1 pt-2">
      <View
        className="h-14 flex-row items-center rounded-full px-2"
        style={{ backgroundColor: barBg }}
        accessibilityRole="toolbar"
        accessibilityLabel={translate("Aksi cepat")}
      >
        {searchOpen ? (
          <Reanimated.View
            className="flex-1 flex-row items-center gap-1 pl-2"
            entering={reducedMotion ? undefined : FadeIn.duration(160)}
          >
            <Icon icon={MagnifyingGlass} size="md" tone="inverse" weight="bold" />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              placeholder={translate("Cari di Kahade…")}
              placeholderTextColor={`${onBar}99`}
              selectionColor={onBar}
              allowFontScaling
              maxFontSizeMultiplier={2}
              className="flex-1 py-2 font-sans-400 text-bodyLarge"
              style={{ color: onBar }}
              accessibilityLabel={translate("Kolom pencarian")}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={translate("Tutup pencarian")}
              haptic
              onPress={closeSearch}
              className="h-10 w-10 items-center justify-center rounded-full"
            >
              <Icon icon={X} size="md" tone="inverse" weight="bold" />
            </PressableScale>
          </Reanimated.View>
        ) : (
          <>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={translate("Pengaturan")}
              haptic
              onPress={goSettings}
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <Icon icon={Gear} size="md" tone="inverse" weight="bold" />
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={translate("Pencarian")}
              accessibilityHint={translate("Buka kolom pencarian")}
              haptic
              onPress={openSearch}
              className="flex-1 flex-row items-center justify-center gap-2"
            >
              <Icon icon={MagnifyingGlass} size="md" tone="inverse" weight="bold" />
              <Text
                variant="body"
                weight={600}
                style={{ color: onBar }}
                numberOfLines={1}
              >
                {translate("Pencarian")}
              </Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={translate("Buat baru")}
              accessibilityHint={translate("Membuka pilihan: buat karya, buat transaksi, atau isi saldo")}
              haptic
              onPress={openCompose}
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <Icon icon={Pencil} size="md" tone="inverse" weight="bold" />
            </PressableScale>
          </>
        )}
      </View>
    </View>
  )
}

export function AppDrawer() {
  useLanguage()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const open = useDrawerOpen()
  const { token } = useAuthSession()
  const reducedMotion = useReducedMotion()
  // Status langganan untuk badge kartu Kahade Plus (satu-satunya sumber
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

  const onNavigate = useCallback(
    (item: DrawerMenuItem) => {
      if (item.id === "profile") {
        goProfile()
        return
      }
      if (item.href) go(item.href)
    },
    [go, goProfile],
  )

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
          {/* Kepala: tumpukan vertikal (foto di atas, nama + username di
              bawahnya rata kiri) — tanpa chevron. Tombol X absolute tepat
              di pojok kanan atas header. */}
          <View className="relative px-5 pb-5 pt-6">
            {token && profile ? (
              <PressableScale
                onPress={goProfile}
                accessibilityRole="button"
                accessibilityLabel={translate("Buka profil saya")}
                className="gap-3 pr-12"
              >
                <Avatar
                  source={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined}
                  name={profile.fullName || profile.username || "Pengguna"}
                  size="lg"
                  verified={isKycVerified}
                />
                <View className="gap-0.5">
                  <View className="flex-row items-center gap-1.5">
                    <Text variant="bodyLarge" weight={700} numberOfLines={1}>
                      {profile.fullName || profile.username}
                    </Text>
                    {isKycVerified ? <Badge tone="success">KYC</Badge> : null}
                  </View>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    @{profile.username}
                  </Text>
                </View>
              </PressableScale>
            ) : (
              <View className="flex-row items-center gap-3 pr-12">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
                  <Icon icon={User} size="md" tone="active" weight="bold" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text variant="bodyLarge" weight={700}>
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
            {/* Tombol X: dibungkus View ber-style inline absolute agar tepat di
                pojok kanan atas header di semua platform (termasuk web).
                Style inline untuk positioning — bukan background — jadi aman
                dari masalah compile className di web. */}
            <View style={{ position: "absolute", right: 12, top: 20 }}>
              <PressableScale
                onPress={closeDrawer}
                accessibilityRole="button"
                accessibilityLabel={translate("Tutup menu")}
                className="h-10 w-10 items-center justify-center"
              >
                <Icon icon={X} size="md" tone="default" weight="bold" />
              </PressableScale>
            </View>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingVertical: 4 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Kahade Plus — section tersendiri yang menonjol.
                backgroundColor INLINE dari token (mode-aware, aman di web). */}
            <View className="px-5 pb-3">
              <PressableScale
                onPress={() => go(ROUTES.kahadePlusPlans)}
                accessibilityRole="menuitem"
                accessibilityLabel={translate("Menu langganan Kahade Plus")}
              >
                <View
                  style={{
                    backgroundColor: tokens.colors.accent[themeMode].bgSoft,
                    borderRadius: 16,
                    padding: 16,
                  }}
                  className="flex-row items-center gap-3"
                >
                  <Icon icon={CrownSimple} size="lg" tone="accent" weight="bold" />
                  <View className="flex-1 gap-0.5">
                    <Text variant="body" weight={700}>
                      {translate("Kahade Plus")}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {isPlusActive
                        ? translate("Langganan aktif")
                        : translate("Buka semua fitur premium")}
                    </Text>
                  </View>
                  {isPlusActive ? (
                    <Badge tone="success" variant="soft">
                      {translate("Aktif")}
                    </Badge>
                  ) : null}
                </View>
              </PressableScale>
            </View>

            {/* Menu utama. */}
            <View className="py-1">
              {MAIN_MENU.map((item) => (
                <DrawerMenuRow key={item.id} item={item} onNavigate={onNavigate} />
              ))}
            </View>

            <View className="px-5 py-3">
              <Divider />
            </View>

            {/* Menu bawah. */}
            <View className="pb-2">
              {BOTTOM_MENU.map((item) => (
                <DrawerMenuRow key={item.id} item={item} onNavigate={onNavigate} />
              ))}
            </View>
          </ScrollView>

          {/* Utility bar: gear · pill pencarian expandable · pensil
              (revisi 2026-09-28) — tetap di kaki, tidak ikut scroll. */}
          <DrawerUtilityBar />

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
