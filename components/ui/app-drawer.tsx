/**
 * Kahade — <AppDrawer>: sidebar navigasi kiri (spesifikasi produk 2026-10-05).
 *
 * Struktur (dari atas):
 *   1. Header profil: foto di atas, nama + username di bawahnya (vertikal,
 *      rata kiri). TANPA chevron. Tombol X tepat di pojok kanan atas header.
 *   2. Kahade Plus — kartu section tersendiri yang menonjol.
 *   3. Menu utama: Lihat Profil, Kelola Etalase (tab "Tersimpan" di
 *      dalamnya), Kelola Transaksi (deep-link section Kelola di tab
 *      Transaksi), Dompet Saya / Rekening Bank (kill-switch dompet),
 *      Buku Alamat, Laporan & Analitik (→ /analytics).
 *   4. Garis pemisah, lalu menu sekunder: Keamanan (hub akun + row Keluar),
 *      Pusat Bantuan (→ /faq), Bisnis (→ /business-verification).
 *      /settings DIHAPUS TOTAL — tidak ada lagi gear/Pengaturan di drawer.
 *   5. Utility bar di kaki drawer: toggle gelap/terang (matahari↔bulan
 *      Phosphor, animasi Reanimated), bidang pencarian yang selalu expanded
 *      dan langsung membuka /search saat ditekan, serta segmen bahasa
 *      inline ID|EN. /language DIHAPUS — tidak ada lagi pensil "Buat baru"
 *      (tiap halaman utama kini punya tombol Buat di header-nya).
 *   6. Teks versi mungil di bawah utility bar (→ /app-version).
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
 * Reduced motion: buka/tutup instan tanpa spring maupun efek dorong;
 * ikon tema berganti tanpa animasi putar.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { usePathname, useRouter, type Href } from "expo-router"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import {
  Bank,
  Briefcase,
  ChartBar,
  CrownSimple,
  Lifebuoy,
  MagnifyingGlass,
  MapPin,
  Moon,
  Receipt,
  ShieldCheck,
  SignIn,
  Storefront,
  Sun,
  User,
  Wallet,
  X,
} from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useOverlayDismissKeys } from "@/components/ui/backdrop"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { api, type UserProfile } from "@/lib/api"
import { closeDrawer, drawerProgress, useDrawerOpen } from "@/lib/drawer"
import { isShellTabPath } from "@/lib/shell-tabs"
import { setOpenOwnProfileAfterLogin } from "@/lib/login-redirect"
import { elevationStyle } from "@/lib/elevation"
import { haptic } from "@/lib/haptics"
import {
  getLanguage,
  markLanguagePendingSync,
  setLanguage,
  useLanguage,
  translate,
  type LanguageCode,
} from "@/lib/i18n"
import { showMutationError } from "@/lib/mutation-toast"
import { ROUTES } from "@/lib/routes"
import { installedAppVersion } from "@/lib/runtime-info"
import { modes, tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { useAuthSession } from "@/lib/use-auth-session"
import { useKahadePlus } from "@/lib/use-kahade-plus"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { useTheme } from "@/components/theme-provider"
import { hitSlopToReach } from "@/lib/hit-slop"
import {
  MAIN_MENU_META,
  SECONDARY_MENU_META,
  getMainMenuMeta,
  type DrawerMenuMeta,
} from "@/lib/drawer-menu"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"

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
  "bank-accounts": Bank,
  etalase: Storefront,
  "trx-manage": Receipt,
  addresses: MapPin,
  reports: ChartBar,
  security: ShieldCheck,
  "help-center": Lifebuoy,
  business: Briefcase,
}

function withIcons(
  meta: readonly DrawerMenuMeta[],
): readonly DrawerMenuItem[] {
  return meta.map((m) => ({ ...m, icon: MENU_ICONS[m.id] ?? User }))
}

/** Menu utama — label & urutan dari MAIN_MENU_META (revisi 2026-09-28).
 *
 * Kompat: snapshot statis saat flag NYALA. Pemakaian baru harus memakai
 * `useMainMenu()` (sadar kill-switch dompet) — lihat AppDrawer.
 */
