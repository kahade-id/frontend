/**
 * Kahade — <ShowcaseHeader> PERFECT VERSION
 *
 * Referensi awal docs/image/IMG_20260918_114629_753.jpg hanya contoh.
 * Versi perfect: minimal, premium, super-app level, monokrom + aksen hijau
 * untuk balance moment.
 *
 * Layout final (sesuai request: logo kiri, balance, inbox, profile):
 *   [Logo] [Balance Pill flex-1] [Gift/Voucher] [Bell/Notif] [Avatar]
 *   + Search row (rounded-full + create button)
 *   + Feed tabs pill with icons
 *
 * Perfect improvements:
 * - Spacing pakai tokens.layout.screenPaddingX (20px) → px-5
 * - Logo: 40x40 rounded-xl bg-[#DCFCE7] border-[#BBF7D0] + LogoMark 22 hijau #0EB66E
 *   soft green biar balance pill (putih) tetap hero, logo tidak tenggelam
 * - Balance pill: rounded-full (fully pill) h-10 bg-white border-[#E5E7EB]
 *   shadow-sm, left black circle 28px dengan b hijau 16px, amount mono bold
 *   14px, chevron 12px, plus 28px rounded-full hijau #0EB66E shadow
 * - Actions: 40x40 rounded-full bg-white border shadow-sm, icon 20 fill,
 *   bell & gift pakai dot hijau emerald (bukan merah) — lebih soft, sesuai
 *   referensi (dot hijau di gambar)
 * - Avatar: 40x40 rounded-full border-2 white shadow-sm, Avatar sm 32,
 *   online dot hijau 10px border-2 white absolute
 * - Search: rounded-full bg-surface (#F3F4F6) border-0, h-11, left
 *   MagnifyingGlass, clearable, + tombol create showcase 40x40 bg-primary
 *   rounded-full Plus putih di kanan (aksi utama showcase)
 * - Tabs: pill dengan icon Phosphor (Sparkle, Users, Clock, TrendUp),
 *   active bg-primary text-inverse shadow-sm, inactive bg-white border
 *   text-secondary, h-8.5 min-w 72, gap 6px icon+label, scrollable
 * - A11y, haptic, focusRing, skeleton, refreshOnFocus
 */

