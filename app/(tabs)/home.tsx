/**
 * Kahade — Tab Beranda (ringkasan / overview).
 *
 * Susunan layar (redesign 2026-09, referensi pola "beranda super app"
 * di docs/image/Screenshot_20260910-134637.jpg — dipetakan ke produk Kahade,
 * bukan disalin):
 *
 *   1. Bar identitas  : avatar + salam waktu hari + nama + badge tipe akun
 *                       (Personal/Bisnis) → tap membuka Pengaturan; kanan:
 *                       Cari + Pesan (chat). Notifikasi TIDAK ada di sini —
 *                       sudah punya tab sendiri di bottom bar.
 *   2. Kartu hero     : <HomeOverviewCard> — saldo (`GET /v1/wallet`) + aksi
 *                       dompet, statistik order (`GET /v1/orders/summary`:
 *                       Aktif · Selesai · Sengketa), dan notice "perlu
 *                       perhatian" di kaki kartu.
 *   3. Sorotan        : <PromoCarousel> — 3 kartu edukasi fitur Kahade
 *                       (escrow, Order Link, referral) dari palet soft.
 *   4. Menu cepat     : <QuickActionGrid layout="row"> — deret ikon bulat,
 *                       "Buat transaksi" sebagai ubin inverted pertama.
 *   5. Transaksi aktif: 3 <OrderCard> terbaru berstatus ACTIVE
 *                       (`GET /v1/orders?status=ACTIVE&limit=3`) + "Lihat
 *                       semua". Kosong → ajakan buat transaksi pertama.
 *
 * Data diambil dari 4 endpoint melalui `useApiQuery` (profil, saldo,
 * ringkasan order, order aktif) — satu gagal tidak membunuh halaman; tiap
 * bagian punya error + retry sendiri, request lama DIABORT sehingga respons
 * lambat tidak bisa menimpa hasil baru, dan saldo + order aktif dimuat ulang
 * diam-diam saat tab kembali fokus (`refreshOnFocus`) agar tidak menampilkan
 * angka basi setelah top-up/withdraw/bayar di layar lain.
 *
 * Keputusan non-obvious:
 *   - "Sembunyikan saldo" adalah state sesi (useState), bukan persisten:
 *     repo tidak punya AsyncStorage dan SecureStore dipakai untuk rahasia;
 *     default TAMPIL karena Beranda dibuka setelah login/PIN.
 *   - Notice kaki kartu dipilih berdasar prioritas: sengketa aktif (danger)
 *     > order berjalan (primary) > belum ada transaksi (primary, ajakan).
 *     Satu notice saja — lebih dari satu = tidak ada yang penting.
 *   - Section reveal <Stagger> step 60ms (total ~430ms untuk 5 section):
 *     Beranda layar pertama setelah login; stagger memberi rasa "dibangun"
 *     tanpa menunda interaksi.
 *
 * Komponen sistem: Avatar, Badge, IconButton, HomeOverviewCard, PromoCarousel,
 * QuickActionGrid, OrderCard, SectionHeader, EmptyState, Skeleton.
 * Tidak ada markup card custom dan tidak ada angka/format hardcoded.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { useApiQuery } from "@/lib/use-api-query"
import {
  ArrowCircleDown,
  ArrowCircleUp,
  ChartLineUp,
  Compass,
  Gift,
  Lightning,
  LinkSimple,
  PaperPlaneTilt,
  QrCode,
  Receipt,
  Scales,
  ShieldCheck,
  Ticket,
  Tray,
  UsersThree,
  Wallet,
} from "phosphor-react-native"

import { api, type OrderSummary, type UserProfile, type Wallet as WalletData } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Stagger } from "@/components/ui/fade-in"
import { HomeOverviewCard, type OverviewNotice } from "@/components/ui/home-overview-card"
import { Icon } from "@/components/ui/icon"
import { OrderCard, OrderCardSkeleton } from "@/components/ui/order-card"
import { PressableScale } from "@/components/ui/pressable-scale"
import { PromoCarousel, type PromoItem } from "@/components/ui/promo-carousel"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QuickActionGrid, type QuickAction } from "@/components/ui/quick-action-grid"
import { RouteLink } from "@/components/ui/route-link"
import { Screen } from "@/components/ui/screen"
import { SearchTrigger } from "@/components/ui/search-field"
import { SectionHeader } from "@/components/ui/section"
import { Skeleton } from "@/components/ui/skeleton"
import { SmartAppInstallCard } from "@/components/ui/smart-app-install-card"
import { Text } from "@/components/ui/text"
import { focusRing } from "@/lib/focus-ring"
import { cn } from "@/lib/cn"

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

function sumNumeric(rec: Record<string, unknown>, keys: readonly string[]): number {
  return keys.reduce((acc, key) => {
    const v = rec[key]
    return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0)
  }, 0)
}

function countActiveOrders(summary: OrderSummary | null): number {
  if (!summary) return 0
  return sumNumeric(summary, ACTIVE_KEYS)
}

function countByKey(summary: OrderSummary | null, key: string): number {
  const v = summary?.[key]
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

/** Jumlah kartu order aktif yang ditampilkan di Beranda. */
const ACTIVE_PREVIEW_LIMIT = 3

