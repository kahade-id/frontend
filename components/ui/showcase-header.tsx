/**
 * Kahade — <ShowcaseHeader> (bar atas tab Etalase; revisi 2026-09-23).
 *
 * Layout: [Logo] [Balance pill flex-1] [ModeSwitcher] [Bell]
 *   + baris pencarian (+ kelola etalase) + strip tab feed yang bisa di-scroll.
 *
 * Revisi 2026-09-23 — header dirampingkan agar switcher mode muat DI DALAM
 * baris atas (permintaan: switcher kecil, satu, di header halaman mode):
 *   1. ModeSwitcher E-Commerce ⇄ E-Wallet kini pil kompak ber-ikon
 *      (CardsThree/Wallet) yang menempel di baris atas — menggantikan baris
 *      pil lebar penuh di bawahnya. Ikon CardsThree = ikon "Etalase" yang
 *      sama dengan slot primer navbar bawah, jadi switcher terbaca sebagai
 *      keluarga ikon yang sama.
 *   2. Gift & avatar keluar dari baris atas: voucher/promo sudah punya rumah
 *      di tab Promo (mode wallet), dan profil ada di slot Profil navbar —
 *      mengulang keduanya di sini membuat baris atas penuh dan switcher
 *      tidak kebagian tempat. Bell tetap: satu-satunya pintu notifikasi
 *      mode commerce.
 *   3. Balance pill tetap kartu putih berpola kartu (`bg-background` +
 *      `border-border`) — jembatan cepat ke dompet dari mode belanja: tap
 *      isi nominalnya membuka tab Dompet, (+) membuka isi saldo.
 *   4. Semua hex literal tetap dilarang (`npm run check:tokens`);
 *      `shadow-sm`/`rounded-xl` tetap tidak ada (lihat tailwind.config).
 *
 * Titik unread memakai <NotificationDot> (§9.14) — komponen yang sama dengan
 * badge tab bawah, bukan dot hijau custom; status "ada yang baru" = danger,
 * bukan success. Target sentuh 40px dinaikkan ke ≥44 lewat `hitSlop` (§a11y)
 * supaya baris tetap ramping.
 */