export const MAIN_MENU: readonly DrawerMenuItem[] = withIcons(MAIN_MENU_META)

/**
 * Menu utama yang sadar kill-switch dompet (Mode Tanpa Wallet Internal,
 * BI-safe): flag false → "Dompet Saya" diganti "Rekening Bank".
 */
export function useMainMenu(): readonly DrawerMenuItem[] {
  const walletEnabled = useWalletEnabled()
  return useMemo(() => withIcons(getMainMenuMeta(walletEnabled)), [walletEnabled])
}

function hrefMatchesPath(href: Href | undefined, pathname: string): boolean {
  if (!href) return false
  const rawPath = typeof href === "string" ? href : href.pathname
  if (typeof rawPath !== "string") return false
  const target = rawPath.split(/[?#]/, 1)[0]?.replace(/\/$/, "") || "/"
  const current = pathname.replace(/\/$/, "") || "/"
  return current === target || (target !== "/" && current.startsWith(`${target}/`))
}

function isDrawerItemSelected(item: DrawerMenuItem, pathname: string): boolean {
  if (item.id === "profile") return pathname.startsWith("/user/")
  return hrefMatchesPath(item.href, pathname)
}

const SPRING = tokens.motion.spring

/** Baris menu: ikon bold tanpa background + judul bold, tanpa chevron. */
export function DrawerMenuRow({
  item,
  onNavigate,
  badge = false,
  selected = false,
}: {
  item: DrawerMenuItem
  onNavigate: (item: DrawerMenuItem) => void
  /** Dot unread di kanan judul (Pesan, Tiket Bantuan). */
  badge?: boolean
  selected?: boolean
}) {
  return (
    <PressableScale
      onPress={() => onNavigate(item)}
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      accessibilityLabel={
        badge
          ? translate("{x} — ada yang belum dibaca", {
              x: translate(item.accessibilityLabel),
            })
          : translate(item.accessibilityLabel)
      }
      className={`flex-row items-center gap-4 px-5 py-3 ${selected ? "bg-primary/10" : ""}`}
    >
      <Icon icon={item.icon} size="md" tone={selected ? "active" : "default"} weight="bold" />
      <Text variant="bodyLarge" weight={selected ? 700 : 600} className="flex-1">
        {translate(item.label)}
      </Text>
      {badge ? <View className="h-2 w-2 rounded-full bg-danger" /> : null}
    </PressableScale>
  )
}

/**
 * Toggle gelap/terang: ikon matahari↔bulan (Phosphor) bertukar dengan
 * animasi motion halus (putar + fade + scale) via Reanimated.
 *
 * LARANGAN KERAS yang dipatuhi: TIDAK ADA className="bg-..." (bahkan tidak
 * ada className sama sekali) di Reanimated.View — tidak ter-compile di web.
 * Latar tombol milik <PressableScale> (komponen dasar, className aman);
 * Reanimated.View hanya menganimasikan ikon.
 */
function ThemeToggleButton() {
  useLanguage()
  const { mode, toggle } = useTheme()
  const reducedMotion = useReducedMotion()
  const isDark = mode === "dark"

  const progress = useSharedValue(isDark ? 1 : 0)
  useEffect(() => {
    progress.value = reducedMotion
      ? (isDark ? 1 : 0)
      : withTiming(isDark ? 1 : 0, { duration: tokens.motion.duration.fast })
  }, [isDark, reducedMotion, progress])

  const sunStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { rotate: `${progress.value * 120}deg` },
      { scale: 1 - progress.value * 0.5 },
    ],
  }))
  const moonStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { rotate: `${(1 - progress.value) * -120}deg` },
      { scale: 0.5 + progress.value * 0.5 },
    ],
  }))

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        isDark ? translate("Aktifkan mode terang") : translate("Aktifkan mode gelap")
      }
      haptic
      onPress={toggle}
      className="h-12 w-12 items-center justify-center rounded-full bg-surface"
    >
      {/* Bingkai ikon polos — TANPA className (lihat LARANGAN di atas). */}
      <Reanimated.View
        style={{
          width: tokens.icon.size.md,
          height: tokens.icon.size.md,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Reanimated.View style={[{ position: "absolute" }, sunStyle]}>
          <Icon icon={Sun} size="md" tone="default" weight="bold" />
        </Reanimated.View>
        <Reanimated.View style={[{ position: "absolute" }, moonStyle]}>
          <Icon icon={Moon} size="md" tone="default" weight="bold" />
        </Reanimated.View>
      </Reanimated.View>
    </PressableScale>
  )
}

