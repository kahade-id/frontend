/**
 * Screen — Order Link Saya (GET /v1/orders/links/my).
 * Daftar link aktif/kedaluwarsa + buka detail di OrderLinkPreviewCard/Share.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { LinkSimple } from "phosphor-react-native"
import { router } from "expo-router"

import { api, type OrderLink } from "@/lib/api"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { OrderLinkShareCard } from "@/components/ui/order-link-share-card"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useCopy } from "@/lib/clipboard"
import { useToast } from "@/components/ui/toast"

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  ACCEPTED: "Diterima",
  CANCELLED: "Dibatalkan",
  EXPIRED: "Kedaluwarsa",
}

export default function OrderLinksScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()

  const [items, setItems] = useState<OrderLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.orders.listMyOrderLinks({ page: 1, limit: 50 })
      setItems(res.data ?? [])
    } catch {
      setError("Gagal memuat tautan order.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchLinks()
  }, [fetchLinks])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchLinks()
    setRefreshing(false)
  }, [fetchLinks])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Order Link" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={LinkSimple} title="Memuat tautan…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchLinks()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={LinkSimple}
            title="Belum ada tautan"
            description="Buat order link dari layar buat transaksi."
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title="Tautan saya" />
            {items.map((link) => (
              <OrderLinkShareCard
                key={link.token}
                url={link.url ?? `kahade://order-link/${link.token}`}
                title={link.title}
                amount={link.orderValue}
                orderCode={link.token}
                status={{ label: STATUS_LABELS[link.status] ?? link.status, tone: link.status === "ACTIVE" ? "success" : "neutral" }}
                expiresLabel={link.expiresAt ? `Berlaku hingga ${formatDateTime(link.expiresAt)}` : undefined}
                onCopy={(url) => void copy(url)}
                onShare={(payload) => {
                  toast.show({ title: "Bagikan", description: payload.url, tone: "info", duration: 4000 })
                }}
                className="mb-4"
              />
            ))}
            <Button
              variant="secondary"
              onPress={() => router.push(ROUTES.createTransaction)}
            >
              Buat Tautan Baru
            </Button>
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