import { useCallback } from "react"
import { View, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import {
  Bell,
  CaretDown,
  ClockCounterClockwise,
  Gift,
  MagnifyingGlass,
  Plus,
  Sparkle,
  TrendUp,
  Users,
} from "phosphor-react-native"

import { api, type Wallet as WalletData, type UserProfile } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { formatRupiah } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"
import { useUnreadCountState } from "@/lib/unread-count"
import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

import { LogoMark } from "@/components/ui/logo"
import { Avatar } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { Skeleton } from "@/components/ui/skeleton"

const GREEN = "#0EB66E"

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

export function ShowcaseHeader({
  search,
  onSearchChange,
  kind,
  onKindChange,
  tabs,
}: ShowcaseHeaderProps) {
  const router = useRouter()
  const unread = useUnreadCountState()

  const walletQuery = useApiQuery<WalletData>(
    "showcase-header-wallet",
    (signal) => api.wallet.getWallet(signal),
    true,
    { refreshOnFocus: true },
  )
  const profileQuery = useApiQuery<UserProfile>(
    "showcase-header-profile",
    (signal) => api.users.getMe(signal),
    true,
    { refreshOnFocus: true },
  )

  const balance = walletQuery.data?.availableBalance ?? 0
  const balanceText = walletQuery.loading
    ? "Rp—"
    : formatRupiah(balance, { compact: balance >= 1_000_000 })

  const displayName =
    profileQuery.data?.fullName?.trim() ||
    profileQuery.data?.username ||
    "Pengguna Kahade"

  const handleBalancePress = useCallback(() => {
    router.push(ROUTES.wallet)
  }, [router])

  const handleTopupPress = useCallback(() => {
    router.push(ROUTES.topup)
  }, [router])

  return (
    <View className="bg-background">
      {/* ── Top bar: logo + balance + inbox + profile ───────────── */}
      <View className="w-full flex-row items-center gap-3 px-5 pb-2.5 pt-3">
        {/* Logo Kahade — perfect: soft green bg, border, 40x40 */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Kahade, kembali ke beranda"
          accessibilityHint="Buka beranda"
          haptic
          onPress={() => router.push(ROUTES.home)}
          containerClassName={cn("rounded-xl", focusRing)}
          className="h-10 w-10 items-center justify-center rounded-xl border border-[#BBF7D0] bg-[#DCFCE7] shadow-sm"
        >
          <LogoMark size={22} fill={GREEN} />
        </PressableScale>

        {/* Balance pill — perfect: rounded-full, h-10, white, shadow-sm */}
        <View className="h-10 flex-1 flex-row items-center gap-1 rounded-full border border-[#E5E7EB] bg-white px-1 shadow-sm">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Saldo ${balanceText}, buka dompet`}
            accessibilityHint="Buka dompet"
            haptic
            onPress={handleBalancePress}
            containerClassName={cn("flex-1 rounded-full", focusRing)}
            className="flex-1 flex-row items-center gap-2 rounded-full py-1 pl-0.5 pr-1"
          >
            {/* Black circle with green b */}
            <View className="h-7 w-7 items-center justify-center rounded-full bg-black">
              <LogoMark size={14} fill={GREEN} />
            </View>

            {/* Amount */}
            <View className="min-w-0 flex-1 flex-row items-center gap-1">
              {walletQuery.loading ? (
                <Skeleton className="h-3.5 w-14 rounded-full" />
              ) : (
                <Text
                  variant="body"
                  weight={700}
                  numberOfLines={1}
                  className="shrink text-[14px] tracking-tight"
                >
                  {balanceText}
                </Text>
              )}
              <Icon icon={CaretDown} size={12} tone="default" />
            </View>
          </PressableScale>

          {/* Plus — green, rounded-full, 28px, shadow */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Isi saldo"
            accessibilityHint="Buka halaman isi saldo"
            haptic
            onPress={handleTopupPress}
            containerClassName={cn("rounded-full", focusRing)}
            className="h-7 w-7 items-center justify-center rounded-full bg-[#0EB66E] shadow-sm"
          >
            <Icon icon={Plus} size={14} weight="bold" tone="inverse" />
          </PressableScale>
        </View>

        {/* Right actions — perfect: 40x40 rounded-full white */}
        <View className="flex-row items-center gap-2">
          {/* Gift / Voucher — inbox */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Voucher dan hadiah"
            accessibilityHint="Buka voucher"
            haptic
            onPress={() => router.push(ROUTES.vouchers)}
            containerClassName={cn("rounded-full", focusRing)}
            className="h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-sm"
          >
            <Icon icon={Gift} size={20} weight="fill" tone="active" />
          </PressableScale>

          {/* Bell */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={
              unread.count ? `Notifikasi, ${unread.count} belum dibaca` : "Notifikasi"
            }
            accessibilityHint="Buka notifikasi"
            haptic
            onPress={() => router.push(ROUTES.notifications)}
            containerClassName={cn("rounded-full", focusRing)}
            className="h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-sm"
          >
            <View className="relative">
              <Icon icon={Bell} size={20} weight="fill" tone="active" />
              {(unread.count ?? 0) > 0 ? (
                <View
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0EB66E]"
                  accessible
                  accessibilityLabel="Ada notifikasi baru"
                />
              ) : null}
            </View>
          </PressableScale>

          {/* Avatar — profile */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Profil ${displayName}`}
            accessibilityHint="Buka pengaturan"
            haptic
            onPress={() => router.push(ROUTES.settings)}
            containerClassName={cn("rounded-full", focusRing)}
            className="relative h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-surface shadow-sm"
          >
            {profileQuery.loading ? (
              <Skeleton shape="circle" width={36} height={36} />
            ) : (
              <Avatar
                source={profileQuery.data?.avatarUrl ?? undefined}
                name={displayName}
                size="sm"
                className="h-9 w-9"
              />
            )}
            {/* Online dot */}
            <View className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#0EB66E]" />
          </PressableScale>
        </View>
      </View>

      {/* ── Search row — perfect: rounded-full + create button ─── */}
      <View className="flex-row items-center gap-2.5 px-5 pb-3 pt-1">
        <View className="flex-1">
          <Input
            variant="search"
            value={search}
            onChangeText={onSearchChange}
            placeholder="Cari produk atau penjual"
            accessibilityLabel="Cari showcase"
            leftIcon={MagnifyingGlass}
            clearable
            className="rounded-full border-0 bg-surface px-4"
            containerClassName="rounded-full"
          />
        </View>

        {/* Create showcase — perfect: primary rounded-full 40x40 */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Kelola showcase saya"
          accessibilityHint="Buka halaman untuk menambah dan mengatur showcase"
          haptic
          onPress={() => router.push(ROUTES.showcaseManagement)}
          containerClassName={cn("rounded-full", focusRing)}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary shadow-sm"
        >
          <Icon icon={Plus} size={20} weight="bold" tone="inverse" />
        </PressableScale>
      </View>

      {/* ── Feed tabs — perfect: pill with icons ────────────────── */}
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
                  active
                    ? "border-primary bg-primary shadow-sm"
                    : "border-border bg-white",
                )}
              >
                <Icon
                  icon={IconCmp}
                  size={14}
                  weight={active ? "fill" : "regular"}
                  tone={active ? "inverse" : "default"}
                />
                <Text
                  variant="label"
                  weight={active ? 700 : 500}
                  tone={active ? "inverse" : "secondary"}
                  className={cn(active && "tracking-tight")}
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