/**
 * Segmen bahasa inline ID|EN — pengganti layar /language yang DIHAPUS.
 * Pola app/language.tsx yang dipertahankan: optimistis (langsung berlaku di
 * seluruh aplikasi) + PUT backend; gagal → dikembalikan + pesan alasan.
 * Error mutasi via showMutationError (klasifikasi toast: error non-blokir).
 */
function LanguageSegment({ hasSession }: { hasSession: boolean }) {
  const language = useLanguage()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const change = useCallback(
    async (next: LanguageCode) => {
      if (next === getLanguage() || busy) return
      const previous = getLanguage()
      haptic("select")
      setBusy(true)
      setLanguage(next)
      /**
       * Audit Pengaturan 2026-10-10: tamu TIDAK punya sesi — PUT
       * /v1/settings/language (auth:"required") langsung melempar
       * UNAUTHORIZED, pilihan dikembalikan, dan tamu tidak pernah bisa
       * mengganti bahasa. Untuk tamu: simpan lokal + tandai agar diteruskan
       * ke akun saat masuk/mendaftar (<I18nProvider>).
       */
      if (!hasSession) {
        void markLanguagePendingSync()
        setBusy(false)
        return
      }
      try {
        await api.settings.updateLanguage({ language: next })
      } catch (err) {
        setLanguage(previous)
        showMutationError(toast.show, {
          failTitle: translate("Gagal menyimpan bahasa"),
          uncertainHint: translate("Periksa kembali bahasa aktif"),
          err,
          scope: "drawer:language",
        })
      } finally {
        setBusy(false)
      }
    },
    [busy, hasSession, toast.show],
  )

  return (
    <View
      className="h-12 flex-1 flex-row items-center rounded-full bg-surface p-1"
      accessibilityRole="radiogroup"
      accessibilityLabel={translate("Bahasa aplikasi")}
    >
      {(["id", "en"] as const).map((code) => {
        const active = language === code
        return (
          <PressableScale
            key={code}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            // F-10 (pola components/ui/radio.tsx): aria-checked eksplisit —
            // react-native-web tidak memetakan accessibilityState ke
            // aria-checked (role="radio" tanpa atribut wajibnya = pelanggaran
            // critical axe di web). Prop aria-* aman di native juga.
            aria-checked={active}
            accessibilityLabel={code === "id" ? "Bahasa Indonesia" : "English"}
            disabled={busy}
            onPress={() => void change(code)}
            containerClassName="h-full flex-1"
            className={`h-full flex-1 items-center justify-center rounded-full ${
              active ? "bg-background" : ""
            }`}
          >
            <Text variant="label" weight={active ? 700 : 500} tone={active ? "primary" : "secondary"}>
              {code === "id" ? "ID" : "EN"}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}

/**
 * Utility bar di kaki drawer (spesifikasi 2026-10-05): toggle gelap/terang,
 * bidang search yang selalu expanded (→ /search), dan segmen bahasa ID|EN.
 * Gear/Pengaturan dan pensil/Buat dihapus — /settings & /language ikut
 * dihapus total; tiap halaman utama kini punya tombol Buat di header-nya.
 */
function DrawerUtilityBar({ hasSession }: { hasSession: boolean }) {
  useLanguage()
  const router = useRouter()

  const openSearch = useCallback(() => {
    haptic("select")
    closeDrawer()
    router.push(ROUTES.search)
  }, [router])

  return (
    <View
      className="flex-row items-center gap-3 px-5 pb-1 pt-2"
      accessibilityRole="toolbar"
      accessibilityLabel={translate("Aksi cepat")}
    >
      <ThemeToggleButton />

      {/* Bidang search selalu expanded dan langsung membuka layar pencarian. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Pencarian")}
        accessibilityHint={translate("Buka kolom pencarian")}
        haptic
        onPress={openSearch}
        containerClassName="h-12 w-12 rounded-full bg-surface"
        className="h-12 w-12 items-center justify-center rounded-full"
      >
        <Icon icon={MagnifyingGlass} size="md" tone="default" weight="bold" />
      </PressableScale>

      <LanguageSegment hasSession={hasSession} />
    </View>
  )
}

/**
 * Teks versi mungil di kaki sidebar (pindahan "Versi Aplikasi" dari
 * /settings yang dihapus) — menaut ke /app-version (info rilis & pembaruan).
 */
function DrawerVersionFooter() {
  const router = useRouter()
  const version = installedAppVersion()
  return (
    <View className="items-center px-5 pb-1 pt-2">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Versi aplikasi {x}", { x: version ? `v${version}` : "—" })}
        onPress={() => {
          haptic("select")
          closeDrawer()
          router.push(ROUTES.appVersion)
        }}
        className="px-2 py-1"
      >
        <Text variant="caption" tone="tertiary">
          {version ? `v${version}` : "—"}
        </Text>
      </PressableScale>
    </View>
  )
}

export function AppDrawer() {
  useLanguage()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()
  const open = useDrawerOpen()
  const { token, restoring, error: sessionError } = useAuthSession()
  const reducedMotion = useReducedMotion()
  // WEB-013: lebar responsif — mengikuti resize jendela web.
  const drawerWidth = useDrawerWidth()
  // NAV-001 (2026-09-28): Back Android / Escape web menutup drawer dulu —
  // pola yang sama dengan overlay lain (useOverlayDismissKeys); handler
  // Android mengembalikan true agar route tidak ikut ter-pop.
  useOverlayDismissKeys(open, closeDrawer)
  // Status langganan untuk badge kartu Kahade Plus (satu-satunya sumber
  // status langganan di UI; aman untuk tamu — tidak menembak endpoint).
  const { isActive: isPlusActive } = useKahadePlus()
  // Mode Tanpa Wallet Internal (BI-safe): menu utama sadar kill-switch —
  // flag false → "Dompet Saya" diganti "Rekening Bank".
  const mainMenu = useMainMenu()
  const { mode: themeMode } = useTheme()
  const [mounted, setMounted] = useState(open)

  // Profil hanya diambil saat drawer dibuka (hemat query).
  const profileQuery = useApiQuery(
    "drawer:profile",
    (signal) => api.users.getMeCached(signal),
    open && Boolean(token),
  )
  // Query cache can outlive logout; never show a prior account's header when
  // the session store has no token, even while the next restore is pending.
  const profile: UserProfile | null = token ? profileQuery.data ?? null : null

  // Sidebar 2026-10-05: tidak ada lagi badge unread di drawer (item "Pesan"
  // sudah lama dihapus per UX-NAV-007; badge unread tetap di tab bawah).
  // Menu sekunder: Keamanan, Pusat Bantuan, Bisnis — di bawah garis pemisah.
  const secondaryMenu = useMemo(() => withIcons(SECONDARY_MENU_META), [])
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
      // T5-007 (audit UI/UX intuitif 2026-09-29): tujuan yang merupakan TAB
      // (Pesan, dll) memakai `navigate`, bukan `push` — tidak menumpuk layar
      // duplikat di atas stack sehingga tombol back sistem tetap masuk akal.
      // Layar stack (Dompet, Pengaturan, …) tetap `push`.
      const path = typeof href === "string" ? href : href.pathname ?? ""
      if (isShellTabPath(path)) router.navigate(href)
      else router.push(href)
    },
    [router],
  )

  const goProfile = useCallback(() => {
    haptic("select")
    closeDrawer()
    if (!token || !profile?.username) {
      // UX-NAV-014: tamu "Lihat Profil" → pasang flag "buka profil sendiri
      // setelah login"; resolvePostLoginTarget() membacanya di akhir alur
      // login dan mendarat di /user/<username>, bukan /showcase.
      setOpenOwnProfileAfterLogin(true)
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
  // UX-COL-010: base kini token overlay (0.4 light / 0.6 dark) — pengali
  // 0.5 lama hanya kompensasi base "#000" opak; tanpa pengali, hasil akhir
  // ≈ 0.5 lama (0.4/0.6 vs 0.5) dan konsisten dengan scrim lain.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: drawerProgress.value,
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
      {/* Backdrop memudar — ketuk untuk menutup.
          UX-COL-010: pakai token overlay (bukan literal "#000") agar konsisten
          dengan scrim BottomSheet/Modal/ActionSheet bila token disesuaikan. */}
      <Reanimated.View style={[{ flex: 1, backgroundColor: modes[themeMode].overlay }, backdropStyle]}>
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
              // §5: radius lg (12) — satu-satunya radius besar di sistem;
              // dulu 20 (di luar skala).
              borderTopRightRadius: tokens.radius.lg,
              borderBottomRightRadius: tokens.radius.lg,
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
            ) : token || restoring || sessionError ? (
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={translate("Memuat…")}
                className="flex-row items-center gap-3 pr-12"
              >
                <Skeleton shape="circle" width={64} height={64} />
                <View className="flex-1 gap-2">
                  <Skeleton width={144} height={16} />
                  <Skeleton width={88} height={12} />
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-3 pr-12">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
                  <Icon icon={User} size="md" tone="active" weight="bold" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text variant="bodyLarge" weight={700}>
                    {translate("Selamat datang")}
                  </Text>
                  <Text variant="bodySmall" tone="secondary">
                    {translate("Masuk untuk akses penuh")}
                  </Text>
                </View>
              </View>
            )}
            {/* Tombol X: dibungkus View ber-style inline absolute agar tepat di
                pojok kanan atas header di semua platform (termasuk web).
                Style inline untuk positioning — bukan background — jadi aman
                dari masalah compile className di web. */}
            <View style={{ position: "absolute", right: tokens.space[3], top: tokens.space[5] }}>
              <PressableScale
                onPress={closeDrawer}
                accessibilityRole="button"
                accessibilityLabel={translate("Tutup menu")}
                hitSlop={hitSlopToReach(40)}
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
                    // §5: kartu hero → radius lg (12); dulu 16 (di luar skala).
                    borderRadius: tokens.radius.lg,
                  }}
                  className="flex-row items-center gap-3 p-4"
                >
                  <Icon icon={CrownSimple} size="lg" tone="accent" weight="bold" />
                  <View className="flex-1 gap-0.5">
                    <Text variant="body" weight={700}>
                      {translate("Kahade Plus")}
                    </Text>
                    <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
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
              {mainMenu.map((item) => (
                <DrawerMenuRow
                  key={item.id}
                  item={item}
                  onNavigate={onNavigate}
                  selected={isDrawerItemSelected(item, pathname)}
                />
              ))}
            </View>

            <View className="px-5 py-3">
              <Divider />
            </View>

            {/* Menu sekunder: Keamanan, Pusat Bantuan, Bisnis. */}
            <View className="pb-2">
              {secondaryMenu.map((item) => (
                <DrawerMenuRow
                  key={item.id}
                  item={item}
                  onNavigate={onNavigate}
                  selected={isDrawerItemSelected(item, pathname)}
                />
              ))}
            </View>
          </ScrollView>

          {/* Utility bar tetap di kaki drawer dan tidak ikut scroll. */}
          <DrawerUtilityBar hasSession={Boolean(token)} />

          {/* Versi aplikasi — teks mungil (pindahan /settings) → /app-version. */}
          <DrawerVersionFooter />

          {/* Kaki: ajakan masuk untuk tamu. */}
          {!token && !restoring && !sessionError ? (
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
