/**
 * Screen — Kelola Produk Saya (GAP-D G262, G264, G273).
 * GET /v1/products/seller/mine · /v1/inventory/low-stock.
 */
import { memo, useCallback } from "react"
import { Pressable, View } from "react-native"
import { useRouter } from "expo-router"

import { ROUTES } from "@/lib/routes"
import { api } from "@/lib/api"
import type { Product } from "@/lib/api/products"
import { PRODUCT_STATUS_LABEL, PRODUCT_MODERATION_LABEL, productStatusBadgeTone, sellableQty } from "@/lib/api/products"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { Package, Plus } from "phosphor-react-native"

/** PERF-FIX (TIM1-P1): baris di-memo — onPress stabil per id, tidak ada
 * closure inline per render. */
const SellerProductRow = memo(function SellerProductRow({
  item,
  onSelect,
}: {
  item: Product
  onSelect: (id: string) => void
}) {
  const handlePress = useCallback(() => onSelect(item.id), [onSelect, item.id])
  const qty = sellableQty(item)
  return (
    <Pressable
      onPress={handlePress}
      // UI-F005: role + label untuk screen reader.
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatRupiah(item.priceRupiah)}, ${PRODUCT_STATUS_LABEL[item.status]}`}
      style={{ paddingHorizontal: tokens.space[4], marginBottom: tokens.space[3] }}
    >
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="body" weight={700} style={{ flex: 1 }} numberOfLines={1}>{item.name}</Text>
          {/* UI-F006: tone semantik per status. */}
          <Badge tone={productStatusBadgeTone(item.status)}>{PRODUCT_STATUS_LABEL[item.status]}</Badge>
        </View>
        <Text variant="caption" tone="secondary">
          SKU {item.sku} · {PRODUCT_MODERATION_LABEL[item.moderationStatus]}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: tokens.space[1] }}>
          <Amount value={item.priceRupiah} size="body" />
          <Text tone={qty > 0 ? "primary" : "danger"}>
            {/* UI-F015: guard null dari API — jangan tampilkan "dicadangkan ". */}
            Stok {qty} (dicadangkan {item.quantityReserved ?? 0})
          </Text>
        </View>
      </Card>
    </Pressable>
  )
})

export default function SellerProductsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const query = usePaginatedQuery<Product>(
    "my-products",
    (page, signal) => api.products.listMyProducts({ page, limit: 20 }, signal),
    // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
    { refreshOnFocus: true, refreshOnFocusStaleMs: 30_000 },
  )
  const lowStockQuery = useApiQuery<Product[]>("low-stock", (signal) => api.products.listLowStock(signal))
  const lowStock = lowStockQuery.data ?? []

  // PERF-FIX (TIM1-P1): handler + renderItem stabil.
  const handleSelectSellerProduct = useCallback(
    (id: string) => router.push(ROUTES.sellerProductDetail(id)),
    [router],
  )
  const renderSellerProductItem = useCallback(
    ({ item }: { item: Product }) => (
      <SellerProductRow
        item={item}
        onSelect={handleSelectSellerProduct}
      />
    ),
    [handleSelectSellerProduct],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Produk Saya" />
      {lowStock.length > 0 ? (
        <View style={{ padding: tokens.space[4], paddingBottom: 0 }}>
          <Card>
            <SectionHeader title={`Stok menipis (${lowStock.length})`} />
            {lowStock.slice(0, 5).map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(ROUTES.sellerProductDetail(p.id))}
                // UI-F007: target sentuh ≥44pt + role/label aksesibilitas
                // (sebelumnya baris teks tanpa padding).
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, tersisa ${sellableQty(p)}`}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text tone="warning">
                  {p.name} — tersisa {sellableQty(p)}
                </Text>
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}
      <View style={{ padding: tokens.space[4] }}>
        {/* UI-F017: pola leftIcon, bukan karakter "+" mentah. */}
        <Button leftIcon={Plus} onPress={() => router.push(ROUTES.newSellerProduct)}>Tambah Produk</Button>
      </View>
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={<EmptyState icon={Package} title="Belum ada produk" description="Tambahkan produk pertama Anda." />}
        renderItem={renderSellerProductItem}
      />
    </Screen>
  )
}
