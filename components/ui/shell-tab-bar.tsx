/**
 * Kahade — navbar bawah bersama untuk E-Commerce dan E-Wallet.
 *
 * Satu struktur (tinggi, lingkaran tengah, lima slot). Yang berubah bersama
 * mode hanya ikon, label, dan tujuan. Profil tetap di slot terakhir.
 *
 * Hanya bar di layout `(tabs)` yang mendaftarkan navigator tab (untuk
 * `parkShellTab`). Bar di layar stack mengirim `navigation` kosong — cleanup
 * `undefined` akan menghapus navigator yang masih dipakai tab.
 */
import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, type Href } from "expo-router"
import {
  CardsThree,
  Chats,
  ClockCounterClockwise,
  PaperPlaneTilt,
  Percent,
  Plus,
  QrCode,
  ShoppingBag,
  UserCircle,
  Wallet,
} from "phosphor-react-native"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { BottomTabBar, type BottomTabItem } from "@/components/ui/bottom-tab-bar"
import { type IconComponent } from "@/components/ui/icon"
import { api, type UserProfile } from "@/lib/api"
import {
  activeShellSlot,
  applyModeNavigation,
  getModeShift,
  modeShiftIsFresh,
  planSlotPress,
  registerShellTabNavigator,
  shellSlots,
  useAppMode,
  type AppMode,
  type ShellDestination,
  type ShellSlotId,
} from "@/lib/app-mode"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { logWarn } from "@/lib/telemetry"
import { useUnreadCountState } from "@/lib/unread-count"
import { useAuthSession } from "@/lib/use-auth-session"

/**
 * Ikon per slot — SATU kosakata dengan ikon mode di tempat lain:
 *   - Etalase = CardsThree (sama dengan segmen switcher mode & pintasan
 *     Beranda) — permintaan produk 2026-09-23.
 *   - Promo = Percent (simbol diskon universal; "Ticket" disimpan untuk
 *     konten voucher di dalam halaman Promo).
 *   - Dompet/History/Transaksi/Pesan tetap: Wallet, ClockCounterClockwise,
 *     ShoppingBag, Chats.
 */
const SLOT_ICONS: Record<AppMode, Record<Exclude<ShellSlotId, "profile">, IconComponent>> = {
  commerce: {
    primary: CardsThree,
    secondary: ShoppingBag,
    tertiary: Chats,
  },
  wallet: {
    primary: Wallet,
    secondary: Percent,
    tertiary: ClockCounterClockwise,
  },
}

export type ShellTabNavigation = {
  navigate: (name: string) => void
  isReady?: () => boolean
}

export function ShellTabBar({ navigation }: { navigation?: ShellTabNavigation }) {
  useLanguage()
  const mode = useAppMode()
  const pathname = usePathname()
  const router = useRouter()
  const { token } = useAuthSession()
  const unread = useUnreadCountState()
  const [me, setMe] = useState<UserProfile | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const shift = getModeShift()

  useEffect(() => {
    if (!navigation) return
    registerShellTabNavigator(navigation)
    return () => registerShellTabNavigator(null)
  }, [navigation])

  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }
    let alive = true
    api.users
      .getMeCached()
      .then((profile) => {
        if (alive) setMe(profile)
      })
      .catch((err) => logWarn("shell-tab:me", err))
    return () => {
      alive = false
    }
  }, [token])

  const openProfile = useCallback(async () => {
    if (activeShellSlot(pathname, mode) === "profile") return
    if (!token) {
      router.push(ROUTES.loginRequired())
      return
    }
    try {
      const profile = me ?? (await api.users.getMeCached())
      if (profile?.username) {
        // `self: true` — navbar shell layar profil harus terlihat sejak
        // frame pertama (lihat catatan di ROUTES.userProfile).
        router.push(ROUTES.userProfile(profile.username, { self: true }))
        return
      }
    } catch (err) {
      logWarn("shell-tab:profile", err)
    }
    router.push(ROUTES.loginRequired())
  }, [me, mode, pathname, router, token])

  const onChange = useCallback(
    (key: string) => {
      if (key === "discover") {
        void openProfile()
        return
      }
      const dest = shellSlots(mode).find((slot) => slot.key === key)
      if (!dest) return
      const plan = planSlotPress(pathname, dest)
      applyModeNavigation(plan, {
        push: (href) => router.push(href as Href),
        replace: (href) => router.replace(href as Href),
        navigate: (href) => router.navigate(href as Href),
        dismissTo:
          typeof router.dismissTo === "function"
            ? (href) => router.dismissTo(href as Href)
            : undefined,
      })
    },
    [mode, openProfile, pathname, router],
  )

  const items: BottomTabItem[] = shellSlots(mode).map((slot) => toItem(slot, mode, me, unread.count))
  const activeId = activeShellSlot(pathname, mode)
  const value = activeId ? shellSlots(mode).find((slot) => slot.id === activeId)?.key ?? "" : ""

  const payActions: ActionSheetItem[] = [
    {
      key: "transfer",
      label: "Kirim saldo",
      description: "Transfer ke username Kahade",
      icon: PaperPlaneTilt,
      onPress: () => router.push(ROUTES.transfer),
    },
    {
      key: "receive",
      label: "Tampilkan QR terima",
      description: "Orang lain membayar dengan memindai QR ini",
      icon: QrCode,
      onPress: () => router.push(ROUTES.receive),
    },
  ]

  return (
    <>
      <BottomTabBar
        items={items}
        value={value}
        onChange={onChange}
        motionKey={mode}
        motionDir={shift?.dir ?? 1}
        enterOnMount={modeShiftIsFresh()}
        center={
          mode === "commerce"
            ? {
                icon: Plus,
                accessibilityLabel: "Buat Transaksi",
                accessibilityHint: translate("Membuka halaman buat transaksi"),
                onPress: () => router.push(ROUTES.createTransaction),
              }
            : {
                icon: QrCode,
                accessibilityLabel: "Bayar",
                accessibilityHint: translate("Membuka kirim saldo atau QR terima"),
                onPress: () => setPayOpen(true),
              }
        }
      />
      <ActionSheet
        visible={payOpen}
        onRequestClose={() => setPayOpen(false)}
        title="Bayar"
        description="Pilih cara membayar."
        actions={payActions}
      />
    </>
  )
}

function toItem(
  slot: ShellDestination,
  mode: AppMode,
  me: UserProfile | null,
  unread: number | null,
): BottomTabItem {
  if (slot.id === "profile") {
    return {
      key: slot.key,
      label: slot.label,
      icon: UserCircle,
      accessibilityLabel: slot.accessibilityLabel,
      avatarUrl: me?.avatarUrl,
      avatarName: me?.fullName || me?.username || undefined,
    }
  }
  return {
    key: slot.key,
    label: slot.label,
    icon: SLOT_ICONS[mode][slot.id],
    accessibilityLabel: slot.accessibilityLabel,
    badge: slot.href === "/chat" && (unread ?? 0) > 0,
  }
}
