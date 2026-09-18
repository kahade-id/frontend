/**
 * Kahade — <ShowcaseHeader> (improved header untuk tab Showcase)
 *
 * Referensi: docs/image/IMG_20260918_114629_753.jpg — hanya referensi visual,
 * implementasi di-improve total untuk brand Kahade v2.2 monokrom + aksen hijau
 * untuk momen balance.
 *
 * Layout yang diminta:
 *   [Logo Kahade kiri] [Card Balance] [Inbox/Gift] [Notifikasi/Bell] [Profile Avatar]
 *   + search + feed tabs di bawahnya, dengan collapsing support.
 *
 * Improvements dari referensi:
 *   - Logo: mark hijau (#0EB66E) di atas container putih rounded-xl + border + shadow-sm,
 *     bukan sekadar ikon flat. Tap -> Beranda.
 *   - Card Balance: pill modern 44h, border, shadow-sm, bg-white, dengan:
 *     * ikon b di lingkaran hitam + hijau (brand)
 *     * teks Rp dengan formatRupiah compact, weight 700
 *     * chevron dropdown
 *     * tombol + hijau solid (#0EB66E) rounded 10px, tap -> Topup
 *     Tap pada pill utama -> Wallet.
 *   - Gift/Inbox: 44x44 rounded 14px, bg-white, border, shadow-sm, ikon Gift.
 *     Tap -> Voucher.
 *   - Bell: sama, dengan dot hijau bila ada unread (dari useUnreadCountState),
 *     tap -> Notifikasi.
 *   - Avatar: 44x44 rounded-full, border 2px white, shadow, online dot hijau
 *     12px dengan border 2px white di kanan atas, tap -> Settings/Profile.
 *   - Search: rounded-full bg-surface, border-0, icon search, clearable.
 *   - Tabs: pill style, bukan underline — active = bg-primary text-inverse,
 *     inactive = bg-surface border-border text-secondary, scrollable horizontal.
 *
 * Data:
 *   - Wallet diambil via useApiQuery (getWallet) dengan refreshOnFocus
 *   - Profile via getMe
 *   - Unread via useUnreadCountState
 *
 * A11y:
 *   - Semua tombol punya accessibilityLabel
 *   - Balance pill label = "Saldo Rp..."
 *   - Avatar label = foto profil
 */

