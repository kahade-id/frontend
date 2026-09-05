/**
 * Kahade — Tab Beranda (ringkasan / overview).
 *
 * Tugas screen ini:
 *   1. Menyapa user dengan nama + salam waktu hari
 *   2. Ringkasan saldo → `GET /v1/wallet` (Wallet + hold escrow)
 *   3. Ringkasan order → `GET /v1/orders/summary`
 *      · "Order aktif" = jumlah status yang masih berjalan
 *      · "Total transaksi" = total seluruh order
 *   4. Quick action → Buat Transaksi + grid pintasan (Isi Saldo, Order
 *      Link, Chat, Sengketa, Jelajahi, Voucher, Referral, Analitik) — semua
 *      route dari lib/routes.ts.
 *
 * Data diambil dari 3 endpoint PARALEL (`Promise.allSettled`) — satu gagal
 * tidak membunuh halaman; tiap bagian punya error + retry sendiri.
 *
 * Komponen sistem: ProfileHeader, StatCard, Amount, Button, Skeleton.
 * Tidak ada markup card custom dan tidak ada angka/format hardcoded.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import {
  ArrowRight,
  ChartLineUp,
  ChatCircleDots,
  Compass,
  Gift,
  Lightning,
  LinkSimple,
  Receipt,
  Scales,
  Ticket,
  Wallet,
} from "phosphor-react-native"

import { api, type OrderSummary, type UserProfile, type Wallet as WalletData } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"

import { Amount } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { ProfileHeader } from "@/components/ui/profile-header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QuickActionGrid, type QuickAction } from "@/components/ui/quick-action-grid"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { StatCard } from "@/components/ui/stat-card"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function greetingByHour(): string {
  const h = new Date().getHours()
  if (h < 11) return "Selamat pagi"
  if (h < 15) return "Selamat siang"
  if (h < 18) return "Selamat sore"
  return "Selamat malam"
}

/** Status yang termasuk "masih berjalan" (vokal: ACTIVE di API list). */
const ACTIVE_KEYS: readonly string[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
]

function sumNumeric(rec: Record<string, unknown>, keys?: readonly string[]): number {
  const target = keys ?? Object.keys(rec)
  return target.reduce((acc, key) => {
    const v = rec[key]
    return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0)
  }, 0)
}

function countActiveOrders(summary: OrderSummary | null): number {
  if (!summary) return 0
  return sumNumeric(summary, ACTIVE_KEYS)
}

/** Total seluruh order (field `total` bila ada, else jumlah semua status). */
function totalOrders(summary: OrderSummary | null): number {
  if (!summary) return 0
  if (typeof summary.total === "number") return summary.total
  return sumNumeric(summary)
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [summary, setSummary] = useState<OrderSummary | null>(null)

  const [profileLoading, setProfileLoading] = useState(true)
  const [walletLoading, setWalletLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [walletError, setWalletError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setProfileLoading(true)
    setWalletLoading(true)
    setSummaryLoading(true)
    setWalletError(null)
    setSummaryError(null)

    await Promise.allSettled([
      api.users
        .getMe()
        .then(setProfile)
        .catch(() => {})
        .finally(() => setProfileLoading(false)),

      api.wallet
        .getWallet()
        .then(setWallet)
        .catch(() => setWalletError("Gagal memuat saldo."))
        .finally(() => setWalletLoading(false)),

      api.orders
        .getOrdersSummary()
        .then(setSummary)
        .catch(() => setSummaryError("Gagal memuat ringkasan order."))
        .finally(() => setSummaryLoading(false)),
    ])
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const activeOrders = countActiveOrders(summary)
  const totalOrdersCount = totalOrders(summary)

  const handleCreate = useCallback(() => {
    router.push(ROUTES.createTransaction)
  }, [router])

  const quickActions: QuickAction[] = [
    { key: "topup", icon: Wallet, label: "Isi Saldo", onPress: () => router.push(ROUTES.topup) },
    { key: "order-links", icon: LinkSimple, label: "Order Link", onPress: () => router.push(ROUTES.orderLinks) },
    { key: "chat", icon: ChatCircleDots, label: "Chat", onPress: () => router.push(ROUTES.chat) },
    {
      key: "disputes",
      icon: Scales,
      label: "Sengketa",
      badge: summary?.DISPUTED || undefined,
      onPress: () => router.push(ROUTES.disputes),
    },
    { key: "discover", icon: Compass, label: "Jelajahi", onPress: () => router.push(ROUTES.discover) },
    { key: "vouchers", icon: Ticket, label: "Voucher", onPress: () => router.push(ROUTES.vouchers) },
    { key: "referral", icon: Gift, label: "Referral", onPress: () => router.push(ROUTES.referral) },
    { key: "analytics", icon: ChartLineUp, label: "Analitik", onPress: () => router.push(ROUTES.analytics) },
  ]

  return (
    <Screen edges={["top"]} background="surface" padded={false}>
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="pb-6"
      >
        {/* ── Identitas: salam + profil ───────────────────────── */}
        <View className="px-6 pt-4">
          <Text variant="caption" tone="secondary">
            {greetingByHour()},
          </Text>
        </View>
        <ProfileHeader
          name={profile?.fullName ?? "—"}
          handle={profile?.username ? `@${profile.username}` : undefined}
          avatar={{ source: profile?.avatarUrl ?? undefined }}
          loading={profileLoading}
        />

        {/* ── Ringkasan ───────────────────────────────────────── */}
        <View className="gap-4 px-6 pt-2">
          {walletError ? (
            <ErrorState
              compact
              title="Gagal memuat saldo"
              description={walletError}
              onRetry={() => void fetchAll()}
            />
          ) : (
            <StatCard
              label="Saldo tersedia"
              icon={<Icon icon={Wallet} size="xs" tone="default" />}
              loading={walletLoading}
              value={<Amount value={wallet?.availableBalance ?? wallet?.balance ?? 0} size="large" />}
              hint={
                (wallet?.holdBalance ?? 0) > 0
                  ? `${formatRupiah(wallet?.holdBalance ?? 0)} ditahan escrow`
                  : undefined
              }
            />
          )}

          {summaryError ? (
            <ErrorState
              compact
              title="Gagal memuat ringkasan order"
              description={summaryError}
              onRetry={() => void fetchAll()}
            />
          ) : (
            <View className="flex-row gap-3">
              <StatCard
                label="Order aktif"
                icon={<Icon icon={Receipt} size="xs" tone="default" />}
                loading={summaryLoading}
                value={activeOrders}
                mono
                className="flex-1"
              />
              <StatCard
                label="Total transaksi"
                icon={<Icon icon={ArrowRight} size="xs" tone="default" />}
                loading={summaryLoading}
                value={totalOrdersCount}
                mono
                className="flex-1"
              />
            </View>
          )}
        </View>

        {/* ── Pintasan ────────────────────────────────────────── */}
        <View className="px-6 pt-6">
          <SectionHeader title="Pintasan" />
          <QuickActionGrid actions={quickActions} className="-mx-1 pt-2" />
        </View>

        {/* ── Aksi ────────────────────────────────────────────── */}
        <VStack gap={3} className="px-6 pt-6">
          <Button variant="primary" size="md" leftIcon={Lightning} onPress={handleCreate}>
            Buat Transaksi
          </Button>
          <Button
            variant="ghost"
            size="md"
            onPress={() => router.push(ROUTES.transactions)}
            rightIcon={ArrowRight}
          >
            Lihat semua transaksi
          </Button>
        </VStack>
      </PullToRefresh>
    </Screen>
  )
}
