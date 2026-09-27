/**
 * Kahade — aksi & menu cepat tab Dompet (redesign 2026-09-27).
 *
 * Dua kelompok, keduanya TANPA tombol mati: setiap entri memetakan ke route
 * yang memang ada di `lib/routes.ts` (tipe `Href` expo-router — typo rute =
 * compile error).
 *
 *  - <WalletPrimaryActions>: TIGA tombol besar (Isi Saldo / Transfer /
 *    Tarik Dana) — CTA primer gaya e-wallet di bawah kartu hero.
 *  - <WalletQuickMenu>: LIMA ikon bertumpuk label (Terima/QR, Riwayat,
 *    Voucher, Bank, Bantuan) — pola quick-menu Beranda.
 *
 * Peta route diekspor (WALLET_PRIMARY_ACTIONS / WALLET_QUICK_MENU) agar test
 * bisa mengunci "aksi ada dengan route yang benar" tanpa menembak API.
 */
import type { Href } from "expo-router"
import { router } from "expo-router"
import {
  ArrowCircleDown,
  ArrowCircleUp,
  Bank,
  ClockCounterClockwise,
  Headset,
  PaperPlaneTilt,
  QrCode,
  Ticket,
} from "phosphor-react-native"
import { View } from "react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

export type WalletMenuItem = {
  key: string
  label: string
  icon: IconComponent
  /** Route tujuan — semua screen sudah ada di lib/routes.ts. */
  route: Href
}

/** Tiga CTA primer di bawah kartu hero. */
export const WALLET_PRIMARY_ACTIONS: readonly WalletMenuItem[] = [
  { key: "topup", label: "Isi Saldo", icon: ArrowCircleDown, route: ROUTES.topup },
  { key: "transfer", label: "Transfer", icon: PaperPlaneTilt, route: ROUTES.transfer },
  { key: "withdraw", label: "Tarik Dana", icon: ArrowCircleUp, route: ROUTES.withdraw },
]

/** Lima menu cepat ikon-bertumpuk-label. */
export const WALLET_QUICK_MENU: readonly WalletMenuItem[] = [
  { key: "receive", label: "Terima", icon: QrCode, route: ROUTES.receive },
  { key: "history", label: "Riwayat", icon: ClockCounterClockwise, route: ROUTES.walletHistory },
  { key: "vouchers", label: "Voucher", icon: Ticket, route: ROUTES.vouchers },
  { key: "banks", label: "Bank", icon: Bank, route: ROUTES.bankAccounts },
  { key: "support", label: "Bantuan", icon: Headset, route: ROUTES.liveSupport },
]

/**
 * Tiga tombol besar gelap (bg-primary + teks inverse) — CTA primer dompet.
 * Micro-interaction: <PressableScale> + haptic ringan.
 */
export function WalletPrimaryActions({ items = WALLET_PRIMARY_ACTIONS }: { items?: readonly WalletMenuItem[] }) {
  return (
    <View className="flex-row gap-3" accessibilityRole="toolbar" accessibilityLabel="Aksi dompet">
      {items.map((item) => (
        <PressableScale
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityHint={`Buka ${item.label.toLowerCase()}`}
          haptic
          onPress={() => router.push(item.route)}
          containerClassName={cn("flex-1", focusRing)}
          className="items-center justify-center gap-2 rounded-md bg-primary px-2 py-4"
        >
          <Icon icon={item.icon} size="md" tone="inverse" />
          <Text variant="body" weight={600} tone="inverse" numberOfLines={1}>
            {item.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  )
}

/**
 * Menu cepat: lingkaran ikon (bg-surface) + caption — pola quick-menu
 * Beranda/HomeOverviewCard, konsisten antar layar.
 */
export function WalletQuickMenu({ items = WALLET_QUICK_MENU }: { items?: readonly WalletMenuItem[] }) {
  return (
    <View className="flex-row" accessibilityRole="toolbar" accessibilityLabel="Menu cepat dompet">
      {items.map((item) => (
        <PressableScale
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityHint={`Buka ${item.label.toLowerCase()}`}
          haptic
          onPress={() => router.push(item.route)}
          containerClassName={cn("flex-1", focusRing)}
          className="items-center gap-2 py-2"
        >
          <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
            <Icon icon={item.icon} size="sm" tone="active" />
          </View>
          <Text
            ellipsizeMode="tail"
            variant="caption"
            weight={500}
            tone="primary"
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  )
}