import { useCallback } from "react"
import { View, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import {
  Bell,
  CaretDown,
  Gift,
  MagnifyingGlass,
  Plus,
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

// ------------------------------------------------------------------
// Constants — warna aksen hijau untuk balance (referensi gambar hijau)
// ------------------------------------------------------------------

const GREEN = "#0EB66E"

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type ShowcaseFeedKind = "forYou" | "following" | "latest" | "popular"

export type ShowcaseHeaderProps = {
  search: string
  onSearchChange: (v: string) => void
  kind: ShowcaseFeedKind
  onKindChange: (k: ShowcaseFeedKind) => void
  tabs: readonly { value: ShowcaseFeedKind; label: string }[]
  /** Optional: hide balance loading skeleton for instant render */
  hideBalance?: boolean
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
      {/* ── Top bar: logo + balance + actions ───────────────────── */}
      <View className="w-full flex-row items-center gap-2.5 px-4 pb-2 pt-2">
        {/* Logo Kahade — mark hijau di container putih */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Kahade, kembali ke beranda"
          onPress={() => router.push(ROUTES.home)}
          containerClassName={cn("rounded-xl", focusRing)}
          className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-white shadow-sm"
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-white">
            {/* Green mark */}
            <LogoMark size={28} fill={GREEN} />
          </View>
        </PressableScale>

        {/* Balance pill — flex-1, modern — improved: no nested pressable */}
        <View className="h-11 flex-1 flex-row items-center gap-1 rounded-[16px] border border-[#E5E7EB] bg-white px-1.5 shadow-sm">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Saldo ${balanceText}, buka dompet`}
            onPress={handleBalancePress}
            containerClassName={cn("flex-1 rounded-[12px]", focusRing)}
            className="flex-1 flex-row items-center gap-2 rounded-[12px] py-1"
          >
            {/* Left icon: black circle with green b */}
            <View className="h-8 w-8 items-center justify-center rounded-full bg-black">
              <LogoMark size={18} fill={GREEN} />
            </View>

            {/* Amount + chevron */}
            <View className="min-w-0 flex-1 flex-row items-center gap-1">
              {walletQuery.loading ? (
                <Skeleton className="h-4 w-16 rounded-sm" />
              ) : (
                <Text
                  variant="body"
                  weight={700}
                  numberOfLines={1}
                  className="shrink text-[15px] tracking-tight"
                >
                  {balanceText}
                </Text>
              )}
              <Icon icon={CaretDown} size={14} tone="default" />
            </View>
          </PressableScale>

          {/* Plus button — green solid, separate pressable */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Isi saldo"
            onPress={handleTopupPress}
            containerClassName={cn("rounded-[10px]", focusRing)}
            className="h-8 w-8 items-center justify-center rounded-[10px] bg-[#0EB66E]"
          >
            <Icon icon={Plus} size={18} weight="bold" tone="inverse" />
          </PressableScale>
        </View>

        {/* Right actions: Gift, Bell, Avatar */}
        <View className="flex-row items-center gap-2">
          {/* Gift / Voucher — inbox */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Voucher dan hadiah"
            onPress={() => router.push(ROUTES.vouchers)}
            containerClassName={cn("rounded-[14px]", focusRing)}
            className="h-11 w-11 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm"
          >
            <Icon icon={Gift} size={22} weight="fill" tone="active" />
          </PressableScale>

          {/* Bell — notifications with green dot */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={
              unread.count ? `Notifikasi, ${unread.count} belum dibaca` : "Notifikasi"
            }
            onPress={() => router.push(ROUTES.notifications)}
            containerClassName={cn("rounded-[14px]", focusRing)}
            className="h-11 w-11 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm"
          >
            <View className="relative">
              <Icon icon={Bell} size={22} weight="fill" tone="active" />
              {/* Green dot for unread — improved: emerald dot, not red */}
              {(unread.count ?? 0) > 0 ? (
                <View
                  className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#0EB66E]"
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
            onPress={() => router.push(ROUTES.settings)}
            containerClassName={cn("rounded-full", focusRing)}
            className="relative h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-surface shadow-sm"
          >
            {profileQuery.loading ? (
              <Skeleton shape="circle" width={40} height={40} />
            ) : (
              <Avatar
                source={profileQuery.data?.avatarUrl ?? undefined}
                name={displayName}
                size="sm"
                className="h-10 w-10"
              />
            )}
            {/* Online green dot — improved: emerald with white border */}
            <View className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#0EB66E]" />
          </PressableScale>
        </View>
      </View>

      {/* ── Search — rounded-full, soft ─────────────────────────── */}
      <View className="px-4 pb-3 pt-1">
        <View className="flex-row items-center gap-2">
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
        </View>
      </View>

      {/* ── Feed tabs — pill style, improved ────────────────────── */}
      <View className="border-b border-border">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: tokens.space[4],
            gap: tokens.space[2],
            paddingBottom: tokens.space[3],
          }}
        >
          {tabs.map((t) => {
            const active = t.value === kind
            return (
              <PressableScale
                key={t.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
                onPress={() => onKindChange(t.value)}
                containerClassName={cn("rounded-full", focusRing)}
                className={cn(
                  "h-9 min-w-[72px] items-center justify-center rounded-full border px-4",
                  active
                    ? "border-primary bg-primary"
                    : "border-border bg-surface",
                )}
              >
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

/**
 * Compact top bar only — for use in other places if needed
 * (e.g., sticky mini header)
 */
export function ShowcaseTopBarCompact() {
  const router = useRouter()
  const walletQuery = useApiQuery<WalletData>(
    "showcase-topbar-wallet",
    (s) => api.wallet.getWallet(s),
    true,
    { refreshOnFocus: true },
  )
  const profileQuery = useApiQuery<UserProfile>(
    "showcase-topbar-profile",
    (s) => api.users.getMe(s),
    true,
  )
  const unread = useUnreadCountState()
  const balanceText = walletQuery.loading
    ? "Rp—"
    : formatRupiah(walletQuery.data?.availableBalance ?? 0)

  return (
    <View className="flex-row items-center gap-2 bg-background px-4 py-2">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-white">
        <LogoMark size={24} fill={GREEN} />
      </View>
      <View className="flex-1 flex-row items-center gap-2 rounded-full border border-border bg-white px-3 py-2">
        <View className="h-6 w-6 items-center justify-center rounded-full bg-black">
          <LogoMark size={14} fill={GREEN} />
        </View>
        <Text variant="body" weight={600} className="flex-1">
          {balanceText}
        </Text>
        <View className="h-7 w-7 items-center justify-center rounded-full bg-[#0EB66E]">
          <Icon icon={Plus} size={14} weight="bold" tone="inverse" />
        </View>
      </View>
      <View className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-white">
        <Icon icon={Bell} size={20} />
        {(unread.count ?? 0) > 0 && (
          <View className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-white bg-[#0EB66E]" />
        )}
      </View>
      <Avatar
        source={profileQuery.data?.avatarUrl ?? undefined}
        name={profileQuery.data?.fullName ?? "User"}
        size="sm"
      />
    </View>
  )
}
