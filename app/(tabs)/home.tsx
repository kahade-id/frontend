/** Overview: identity → available funds → primary task → activity → shortcuts. */
import { useCallback } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { ArrowRight, ChartLineUp, ChatCircleDots, Compass, Gift, Lightning, LinkSimple, Receipt, Scales, Ticket, Wallet } from "phosphor-react-native"
import { api, type OrderSummary, type UserProfile, type Wallet as WalletData } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
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
import { WalletBalanceCard } from "@/components/ui/wallet-balance-card"

function greetingByHour(): string {
  const hour = new Date().getHours()
  if (hour < 11) return "Selamat pagi"
  if (hour < 15) return "Selamat siang"
  if (hour < 18) return "Selamat sore"
  return "Selamat malam"
}
const ACTIVE_KEYS: readonly string[] = ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"]
function sumNumeric(record: Record<string, unknown>, keys?: readonly string[]): number {
  return (keys ?? Object.keys(record)).reduce((total, key) => {
    const value = record[key]
    return total + (typeof value === "number" && Number.isFinite(value) ? value : 0)
  }, 0)
}
function countActiveOrders(summary: OrderSummary | null): number {
  return summary ? sumNumeric(summary, ACTIVE_KEYS) : 0
}
function totalOrders(summary: OrderSummary | null): number {
  if (!summary) return 0
  if (typeof summary.total === "number") return summary.total
  return sumNumeric(summary)
}
export default function HomeScreen() {
  const router = useRouter()
  // Keep independent errors, abort handling and focus refresh from the existing hooks.
  const profile = useApiQuery<UserProfile>("home-profile", (signal) => api.users.getMe(signal))
  const wallet = useApiQuery<WalletData>("home-wallet", (signal) => api.wallet.getWallet(signal), true, { refreshOnFocus: true })
  const summary = useApiQuery<OrderSummary>("home-order-summary", (signal) => api.orders.getOrdersSummary(signal))
  const handleRefresh = useCallback(async () => {
    await Promise.all([profile.refresh(), wallet.refresh(), summary.refresh()])
  }, [profile.refresh, wallet.refresh, summary.refresh])
  const handleCreate = useCallback(() => router.push(ROUTES.createTransaction), [router])
  const quickActions: QuickAction[] = [
    { key: "topup", icon: Wallet, label: "Isi Saldo", onPress: () => router.push(ROUTES.topup) },
    { key: "order-links", icon: LinkSimple, label: "Order Link", onPress: () => router.push(ROUTES.orderLinks) },
    { key: "chat", icon: ChatCircleDots, label: "Chat", onPress: () => router.push(ROUTES.chat) },
    { key: "disputes", icon: Scales, label: "Sengketa", badge: summary.data?.DISPUTED || undefined, onPress: () => router.push(ROUTES.disputes) },
    { key: "discover", icon: Compass, label: "Jelajahi", onPress: () => router.push(ROUTES.discover) },
    { key: "vouchers", icon: Ticket, label: "Voucher", onPress: () => router.push(ROUTES.vouchers) },
    { key: "referral", icon: Gift, label: "Referral", onPress: () => router.push(ROUTES.referral) },
    { key: "analytics", icon: ChartLineUp, label: "Analitik", onPress: () => router.push(ROUTES.analytics) },
  ]
  return (
    <Screen edges={["top"]} padded={false}>
      <PullToRefresh onRefresh={handleRefresh} refreshing={profile.refreshing || wallet.refreshing || summary.refreshing}
        scrollViewProps={{ contentContainerStyle: { paddingBottom: tokens.space[8] } }}>
        <View className="px-6 pt-6"><Text variant="caption" tone="secondary">{greetingByHour()},</Text></View>
        {profile.error ? <ErrorState compact title="Gagal memuat profil" description={profile.error} onRetry={() => void profile.reload()} />
          : <ProfileHeader name={profile.data?.fullName ?? "—"} handle={profile.data?.username ? `@${profile.data.username}` : undefined}
              avatar={{ source: profile.data?.avatarUrl ?? undefined }} loading={profile.loading} />}

        <View className="gap-4 px-6 pt-4">
          {wallet.error ? <ErrorState compact title="Gagal memuat saldo" description={wallet.error} onRetry={() => void wallet.reload()} />
            : <WalletBalanceCard available={wallet.data?.availableBalance} held={wallet.data?.holdBalance} loading={wallet.loading} />}
          <Button variant="primary" leftIcon={Lightning} onPress={handleCreate} accessibilityHint="Mulai membuat transaksi baru">Buat Transaksi</Button>
        </View>

        <View className="gap-4 px-6 pt-8">
          <SectionHeader title="Aktivitas Anda" level="h3" />
          {summary.error ? <ErrorState compact title="Gagal memuat ringkasan order" description={summary.error} onRetry={() => void summary.reload()} />
            : <View className="flex-row gap-4">
              <StatCard label="Order aktif" icon={<Icon icon={Receipt} size="xs" />} loading={summary.loading}
                value={countActiveOrders(summary.data)} mono className="flex-1" />
              <StatCard label="Total transaksi" icon={<Icon icon={ChartLineUp} size="xs" />} loading={summary.loading}
                value={totalOrders(summary.data)} mono className="flex-1" />
            </View>}
          <Button variant="ghost" size="sm" onPress={() => router.push(ROUTES.transactions)} rightIcon={ArrowRight}>Lihat semua transaksi</Button>
        </View>
        <View className="gap-2 px-6 pt-8">
          <SectionHeader title="Pintasan" level="h3" />
          <QuickActionGrid actions={quickActions} />
        </View>
      </PullToRefresh>
    </Screen>
  )
}
