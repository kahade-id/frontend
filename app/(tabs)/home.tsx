/**
 * Kahade — Tab Beranda (ringkasan / overview).
 *
 * Tugas screen ini:
 *   1. Menyapa user dengan nama + salam waktu hari
 *   2. Ringkasan saldo → `GET /v1/wallet` (Wallet + hold escrow)
 *   3. Ringkasan order → `GET /v1/orders/summary`
 *      · "Order aktif" = jumlah status yang masih berjalan
 *      · "Total transaksi" = total seluruh order
 *   4. Quick action → Buat Transaksi (screen belum ada → toast info)
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
import { ArrowRight, Lightning, Receipt, Wallet } from "phosphor-react-native"

import { api, type OrderSummary, type UserProfile, type Wallet as WalletData } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"

import { Amount } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Icon } from "@/components/ui/icon"
import { ProfileHeader } from "@/components/ui/profile-header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
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

        {/* ── Aksi ────────────────────────────────────────────── */}
        <VStack gap={3} className="px-6 pt-8">
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
