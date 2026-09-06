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
 * Data diambil dari 3 endpoint melalui `useApiQuery` (profil, saldo,
 * ringkasan order) — satu gagal tidak membunuh halaman; tiap bagian punya
 * error + retry sendiri, request lama DIABORT sehingga respons lambat tidak
 * bisa menimpa hasil baru, dan saldo dimuat ulang diam-diam saat tab kembali
 * fokus (`refreshOnFocus`) agar tidak menampilkan angka basi setelah
 * top-up/withdraw/transfer di layar lain.
 *
 * Komponen sistem: ProfileHeader, StatCard, Amount, Button, Skeleton.
 * Tidak ada markup card custom dan tidak ada angka/format hardcoded.
 */
import { useCallback } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { useApiQuery } from "@/lib/use-api-query"
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
import { tokens } from "@/lib/tokens"

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

  // Tiga query terpisah (bukan satu Promise.allSettled manual): request lama
  // di-abort saat refresh, pesan galat tetap `userMessage(err)`, dan retry
  // tiap kartu TIDAK me-reset bagian lain ke skeleton.
  const profile = useApiQuery<UserProfile>("home-profile", (signal) =>
    api.users.getMe(signal),
  )
  const wallet = useApiQuery<WalletData>("home-wallet", (signal) => api.wallet.getWallet(signal), true, {
    refreshOnFocus: true,
  })
  const summary = useApiQuery<OrderSummary>("home-order-summary", (signal) =>
    api.orders.getOrdersSummary(signal),
  )

  const handleRefresh = useCallback(async () => {
    await Promise.all([profile.refresh(), wallet.refresh(), summary.refresh()])
  }, [profile.refresh, wallet.refresh, summary.refresh])

  const activeOrders = countActiveOrders(summary.data)
  const totalOrdersCount = totalOrders(summary.data)

  const handleCreate = useCallback(() => {
    router.push(ROUTES.createTransaction)
  }, [router])

  const quickActions: QuickAction[] = [
    { key: "topup", icon: Wallet, label: "Isi Saldo", onPress: () => router.push(ROUTES.topup) },
    {
      key: "order-links",
      icon: LinkSimple,
      label: "Order Link",
      onPress: () => router.push(ROUTES.orderLinks),
    },
    { key: "chat", icon: ChatCircleDots, label: "Chat", onPress: () => router.push(ROUTES.chat) },
    {
      key: "disputes",
      icon: Scales,
      label: "Sengketa",
      badge: summary.data?.DISPUTED || undefined,
      onPress: () => router.push(ROUTES.disputes),
    },
    {
      key: "discover",
      icon: Compass,
      label: "Jelajahi",
      onPress: () => router.push(ROUTES.discover),
    },
    {
      key: "vouchers",
      icon: Ticket,
      label: "Voucher",
      onPress: () => router.push(ROUTES.vouchers),
    },
    { key: "referral", icon: Gift, label: "Referral", onPress: () => router.push(ROUTES.referral) },
    {
      key: "analytics",
      icon: ChartLineUp,
      label: "Analitik",
      onPress: () => router.push(ROUTES.analytics),
    },
  ]

  return (
    <Screen edges={["top"]} padded={false}>
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={profile.refreshing || wallet.refreshing || summary.refreshing}
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: tokens.space[8] },
        }}
      >
        {/* ── Identitas: salam + profil ───────────────────────── */}
        <View className="px-6 pt-4">
          <Text variant="caption" tone="secondary">
            {greetingByHour()},
          </Text>
        </View>
        {profile.error ? (
          <ErrorState
            compact
            title="Gagal memuat profil"
            description={profile.error}
            onRetry={() => void profile.reload()}
          />
        ) : (
          <ProfileHeader
            name={profile.data?.fullName ?? "—"}
            handle={profile.data?.username ? `@${profile.data.username}` : undefined}
            avatar={{ source: profile.data?.avatarUrl ?? undefined }}
            loading={profile.loading}
          />
        )}

        {/* ── Ringkasan ───────────────────────────────────────── */}
        <View className="gap-4 px-6 pt-2">
          {wallet.error ? (
            <ErrorState
              compact
              title="Gagal memuat saldo"
              description={wallet.error}
              onRetry={() => void wallet.reload()}
            />
          ) : (
            <StatCard
              label="Saldo tersedia"
              icon={<Icon icon={Wallet} size="xs" tone="default" />}
              loading={wallet.loading}
              value={<Amount value={wallet.data?.availableBalance ?? Number.NaN} size="large" />}
              hint={
                (wallet.data?.holdBalance ?? 0) > 0
                  ? `${formatRupiah(wallet.data?.holdBalance ?? 0)} ditahan escrow`
                  : undefined
              }
            />
          )}

          {summary.error ? (
            <ErrorState
              compact
              title="Gagal memuat ringkasan order"
              description={summary.error}
              onRetry={() => void summary.reload()}
            />
          ) : (
            <View className="flex-row gap-3">
              <StatCard
                label="Order aktif"
                icon={<Icon icon={Receipt} size="xs" tone="default" />}
                loading={summary.loading}
                value={activeOrders}
                mono
                className="flex-1"
              />
              <StatCard
                label="Total transaksi"
                icon={<Icon icon={ChartLineUp} size="xs" tone="default" />}
                loading={summary.loading}
                value={totalOrdersCount}
                mono
                className="flex-1"
              />
            </View>
          )}
        </View>

        {/*
         * ── Aksi utama ──────────────────────────────────────────
         * Urutan komposisi (audit): CTA primer NAIK ke atas pintasan.
         * Sebelumnya "Buat Transaksi" — alasan utama layar ini ada —
         * berada di paling bawah, setelah 8 ubin pintasan sekunder,
         * sehingga aksi terpenting justru paling jauh dari jempol dan
         * sering di luar layar pertama. Sekarang ia menempel langsung di
         * bawah ringkasan saldo/order yang menjadi konteksnya.
         */}
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

        {/* ── Pintasan ────────────────────────────────────────── */}
        <View className="px-6 pt-8">
          <SectionHeader title="Pintasan" />
          <QuickActionGrid actions={quickActions} className="pt-2" />
        </View>
      </PullToRefresh>
    </Screen>
  )
}
