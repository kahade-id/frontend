/**
 * Kahade — <ShowcaseHeader> (bar atas tab Showcase; revisi 2026-09-18).
 *
 * Layout: [Logo] [Balance pill flex-1] [Gift] [Bell] [Avatar]
 *   + baris pencarian (+ kelola showcase) + strip tab feed yang bisa di-scroll.
 *
 * Revisi 2026-09-18 — empat hal yang dikoreksi dari versi sebelumnya:
 *   1. Logo TANPA kotak latar (dulu 40×40 bg-[#DCFCE7] + border hijau) dan
 *      TIDAK lagi hijau: render lewat <Logo variant="mark" size="md"> sehingga
 *      tingginya 40px — SAMA dengan foto profil di ujung baris yang sama — dan
 *      fill-nya datang dari token `primary` (hitam di light, putih di dark).
 *   2. Gift & Bell: latar abu netral saja (`bg-surface`), tanpa border dan
 *      tanpa shadow. Kartu saldo sengaja TETAP putih berpola kartu
 *      (`bg-background` + `border-border`) — satu angka uang tidak boleh
 *      tenggelam di samping dua tombol abu.
 *   3. Balance pill: logo di dalamnya DIHAPUS (saldo tidak perlu di-branding
 *      ulang dua baris di bawah logo) dan caret-down DIHAPUS (tidak ada menu
 *      dropdown di ujung pill — tap membuka dompet, itu sudah seluruhnya).
 *   4. Semua hex literal (#DCFCE7, #BBF7D0, #0EB66E, #E5E7EB, #FFFFFF)
 *      dibuang. Palet brand v2.2 monokrom (§2.2) dan `npm run check:tokens`
 *      memang MENOLAK class warna literal (`bg-white`, `bg-black`, ...) di
 *      luar allowlist — file ini salah satunya. `shadow-sm`/`rounded-xl` juga
 *      dihapus: tailwind.config meng-OVERRIDE boxShadow (hanya `none`) dan
 *      radius (hingga `lg`), jadi kedua class itu tidak menghasilkan apa-apa.
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
  Gift,
  MagnifyingGlass,
  Plus,
  Sparkle,
  TrendUp,
  Users,
} from "phosphor-react-native"

import { api, type Wallet as WalletData, type UserProfile } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { queryKeys } from "@/lib/query-keys"
import { formatRupiah } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"
import { useUnreadCountState } from "@/lib/unread-count"
import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"
import { hitSlopToReach } from "@/lib/hit-slop"
import { focusRing } from "@/lib/focus-ring"

import { Logo } from "@/components/ui/logo"
import { Avatar } from "@/components/ui/avatar"
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

/** Kotak visual aksi di bar atas (logo, gift, bell, avatar) = 40px. */
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

  const walletQuery = useApiQuery<WalletData>(
    queryKeys.wallet(),
    (signal) => api.wallet.getWallet(signal),
    true,
    { refreshOnFocus: true },
  )
  const profileQuery = useApiQuery<UserProfile>(
    queryKeys.me(),
    (signal) => api.users.getMe(signal),
    true,
    { refreshOnFocus: true },
  )

  const balance = walletQuery.data?.availableBalance ?? 0
  const balanceText = walletQuery.loading
    ? "Rp—"
    : formatRupiah(balance, { compact: balance >= 1_000_000 })

  const displayName =
    profileQuery.data?.fullName?.trim() || profileQuery.data?.username || "Pengguna Kahade"

  const handleBalancePress = useCallback(() => {
    router.push(ROUTES.wallet)
  }, [router])

  const handleTopupPress = useCallback(() => {
    router.push(ROUTES.topup)
  }, [router])

  return (
    <View className="bg-background">
      {/* ── Baris atas: logo · saldo · hadiah · notifikasi · profil ── */}
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

        {/* Aksi kanan — latar abu, tanpa border/shadow */}
        <View className="flex-row items-center gap-2">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Voucher dan hadiah"
            accessibilityHint="Buka voucher"
            haptic
            hitSlop={ACTION_HIT_SLOP}
            onPress={() => router.push(ROUTES.vouchers)}
            containerClassName={cn("rounded-full", focusRing)}
            className="h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <Icon icon={Gift} size={20} weight="fill" tone="active" />
          </PressableScale>

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

          {/* Profil — 40px, sejajar dengan logo */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Profil {x}", { x: displayName })}
            accessibilityHint="Buka pengaturan"
            haptic
            hitSlop={ACTION_HIT_SLOP}
            onPress={() => router.push(ROUTES.settings)}
            containerClassName={cn("rounded-full", focusRing)}
            className="relative h-10 w-10"
          >
            {profileQuery.loading ? (
              <Skeleton shape="circle" width={ACTION_BOX} height={ACTION_BOX} />
            ) : (
              <Avatar
                source={profileQuery.data?.avatarUrl ?? undefined}
                name={displayName}
                size="md"
              />
            )}
          </PressableScale>
        </View>
      </View>

      {/* ── Pencarian + kelola showcase ── */}
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

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Kelola showcase saya"
          accessibilityHint="Buka halaman untuk menambah dan mengatur showcase"
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
