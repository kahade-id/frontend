/**
 * Kahade — <AppDrawer>: sidebar navigasi kiri (redesign drawer 2026-09-27).
 *
 * Struktur (sesuai spesifikasi user, dari atas):
 *   1. Header profil: foto di atas, nama + username di bawahnya (vertikal,
 *      rata kiri). TANPA chevron. Tombol X tepat di pojok kanan atas header.
 *   2. Kahade Plus — kartu section tersendiri yang menonjol.
 *   3. Menu utama: Lihat Profil, Dompet Saya, Kelola Etalase,
 *      Template Transaksi, Order Link, Laporan & Analitik, Pesan
 *      (revisi label 2026-09-28). Dot unread di "Pesan" (store yang sama
 *      dengan badge tab — lib/chat-unread-count) dan "Tiket Bantuan"
 *      (dot = ada tiket terbuka; backend tidak punya unread per tiket).
 *   4. Menu bawah: Umpan Balik, Bantuan Langsung, Tiket Bantuan
 *      (revisi 2026-09-28, permintaan produk).
 *   5. Utility bar di kaki drawer (revisi 2026-09-28): TIGA circle card
 *      terpisah — gear (Pengaturan), search expandable (ketuk → melebar
 *      jadi kolom input di tempat, submit → /search?q=…), dan pensil
 *      (sheet global "Buat baru"). Masing-masing lingkaran ber-background
 *      modes[themeMode].primary + ikon inverse. Motion saat diklik +
 *      reduced motion = instan.
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
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from "react-native"
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
  ChatCenteredText,
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
import { hasOpenSupportTicket } from "@/lib/api/support"
import { refreshChatUnreadCount, useChatUnreadCountState } from "@/lib/chat-unread-count"
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
import {
  BOTTOM_MENU_META,
  MAIN_MENU_META,
  type DrawerMenuMeta,
} from "@/lib/drawer-menu"

/**
 * Lebar panel: 85% layar, maksimal 340dp.
 *
 * Hook (bukan konstanta module-level): `Dimensions.get("window")` hanya
 * dibaca SEKALI saat modul dimuat, sehingga resize/rotate jendela di web
 * tidak pernah memperbarui lebar drawer (audit web WEB-013).
 * `useWindowDimensions()` me-render ulang saat dimensi berubah — drawer
 * mengikuti ukuran jendela. Di native (hampir) tidak pernah resize, jadi
 * perilaku di sana identik dengan sebelumnya.
 */
function useDrawerWidth(): number {
  const { width } = useWindowDimensions()
  return Math.min(340, Math.round(width * 0.85))
}

type DrawerMenuItem = DrawerMenuMeta & {
  icon: IconComponent
  onPress?: () => void
}

/**
 * Ikon per id menu — metadata (label/href) hidup di `lib/drawer-menu.ts`
 * (modul murni, bisa di-unit-test); ikon Phosphor hanya ada di lapisan UI.
 */
const MENU_ICONS: Record<string, IconComponent> = {
  profile: User,
  wallet: Wallet,
  etalase: Storefront,
  templates: FileText,
  "order-links": LinkSimple,
  reports: ChartBar,
  messages: ChatCenteredText,
  feedback: ChatCircle,
  "live-support": Headset,
  "support-tickets": Ticket,
}

function withIcons(
  meta: readonly DrawerMenuMeta[],
): readonly DrawerMenuItem[] {
  return meta.map((m) => ({ ...m, icon: MENU_ICONS[m.id] ?? User }))
}

/** Menu utama — label & urutan dari MAIN_MENU_META (revisi 2026-09-28). */
export const MAIN_MENU: readonly DrawerMenuItem[] = withIcons(MAIN_MENU_META)

/** Menu bawah — revisi 2026-09-28 (permintaan produk). */
export const BOTTOM_MENU: readonly DrawerMenuItem[] = withIcons(BOTTOM_MENU_META)

const SPRING = tokens.motion.spring

/** Baris menu: ikon bold tanpa background + judul bold, tanpa chevron. */
export function DrawerMenuRow({
  item,
  onNavigate,
  badge = false,
}: {
  item: DrawerMenuItem
  onNavigate: (item: DrawerMenuItem) => void
  /** Dot unread di kanan judul (Pesan, Tiket Bantuan). */
  badge?: boolean
}) {
  return (
    <PressableScale
      onPress={() => onNavigate(item)}
      accessibilityRole="menuitem"
      accessibilityLabel={
        badge
          ? translate("{x} — ada yang belum dibaca", {
              x: translate(item.accessibilityLabel),
            })
          : translate(item.accessibilityLabel)
      }
      className="flex-row items-center gap-4 px-5 py-3"
    >
      <Icon icon={item.icon} size="md" tone="active" weight="bold" />
      <Text variant="bodyLarge" weight={600} className="flex-1">
        {translate(item.label)}
      </Text>
      {badge ? <View className="h-2 w-2 rounded-full bg-danger" /> : null}
    </PressableScale>
  )
}

