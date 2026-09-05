/**
 * Kahade — Tab Beranda (ringkasan / overview).
 *
 * Tugas screen ini:
 *   1. Menyapa user dengan nama + salam waktu hari
 *   2. Menampilkan ringkasan saldo wallet
 *   3. Menampilkan jumlah order aktif dari GET /v1/orders/summary
 *   4. Quick action → Tab Transaksi (screen buat transaksi ada di item #3)
 *
 * Data diambil dari 3 endpoint PARALEL (tidak await berurutan) agar
 * waktu muat setara dengan endpoint paling lambat, bukan jumlah semua.
 * Error tiap endpoint ditangani TERPISAH: satu gagal tidak membunuh
 * keseluruhan halaman.
 *
 * Negasi state:
 *   loading  → SkeletonGroup per kartu (§8 loading)
 *   success  → data tampil
 *   error    → teks singkat + tombol "Coba lagi" per bagian
 *   (empty tidak relevan: user selalu punya wallet; summary boleh semua nol)
 *
 * Aksesibilitas:
 *   - Avatar: accessibilityRole="image" sudah ada di komponen
 *   - Saldo: accessibilityLiveRegion="polite" agar screen reader
 *     mengumumkan saat nilai berubah setelah fetch
 *   - Button: accessibilityRole="button" sudah bawaan PressableScale
 *   - focusRing pada container Button (web keyboard, §11)
 *
 * Keputusan non-obvious:
 *   - ROUTES.createTransaction belum ada → quick action mengarah ke
 *     ROUTES.transactions sampai item #3 selesai dan route itu dibuat.
 *   - countActiveOrders menjumlahkan hanya status "dalam proses"; status
 *     terminal (COMPLETED, CANCELLED, REFUNDED, DISPUTED) tidak dihitung aktif.
 *     Cocokkan dengan backend bila OrderStatus berubah.
 *   - Screen pakai `background="surface"` dan card `variant="elevated"`
 *     agar card putih terlihat naik di atas latar abu muda (hierarki §6).
 *   - `edges={["top"]}` di Screen: tab bar sudah menangani bottom safe area
 *     di level layout (RouterBottomTabBar). Screen tidak boleh double-inset.
 *   - M3: ikon ArrowRight pakai <Icon tone="secondary"> agar mengikuti token
 *     warna sistem (icon.color.light.default = gray.600), bukan hardcode hex.
 *   - P4: countActiveOrders menggunakan typeof === "number" untuk type-safe
 *     sum — menghindari NaN bila ada key OrderSummary bukan angka.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { ArrowRight, Lightning } from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { HStack, VStack } from "@/components/ui/stack"
import { getWallet, type Wallet } from "@/lib/api/wallet"
import { getMe, type UserProfile } from "@/lib/api/users"
import { getOrdersSummary, type OrderSummary } from "@/lib/api/orders"
import { formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"

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

/**
 * Jumlahkan status order yang dianggap "aktif" (sedang berjalan).
 * Status terminal (COMPLETED, CANCELLED, REFUNDED, DISPUTED) tidak dihitung.
 * P4: typeof === "number" memastikan hanya nilai numerik yang dijumlahkan.
 */
function countActiveOrders(summary: OrderSummary | null): number {
  if (!summary) return 0
  const ACTIVE: Array<keyof OrderSummary> = [
    "PENDING_CONFIRMATION",
    "AWAITING_PAYMENT",
    "PAID",
    "IN_PROGRESS",
    "SHIPPED",
    "DELIVERED",
  ]
  return ACTIVE.reduce((acc, key) => {
    const val = summary[key]
    return acc + (typeof val === "number" ? val : 0)
  }, 0)
}

// ------------------------------------------------------------------
// Skeleton placeholders
// ------------------------------------------------------------------

function HeaderSkeleton() {
  return (
    <SkeletonGroup>
      <HStack gap={3} className="py-2">
        <Skeleton shape="circle" width={40} height={40} />
        <VStack gap={1} flex>
          <Skeleton height={12} className="w-1/3" />
          <Skeleton height={18} className="w-1/2" />
        </VStack>
      </HStack>
    </SkeletonGroup>
  )
}

