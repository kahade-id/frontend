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
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import { ArrowRight, Lightning } from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  return ACTIVE.reduce((acc, key) => acc + ((summary[key] as number | undefined) ?? 0), 0)
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
    <SkeletonGroup className="w-full rounded-md border border-border bg-surface-elevated p-5">
      <VStack gap={2}>
        <Skeleton height={12} className="w-1/4" />
        <Skeleton height={28} className="w-2/3" />
      </VStack>
    </SkeletonGroup>
  )
}

function SummarySkeleton() {
  return (
    <SkeletonGroup className="w-full rounded-md border border-border bg-surface-elevated p-5">
      <VStack gap={2}>
        <Skeleton height={12} className="w-1/3" />
        <Skeleton height={22} className="w-1/4" />
        <Skeleton height={12} className="w-2/5" />
      </VStack>
    </SkeletonGroup>
  )
}

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

type FetchState = "loading" | "success" | "error"

export default function HomeScreen() {
  const router = useRouter()

  const [profileState, setProfileState] = useState<FetchState>("loading")
  const [walletState, setWalletState] = useState<FetchState>("loading")
  const [summaryState, setSummaryState] = useState<FetchState>("loading")

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [summary, setSummary] = useState<OrderSummary | null>(null)

  const fetchAll = useCallback(() => {
    setProfileState("loading")
    setWalletState("loading")
    setSummaryState("loading")

    getMe()
      .then((data) => { setProfile(data); setProfileState("success") })
      .catch(() => setProfileState("error"))

    getWallet()
      .then((data) => { setWallet(data); setWalletState("success") })
      .catch(() => setWalletState("error"))

    getOrdersSummary()
      .then((data) => { setSummary(data); setSummaryState("success") })
      .catch(() => setSummaryState("error"))
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const activeOrders = countActiveOrders(summary)

  return (
    <Screen scroll background="surface" padded={false} edges={["top"]}>
      <VStack gap={4} className="px-6 pt-4 pb-8">

        {/* ── Header: sapaan + avatar ── */}
        {profileState === "loading" ? (
          <HeaderSkeleton />
        ) : profileState === "error" ? (
          // fix M3: handle error state profil — sebelumnya layar kosong
          <HStack gap={3} className="py-2">
            <View className="w-10 h-10 rounded-full bg-surface-offset" />
            <VStack gap={0} flex>
              <Text variant="caption" tone="secondary">{greetingByHour()},</Text>
              <Text variant="h2" tone="secondary" numberOfLines={1}>Pengguna</Text>
            </VStack>
          </HStack>
        ) : (
          <HStack gap={3} className="py-2">
            <Avatar
              source={profile?.avatarUrl ?? undefined}
              name={profile?.fullName ?? profile?.username ?? ""}
              size="md"
            />
            <VStack gap={0} flex>
              <Text variant="caption" tone="secondary">
                {greetingByHour()},
              </Text>
              <Text variant="h2" numberOfLines={1}>
                {profile?.fullName ?? profile?.username ?? "Pengguna"}
              </Text>
            </VStack>
          </HStack>
        )}

        {/* ── Saldo Wallet ── */}
        {walletState === "loading" ? (
          <BalanceSkeleton />
        ) : walletState === "error" ? (
          <Card variant="elevated">
            <VStack gap={2}>
              <Text variant="body" tone="secondary">Gagal memuat saldo</Text>
              <Button variant="secondary" size="sm" fullWidth={false} onPress={fetchAll}>
                Coba lagi
              </Button>
            </VStack>
          </Card>
        ) : (
          <Card variant="elevated">
            <VStack gap={1}>
              <Text variant="caption" tone="secondary">Saldo Dompet</Text>
              <Text
                variant="h1"
                accessibilityLabel={`Saldo dompet ${formatRupiah(wallet?.balance ?? 0)}`}
                accessibilityLiveRegion="polite"
              >
                {formatRupiah(wallet?.balance ?? 0)}
              </Text>
              {(wallet?.holdBalance ?? 0) > 0 ? (
                <Text variant="caption" tone="secondary">
                  {formatRupiah(wallet!.holdBalance!)} ditahan escrow
                </Text>
              ) : null}
            </VStack>
          </Card>
        )}

        {/* ── Ringkasan Order Aktif ── */}
        {summaryState === "loading" ? (
          <SummarySkeleton />
        ) : summaryState === "error" ? (
          <Card variant="elevated">
            <VStack gap={2}>
              <Text variant="body" tone="secondary">Gagal memuat ringkasan order</Text>
              <Button variant="secondary" size="sm" fullWidth={false} onPress={fetchAll}>
                Coba lagi
              </Button>
            </VStack>
          </Card>
        ) : (
          <Card
            variant="elevated"
            onPress={() => router.push(ROUTES.transactions)}
            accessibilityLabel={`${activeOrders} order aktif, ketuk untuk lihat semua`}
          >
            <HStack justify="between" align="center">
              <VStack gap={1} flex>
                <Text variant="caption" tone="secondary">Order Aktif</Text>
                <Text variant="h2">{String(activeOrders)}</Text>
                <Text variant="caption" tone="secondary">
                  {activeOrders === 0
                    ? "Belum ada transaksi berjalan"
                    : `${activeOrders} transaksi sedang berjalan`}
                </Text>
              </VStack>
              <ArrowRight
                size={20}
                color="#868E96"
                weight="regular"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </HStack>
          </Card>
        )}

        {/* ── Quick Action: Buat Transaksi ── */}
        {/*
          Mengarah ke tab Transaksi sementara screen "Buat Transaksi" belum
          ada (akan dibuat di item #3). Setelah ROUTES.createTransaction
          ditambahkan ke routes.ts, ganti ROUTES.transactions di sini.
        */}
        <Button
          variant="primary"
          leftIcon={Lightning}
          onPress={() => router.push(ROUTES.transactions)}
          accessibilityLabel="Buat transaksi baru"
        >
          Buat Transaksi
        </Button>

      </VStack>
    </Screen>
  )
}