/**
 * Utility bar di kaki drawer (revisi 2026-09-28, permintaan produk):
 *
 *   ( ⚙ )   ( 🔍 )              ( ✏ )
 *
 * TIGA circle card TERPISAH (bukan satu pil) — masing-masing lingkaran
 * dengan background `modes[themeMode].primary` dan ikon `inverse`, sesuai
 * gambar referensi awal user.
 *
 * - Gear → Pengaturan. Pensil → sheet global "Buat baru".
 * - Search EXPANDABLE: ketuk ikon search → lingkaran tengah melebar jadi
 *   kolom input di tempat (fade in; reduced motion = instan),
 *   submit → /search?q=… , X → tutup kembali jadi lingkaran.
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
    <View
      className="flex-row items-center gap-3 px-5 pb-1 pt-2"
      accessibilityRole="toolbar"
      accessibilityLabel={translate("Aksi cepat")}
    >
      {/* Lingkaran 1: Pengaturan. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Pengaturan")}
        haptic
        onPress={goSettings}
        className="h-12 w-12 items-center justify-center rounded-full bg-primary"
      >
        <Icon icon={Gear} size="md" tone="inverse" weight="bold" />
      </PressableScale>

      {/* Lingkaran 2: pencarian — ketuk → melebar jadi kolom input di tempat. */}
      <View className="flex-1 flex-row items-center">
        {searchOpen ? (
          <Reanimated.View
            entering={reducedMotion ? undefined : FadeIn.duration(160)}
            // Seluruh visual INLINE dari token (bukan className): className di
            // Reanimated.View diabaikan TOTAL di web — bukan cuma bg-*
            // (audit web WEB-010; bug 2026-09-27 hanya gejala pertamanya).
            style={{
              backgroundColor: barBg,
              height: tokens.space[12],
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.space[1],
              borderRadius: tokens.radius.full,
              paddingLeft: tokens.space[4],
              paddingRight: tokens.space[1],
            }}
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
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Pencarian")}
            accessibilityHint={translate("Buka kolom pencarian")}
            haptic
            onPress={openSearch}
            className="h-12 w-12 items-center justify-center rounded-full bg-primary"
          >
            <Icon icon={MagnifyingGlass} size="md" tone="inverse" weight="bold" />
          </PressableScale>
        )}
      </View>

      {/* Lingkaran 3: Buat baru. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Buat baru")}
        accessibilityHint={translate("Membuka pilihan: buat karya, buat transaksi, atau isi saldo")}
        haptic
        onPress={openCompose}
        className="h-12 w-12 items-center justify-center rounded-full bg-primary"
      >
        <Icon icon={Pencil} size="md" tone="inverse" weight="bold" />
      </PressableScale>
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
  // WEB-013: lebar responsif — mengikuti resize jendela web.
  const drawerWidth = useDrawerWidth()
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

  // Badge unread "Pesan": store yang SAMA dengan badge tab chat
  // (lib/chat-unread-count) — drawer hanya membaca snapshot; bila store
  // masih idle (mis. drawer dibuka dari layar non-tab), picu satu refresh
  // ringan ke endpoint yang sama dengan polling tab.
  const chatUnread = useChatUnreadCountState()
  useEffect(() => {
    if (open && token && chatUnread.status === "idle") {
      void refreshChatUnreadCount()
    }
  }, [open, token, chatUnread.status])

  // Badge "Tiket Bantuan": daftar tiket hanya diambil saat drawer dibuka —
  // endpoint yang sama dengan layar daftar tiket, hasilnya di-cache
  // useApiQuery per key. Backend tidak punya penanda unread per tiket
  // (tanpa API baru), jadi dot = ada tiket berstatus terbuka.
  const ticketsQuery = useApiQuery(
    "drawer:support-tickets",
    (signal) => api.support.listSupportTickets(signal),
    open && Boolean(token),
  )
  const hasOpenTicket = hasOpenSupportTicket(ticketsQuery.data ?? [])

  const badgeFor = (id: string): boolean => {
    if (id === "messages") return (chatUnread.count ?? 0) > 0
    if (id === "support-tickets") return hasOpenTicket
    return false
  }
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
    transform: [{ translateX: (drawerProgress.value - 1) * drawerWidth }],
  }))
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: drawerProgress.value * 0.5,
  }))

  // Swipe kiri untuk menutup; swipe kanan tidak membuka (hanya hamburger).
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      "worklet"
      drawerProgress.value = Math.min(1, Math.max(0, 1 + event.translationX / drawerWidth))
    })
    .onEnd((event) => {
      "worklet"
      const shouldClose =
        event.translationX < -drawerWidth * 0.3 || event.velocityX < -500
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
              width: drawerWidth,
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
                <DrawerMenuRow
                  key={item.id}
                  item={item}
                  onNavigate={onNavigate}
                  badge={badgeFor(item.id)}
                />
              ))}
            </View>

            <View className="px-5 py-3">
              <Divider />
            </View>

            {/* Menu bawah. */}
            <View className="pb-2">
              {BOTTOM_MENU.map((item) => (
                <DrawerMenuRow
                  key={item.id}
                  item={item}
                  onNavigate={onNavigate}
                  badge={badgeFor(item.id)}
                />
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