function BalanceSkeleton() {
  return (
    <SkeletonGroup className="w-full rounded-md border border-border bg-surface-elevated p-5 gap-2">
      <Skeleton height={14} className="w-1/3" />
      <Skeleton height={32} className="w-2/3" />
    </SkeletonGroup>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [summary, setSummary] = useState<OrderSummary | null>(null)

  const [profileLoading, setProfileLoading] = useState(true)
  const [walletLoading, setWalletLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [walletError, setWalletError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- setter dari useState adalah stable
  const fetchAll = useCallback(async () => {
    setProfileLoading(true)
    setWalletLoading(true)
    setSummaryLoading(true)
    setWalletError(null)
    setSummaryError(null)

    await Promise.allSettled([
      getMe()
        .then(setProfile)
        .catch(() => {})
        .finally(() => setProfileLoading(false)),

      getWallet()
        .then(setWallet)
        .catch(() => setWalletError("Gagal memuat saldo."))
        .finally(() => setWalletLoading(false)),

      getOrdersSummary()
        .then(setSummary)
        .catch(() => setSummaryError("Gagal memuat ringkasan order."))
        .finally(() => setSummaryLoading(false)),
    ])
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const activeOrders = countActiveOrders(summary)

  return (
    <Screen edges={["top"]} background="surface">
      {/* ── Header profil ────────────────────────────────── */}
      <View className="px-6 pt-4 pb-2">
        {profileLoading ? (
          <HeaderSkeleton />
        ) : (
          <HStack gap={3} className="py-2" align="center">
            <Avatar
              name={profile?.name ?? ""}
              uri={profile?.avatarUrl}
              size="md"
            />
            <VStack gap={0}>
              <Text variant="caption" tone="secondary">
                {greetingByHour()},
              </Text>
              <Text variant="h3">{profile?.name ?? "—"}</Text>
            </VStack>
          </HStack>
        )}
      </View>

      {/* ── Ringkasan saldo ──────────────────────────────── */}
      <View className="px-6 pb-3">
        {walletLoading ? (
          <BalanceSkeleton />
        ) : walletError ? (
          <Card variant="elevated" className="p-5">
            <Text variant="caption" tone="danger">{walletError}</Text>
            <Button variant="ghost" size="sm" onPress={fetchAll} className="mt-2">
              Coba lagi
            </Button>
          </Card>
        ) : (
          <Card
            variant="elevated"
            className="p-5"
            accessibilityLiveRegion="polite"
          >
            <Text variant="caption" tone="secondary">Saldo tersedia</Text>
            <Text variant="h1" className="mt-1">
              {formatRupiah(wallet?.availableBalance ?? wallet?.balance ?? 0)}
            </Text>
          </Card>
        )}
      </View>

      {/* ── Order aktif ─────────────────────────────────── */}
      <View className="px-6 pb-4">
        <Card variant="elevated" className="p-4">
          {summaryLoading ? (
            <SkeletonGroup>
              <Skeleton height={16} className="w-1/2" />
            </SkeletonGroup>
          ) : summaryError ? (
            <>
              <Text variant="caption" tone="danger">{summaryError}</Text>
              <Button variant="ghost" size="sm" onPress={fetchAll} className="mt-2">
                Coba lagi
              </Button>
            </>
          ) : (
            <HStack align="center" justify="between">
              <VStack gap={0}>
                <Text variant="caption" tone="secondary">Order aktif</Text>
                <Text variant="h2">{activeOrders}</Text>
              </VStack>
              {/* M3: <Icon> + tone="secondary" → token icon.color.light.default (gray.600) */}
              <Button
                variant="ghost"
                size="sm"
                onPress={() => router.push(ROUTES.transactions)}
                accessibilityLabel="Lihat semua transaksi"
              >
                <HStack gap={1} align="center">
                  <Text variant="caption" tone="secondary">Lihat semua</Text>
                  <Icon icon={ArrowRight} size="xs" tone="secondary" />
                </HStack>
              </Button>
            </HStack>
          )}
        </Card>
      </View>

      {/* ── Quick action ─────────────────────────────────── */}
      <View className="px-6">
        <Button
          variant="primary"
          size="lg"
          onPress={() => router.push(ROUTES.transactions)}
          leftIcon={Lightning}
          accessibilityLabel="Buat transaksi baru"
        >
          Buat Transaksi
        </Button>
      </View>
    </Screen>
  )
}
