/**
 * Kahade — navbar bawah bersama untuk E-Commerce dan E-Wallet.
 *
 * Satu struktur (tinggi, lingkaran tengah, lima slot). Yang berubah bersama
 * mode hanya ikon, label, dan tujuan. Profil tetap di slot terakhir.
 *
 * Revisi 2026-09-25 (bug "navbar etalase hilang"): isi bar mengikuti HALAMAN
 * yang sedang dibuka, bukan hanya preferensi mode tersimpan. Halaman milik
 * mode lain (mis. /showcase saat mode tersimpan = wallet) memakai slot mode
 * pemiliknya — lihat `resolveShellBar` di lib/app-mode.ts untuk aturan
 * lengkapnya; `/more` (dipakai kedua mode) tetap mengikuti mode aktif.
 *
 * Hanya bar di layout `(tabs)` yang mendaftarkan navigator tab (untuk
 * `parkShellTab`). Bar di layar stack mengirim `navigation` kosong — cleanup
 * `undefined` akan menghapus navigator yang masih dipakai tab.
 */
import { useCallback, useEffect } from "react"
import { usePathname, useRouter, type Href } from "expo-router"
import {
  CardsThree,
  ChatCenteredText,
  Percent,
  Plus,
  Scan,
  Scroll,
  ShoppingBag,
  SquaresFour,
  Wallet,
} from "phosphor-react-native"

import { BottomTabBar, type BottomTabItem } from "@/components/ui/bottom-tab-bar"
import { type IconComponent } from "@/components/ui/icon"
import {
  activeShellSlot,
  applyModeNavigation,
  getModeShift,
  modeShiftIsFresh,
  planSlotPress,
  registerShellTabNavigator,
  resolveShellBar,
  shellSlots,
  useAppMode,
  type AppMode,
  type ShellDestination,
  type ShellSlotId,
} from "@/lib/app-mode"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { useUnreadCountState } from "@/lib/unread-count"

/**
 * Tombol tengah mode E-Wallet = PEMINDAI (revisi 2026-09-26): sebelumnya ia
 * membuka ActionSheet "Bayar" berisi tiga pilihan (pindai, kirim, terima),
 * padahal kirim & terima sudah menempel di kartu saldo halaman Dompet — satu
 * ketukan ekstra untuk sampai ke pemindai, dan sheet yang muncul di atas
 * navbar justru menutupi tujuan akhirnya.
 *
 * Ikon per slot — SATU kosakata dengan ikon mode di tempat lain:
 *   - Etalase = CardsThree (sama dengan segmen switcher mode & pintasan
 *     Beranda) — permintaan produk 2026-09-23.
 *   - Promo = Percent (simbol diskon universal; "Ticket" disimpan untuk
 *     konten voucher di dalam halaman Promo).
 *   - Dompet = Wallet, History = Scroll, Transaksi = ShoppingBag,
 *     Pesan = ChatCenteredText (permintaan produk 2026-09-23).
 */
const SLOT_ICONS: Record<AppMode, Record<Exclude<ShellSlotId, "more">, IconComponent>> = {
  commerce: {
    primary: CardsThree,
    secondary: ShoppingBag,
    tertiary: ChatCenteredText,
  },
  wallet: {
    primary: Wallet,
    secondary: Percent,
    tertiary: Scroll,
  },
}

export type ShellTabNavigation = {
  navigate: (name: string) => void
  isReady?: () => boolean
}

export function ShellTabBar({ navigation }: { navigation?: ShellTabNavigation }) {
  useLanguage()
  const storedMode = useAppMode()
  const pathname = usePathname()
  const router = useRouter()
  const unread = useUnreadCountState()
  const shift = getModeShift()

  /**
   * Mode EFEKTIF bar untuk halaman ini (2026-09-25).
   *
   * Halaman milik satu mode menentukan isi bar-nya sendiri: membuka /showcase
   * dengan preferensi mode = wallet tetap menampilkan slot commerce (Etalase
   * sebagai slot aktif) — sebelumnya bar hilang total di halaman itu. `/more`
   * dipakai kedua mode, jadi ia mengikuti preferensi tersimpan. Preferensi
   * tidak diubah di sini (lihat docblock `resolveShellBar`).
   */
  const mode = resolveShellBar(pathname, storedMode)?.mode ?? storedMode

  useEffect(() => {
    if (!navigation) return
    registerShellTabNavigator(navigation)
    return () => registerShellTabNavigator(null)
  }, [navigation])

  const onChange = useCallback(
    (key: string) => {
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
    [mode, pathname, router],
  )

  const items: BottomTabItem[] = shellSlots(mode).map((slot) => toItem(slot, mode, unread.count))
  const activeId = activeShellSlot(pathname, mode)
  const value = activeId ? shellSlots(mode).find((slot) => slot.id === activeId)?.key ?? "" : ""

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
                icon: Scan,
                accessibilityLabel: "Pindai QR",
                accessibilityHint: translate("Membuka pemindai kode QR"),
                onPress: () => router.push(ROUTES.scan),
              }
        }
      />
    </>
  )
}

function toItem(
  slot: ShellDestination,
  mode: AppMode,
  unread: number | null,
): BottomTabItem {
  if (slot.id === "more") {
    return {
      key: slot.key,
      label: slot.label,
      icon: SquaresFour,
      accessibilityLabel: slot.accessibilityLabel,
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