import { useCallback } from "react"
import { View, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import {
  Bell,
  ClockCounterClockwise,
  MagnifyingGlass,
  Plus,
  Sparkle,
  TrendUp,
  Users,
} from "phosphor-react-native"

import { api, type Wallet as WalletData } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { queryKeys } from "@/lib/query-keys"
import { formatRupiah } from "@/lib/format"
import { useHasSession } from "@/lib/guest-gate"
import { useApiQuery } from "@/lib/use-api-query"
import { useUnreadCountState } from "@/lib/unread-count"
import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"
import { hitSlopToReach } from "@/lib/hit-slop"
import { focusRing } from "@/lib/focus-ring"

import { Logo } from "@/components/ui/logo"
import { ModeSwitcher } from "@/components/ui/mode-switcher"
import { NotificationDot } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { Skeleton } from "@/components/ui/skeleton"

export type ShowcaseFeedKind = "forYou" | "following" | "latest" | "popular"

export type ShowcaseHeaderProps = {
  search: string
  onSearchChange: (v: string) => void
  kind: ShowcaseFeedKind
  onKindChange: (k: ShowcaseFeedKind) => void
  tabs: readonly { value: ShowcaseFeedKind; label: string }[]
}

const TAB_ICONS: Record<ShowcaseFeedKind, typeof Sparkle> = {
  forYou: Sparkle,
  following: Users,
  latest: ClockCounterClockwise,
  popular: TrendUp,
}

/** Kotak visual aksi di bar atas (logo, bell) = 40px. */
const ACTION_BOX = 40
const ACTION_HIT_SLOP = hitSlopToReach(ACTION_BOX)

export function ShowcaseHeader({
  search,
  onSearchChange,
  kind,
  onKindChange,
  tabs,
}: ShowcaseHeaderProps) {
  const router = useRouter()
  const unread = useUnreadCountState()
  // B-02 (pola audit): /showcase terproteksi untuk tamu web, tetapi layar
  // tetap ter-mount di belakang gate — query saldo digate sesi supaya tamu
  // yang tersesat ke sini tidak memanen 401 → refresh di balik overlay.
  const hasSession = useHasSession()

  const walletQuery = useApiQuery<WalletData>(
    queryKeys.wallet(),
    (signal) => api.wallet.getWallet(signal),
    hasSession,
    { refreshOnFocus: true },
  )

  const balance = walletQuery.data?.availableBalance ?? 0
  const balanceText = walletQuery.loading
    ? "Rp—"
    : formatRupiah(balance, { compact: balance >= 1_000_000 })

  const handleBalancePress = useCallback(() => {
    router.push(ROUTES.wallet)
  }, [router])

  const handleTopupPress = useCallback(() => {
    router.push(ROUTES.topup)
  }, [router])

  return (
    <View className="bg-background">
      {/* ── Baris atas: logo · saldo · switcher mode · notifikasi ── */}
      <View className="w-full flex-row items-center gap-3 px-5 pb-2.5 pt-3">
        {/* Logo — mark polos 40px setinggi foto profil, warna dari token */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Kahade, kembali ke beranda"
          accessibilityHint="Buka beranda"
          haptic
          hitSlop={ACTION_HIT_SLOP}
          onPress={() => router.push(ROUTES.home)}
          containerClassName={cn("rounded-md", focusRing)}
        >
          <Logo variant="mark" size="md" />
        </PressableScale>

        {/* Balance pill — hanya nominal + isi saldo. Tetap kartu putih
            (`bg-background` + border token) supaya tetap jadi satu-satunya
            angka yang menonjol di baris ini; yang abu cukup tombol ikonnya. */}
        <View className="h-10 flex-1 flex-row items-center gap-1 rounded-full border border-border bg-background pr-1 pl-4">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Saldo {x}, buka dompet", { x: balanceText })}
            accessibilityHint="Buka dompet"
            haptic
            onPress={handleBalancePress}
            containerClassName={cn("h-10 flex-1 justify-center rounded-full", focusRing)}
            className="min-w-0 flex-row items-center"
          >
            {walletQuery.loading ? (
              <Skeleton className="h-3.5 w-14 rounded-full" />
            ) : (
              <Text variant="body" weight={700} numberOfLines={1} className="min-w-0 shrink">
                {balanceText}
              </Text>
            )}
          </PressableScale>

          {/* Isi saldo */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Isi saldo"
            accessibilityHint="Buka halaman isi saldo"
            haptic
            hitSlop={ACTION_HIT_SLOP}
            onPress={handleTopupPress}
            containerClassName={cn("rounded-full", focusRing)}
            className="h-7 w-7 items-center justify-center rounded-full bg-primary"
          >
            <Icon icon={Plus} size={14} weight="bold" tone="inverse" />
          </PressableScale>
        </View>

        {/* Aksi kanan — switcher mode (pil kompak) + lonceng notifikasi.
            Switcher DI DALAM baris atas: satu-satunya tempat pergantian mode
            di halaman Etalase, sejajar dengan aksi lain, bukan baris sendiri
            yang memakan tinggi header. */}
        <View className="flex-row items-center gap-2">
          <ModeSwitcher />

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={
              unread.count
                ? translate("Notifikasi, {x} belum dibaca", { x: unread.count })
                : "Notifikasi"
            }
            accessibilityHint="Buka notifikasi"
            haptic
            hitSlop={ACTION_HIT_SLOP}
            onPress={() => router.push(ROUTES.notifications)}
            containerClassName={cn("rounded-full", focusRing)}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <View className="relative">
              <Icon icon={Bell} size={20} weight="fill" tone="active" />
              <NotificationDot visible={(unread.count ?? 0) > 0} />
            </View>
          </PressableScale>
        </View>
      </View>

      {/* ── Pencarian + kelola etalase ── */}
      <View className="flex-row items-center gap-2.5 px-5 pb-3 pt-1">
        <View className="flex-1">
          <Input
            variant="search"
            value={search}
            onChangeText={onSearchChange}
            placeholder="Cari produk atau penjual"
            accessibilityLabel="Cari di etalase"
            leftIcon={MagnifyingGlass}
            clearable
            frame="none"
            className="rounded-full bg-surface"
            containerClassName="rounded-full"
          />
        </View>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Kelola etalase saya"
          accessibilityHint="Buka halaman untuk menambah dan mengatur etalase"
          haptic
          hitSlop={ACTION_HIT_SLOP}
          onPress={() => router.push(ROUTES.showcaseManagement)}
          containerClassName={cn("rounded-full", focusRing)}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary"
        >
          <Icon icon={Plus} size={20} weight="bold" tone="inverse" />
        </PressableScale>
      </View>

      {/* ── Strip tab feed ── */}
      <View className="border-b border-border">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: tokens.space[5],
            gap: tokens.space[2],
            paddingBottom: tokens.space[3],
          }}
        >
          {tabs.map((t) => {
            const active = t.value === kind
            const IconCmp = TAB_ICONS[t.value] ?? Sparkle
            return (
              <PressableScale
                key={t.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
                haptic
                onPress={() => onKindChange(t.value)}
                containerClassName={cn("rounded-full", focusRing)}
                className={cn(
                  "h-8 flex-row items-center justify-center gap-1.5 rounded-full border px-3.5",
                  active ? "border-primary bg-primary" : "border-transparent bg-surface",
                )}
              >
                <Icon
                  icon={IconCmp}
                  size={14}
                  weight={active ? "fill" : "regular"}
                  tone={active ? "inverse" : "active"}
                />
                <Text
                  variant="label"
                  weight={active ? 700 : 500}
                  tone={active ? "inverse" : "secondary"}
                >
                  {t.label}
                </Text>
              </PressableScale>
            )
          })}
        </ScrollView>
      </View>
    </View>
  )
}