/** Sorotan fitur — edukasi produk Kahade, bukan promo pihak ketiga. */
const PROMOS: readonly PromoItem[] = [
  {
    key: "escrow",
    eyebrow: "Escrow Kahade",
    title: "Dana aman sampai barang diterima",
    description: "Uang ditahan Kahade dan baru diteruskan ke penjual setelah kamu konfirmasi.",
    cta: "Cara kerjanya",
    icon: ShieldCheck,
    tone: "accent",
    href: ROUTES.faq,
  },
  {
    key: "order-link",
    eyebrow: "Order Link",
    title: "Jualan cukup kirim satu tautan",
    description: "Buat link transaksi sekali, bagikan ke pembeli di chat mana pun.",
    cta: "Buat Order Link",
    icon: LinkSimple,
    tone: "info",
    href: ROUTES.orderLinks,
  },
  {
    key: "referral",
    eyebrow: "Referral",
    title: "Ajak teman, dapat bonus saldo",
    description: "Bagikan kode referralmu dan raih hadiah tiap teman selesai bertransaksi.",
    cta: "Lihat kode saya",
    icon: UsersThree,
    tone: "warning",
    href: ROUTES.referral,
  },
]

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter()
  const [balanceHidden, setBalanceHidden] = useState(false)

  // Empat query terpisah (bukan satu Promise.allSettled manual): request lama
  // di-abort saat refresh, pesan galat tetap `userMessage(err)`, dan retry
  // tiap bagian TIDAK me-reset bagian lain ke skeleton.
  const profile = useApiQuery<UserProfile>("home-profile", (signal) =>
    api.users.getMe(signal),
  )
  const wallet = useApiQuery<WalletData>("home-wallet", (signal) => api.wallet.getWallet(signal), true, {
    refreshOnFocus: true,
  })
  const summary = useApiQuery<OrderSummary>(
    "home-order-summary",
    (signal) => api.orders.getOrdersSummary(signal),
    true,
    { refreshOnFocus: true },
  )
  const activeOrders = useApiQuery(
    "home-active-orders",
    (signal) => api.orders.listOrders({ page: 1, limit: ACTIVE_PREVIEW_LIMIT, status: "ACTIVE" }, signal),
    true,
    { refreshOnFocus: true },
  )

  const handleRefresh = useCallback(async () => {
    await Promise.all([profile.refresh(), wallet.refresh(), summary.refresh(), activeOrders.refresh()])
  }, [profile.refresh, wallet.refresh, summary.refresh, activeOrders.refresh])

  const activeCount = countActiveOrders(summary.data)
  const completedCount = countByKey(summary.data, "COMPLETED")
  const disputedCount = countByKey(summary.data, "DISPUTED")

  const handleCreate = useCallback(() => {
    router.push(ROUTES.createTransaction)
  }, [router])

  // Satu notice, dipilih berdasar prioritas — lihat docblock.
  const notice: OverviewNotice | undefined = summary.loading
    ? undefined
    : disputedCount > 0
      ? {
          tone: "danger",
          title: `${disputedCount} sengketa perlu perhatianmu`,
          description: "Tanggapi sebelum tenggat agar dana tidak tertahan lebih lama",
          onPress: () => router.push(ROUTES.disputes),
        }
      : activeCount > 0
        ? {
            tone: "primary",
            title: `${activeCount} transaksi sedang berjalan`,
            description: "Cek status, tenggat, dan langkah berikutnya",
            onPress: () => router.push(ROUTES.transactions),
          }
        : {
            tone: "primary",
            title: "Mulai transaksi pertamamu",
            description: "Jual atau beli dengan dana yang dijaga escrow",
            onPress: handleCreate,
          }

  const quickActions: QuickAction[] = [
    {
      key: "create",
      icon: Lightning,
      label: "Buat transaksi",
      emphasis: true,
      onPress: handleCreate,
    },
    { key: "topup", icon: Wallet, label: "Isi saldo", onPress: () => router.push(ROUTES.topup) },
    {
      key: "order-links",
      icon: LinkSimple,
      label: "Order Link",
      onPress: () => router.push(ROUTES.orderLinks),
    },
    {
      key: "disputes",
      icon: Scales,
      label: "Sengketa",
      badge: disputedCount || undefined,
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

  const displayName = profile.data?.fullName?.trim() || profile.data?.username || "Pengguna Kahade"
  const isBusiness = profile.data?.accountType === "BUSINESS"

  return (
    <Screen edges={["top"]} padded={false} background="surface">
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={
          profile.refreshing || wallet.refreshing || summary.refreshing || activeOrders.refreshing
        }
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: tokens.space[8] },
        }}
      >
        <Stagger duration="fast" step={60}>
          {/* ── 1. Bar identitas ───────────────────────────────── */}
          <View className="flex-row items-center gap-3 px-6 pb-2 pt-3">
            {profile.error ? (
              <View className="flex-1">
                <ErrorState
                  compact
                  title="Gagal memuat profil"
                  description={profile.error}
                  onRetry={() => void profile.reload()}
                />
              </View>
            ) : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={
                  profile.loading
                    ? "Memuat profil"
                    : `${greetingByHour()}, ${displayName}${isBusiness ? ", akun bisnis" : ""}`
                }
                accessibilityHint="Buka Pengaturan akun"
                onPress={() => router.push(ROUTES.settings)}
                scaleOnPress={false}
                containerClassName={cn("min-w-0 flex-1 rounded-sm", focusRing)}
                className="flex-row items-center gap-3 py-1"
              >
                {profile.loading ? (
                  <Skeleton shape="circle" width={40} height={40} />
                ) : (
                  <Avatar source={profile.data?.avatarUrl ?? undefined} name={displayName} size="md" />
                )}
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {greetingByHour()},
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {profile.loading ? (
                      <Skeleton height={tokens.typography.body.lineHeight} className="w-32" />
                    ) : (
                      <>
                        <Text
                          variant="body"
                          weight={600}
                          tone="primary"
                          numberOfLines={1}
                          className="shrink"
                        >
                          {displayName}
                        </Text>
                        <Badge tone={isBusiness ? "info" : "neutral"} variant="soft">
                          {isBusiness ? "Bisnis" : "Personal"}
                        </Badge>
                      </>
                    )}
                  </View>
                </View>
              </PressableScale>
            )}
            <View className="flex-row items-center">
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Pesan"
                accessibilityHint="Buka daftar percakapan"
                haptic
                onPress={() => router.push(ROUTES.chat)}
                containerClassName={cn("rounded-xs", focusRing)}
                className="h-12 w-12 items-center justify-center rounded-xs"
              >
                {/* Ikon chat diperbesar (tray) sesuai permintaan desain */}
                <Icon icon={Tray} size={28} tone="active" />
              </PressableScale>
            </View>
          </View>

          {/* ── 1b. Kolom cari (kartu di atas kartu Saldo) ─────── */}
          <View className="px-6 pt-3">
            <SearchTrigger
              placeholder="Cari transaksi, pengguna, atau ID"
              variant="elevated"
              onPress={() => router.push(ROUTES.search)}
            />
          </View>

          {/* ── 2. Kartu hero: saldo + statistik + notice ──────── */}
          <View className="px-6 pt-3">
            <HomeOverviewCard
              available={wallet.data?.availableBalance}
              held={wallet.data?.holdBalance}
              hidden={balanceHidden}
              borderless
              elevation="low"
              onToggleHidden={() => setBalanceHidden((v) => !v)}
              walletLoading={wallet.loading}
              walletError={wallet.error}
              onRetryWallet={() => void wallet.reload()}
              walletActions={[
                {
                  key: "topup",
                  label: "Isi saldo",
                  icon: ArrowCircleDown,
                  onPress: () => router.push(ROUTES.topup),
                },
                {
                  key: "receive",
                  label: "Terima",
                  icon: QrCode,
                  onPress: () => router.push(ROUTES.receive),
                },
                {
                  key: "transfer",
                  label: "Kirim",
                  icon: PaperPlaneTilt,
                  onPress: () => router.push(ROUTES.transfer),
                },
                {
                  key: "withdraw",
                  label: "Tarik",
                  icon: ArrowCircleUp,
                  onPress: () => router.push(ROUTES.withdraw),
                },
              ]}
              stats={[
                {
                  key: "active",
                  label: "Aktif",
                  count: activeCount,
                  onPress: () => router.push(ROUTES.transactions),
                },
                {
                  key: "completed",
                  label: "Selesai",
                  count: completedCount,
                  onPress: () => router.push(ROUTES.transactions),
                },
                {
                  key: "disputed",
                  label: "Sengketa",
                  count: disputedCount,
                  critical: true,
                  onPress: () => router.push(ROUTES.disputes),
                },
              ]}
              summaryLoading={summary.loading}
              summaryError={summary.error}
              onRetrySummary={() => void summary.reload()}
              notice={notice}
            />
          </View>

          {/* ── 2b. Ajakan unduh aplikasi (hanya web seluler) ──── */}
          {/* Menggantikan banner fixed di atas viewport: tampil
              mengalir tepat di bawah kartu saldo. Komponen mengembalikan
              null di native/desktop/standalone. */}
          <SmartAppInstallCard />

          {/* ── 3. Sorotan fitur ───────────────────────────────── */}
          <PromoCarousel items={PROMOS} className="pt-6" />

          {/* ── 4. Menu cepat ──────────────────────────────────── */}
          <View className="pt-6">
            <SectionHeader title="Menu" level="h3" inset />
            <QuickActionGrid actions={quickActions} layout="row" className="pt-2" />
          </View>

          {/* ── 5. Transaksi aktif ─────────────────────────────── */}
          <View className="gap-3 px-6 pt-6">
            <SectionHeader
              title="Transaksi aktif"
              level="h3"
              action={
                <RouteLink
                  href={ROUTES.transactions}
                  accessibilityLabel="Lihat semua transaksi"
                  containerClassName="rounded-xs"
                >
                  <Text variant="body" weight={600} tone="primary">
                    Lihat semua
                  </Text>
                </RouteLink>
              }
            />
            {activeOrders.error ? (
              <ErrorState
                compact
                title="Gagal memuat transaksi aktif"
                description={activeOrders.error}
                onRetry={() => void activeOrders.reload()}
              />
            ) : activeOrders.loading ? (
              <View className="gap-3">
                <OrderCardSkeleton />
                <OrderCardSkeleton />
              </View>
            ) : (activeOrders.data?.data.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon={Receipt}
                title="Belum ada transaksi berjalan"
                description="Transaksi yang sedang kamu jalankan akan tampil di sini."
                action={
                  <Button variant="primary" size="sm" fullWidth={false} leftIcon={Lightning} onPress={handleCreate}>
                    Buat transaksi
                  </Button>
                }
              />
            ) : (
              <View className="gap-3">
                {activeOrders.data?.data.map((item) => {
                  const role =
                    item.myRole === "SELLER" ? "seller" : item.myRole === "BUYER" ? "buyer" : undefined
                  const counterpart =
                    role === "seller" ? item.buyer : role === "buyer" ? item.seller : undefined
                  return (
                    <OrderCard
                      key={item.id}
                      orderId={item.id}
                      title={item.title}
                      amount={item.orderValue}
                      status={item.status}
                      role={role}
                      counterpart={{
                        name: counterpart?.fullName ?? counterpart?.username ?? "Identitas belum tersedia",
                        avatar: counterpart?.avatarUrl ?? undefined,
                      }}
                      timestamp={formatDateTime(item.createdAt)}
                      deadlineAt={item.deliveryDeadlineAt ? new Date(item.deliveryDeadlineAt) : undefined}
                      onDeadline={() => void activeOrders.refresh()}
                      href={ROUTES.orderDetail(item.id)}
                    />
                  )
                })}
              </View>
            )}
          </View>
        </Stagger>
      </PullToRefresh>
    </Screen>
  )
}
