/**
 * Screen — Kelola Produk Saya (GAP-D G262, G264, G273).
 * GET /v1/products/seller/mine · /v1/inventory/low-stock.
 */
import { Pressable, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { ROUTES } from "@/lib/routes"
import { api } from "@/lib/api"
import type { Product } from "@/lib/api/products"
import { PRODUCT_STATUS_LABEL, PRODUCT_MODERATION_LABEL, productStatusBadgeTone, sellableQty } from "@/lib/api/products"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { useTheme } from "@/components/theme-provider"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Package, Plus } from "phosphor-react-native"

export default function SellerProductsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()
  const c = tokens.colors[mode]
  const warningText = tokens.colors.semantic.warning[mode].text
  const dangerText = tokens.colors.semantic.danger[mode].text
  const query = usePaginatedQuery<Product>(
    "my-products",
    (page, signal) => api.products.listMyProducts({ page, limit: 20 }, signal),
    { refreshOnFocus: true },
  )
  const lowStockQuery = useApiQuery<Product[]>("low-stock", (signal) => api.products.listLowStock(signal))
  const lowStock = lowStockQuery.data ?? []

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
                <Text style={{ color: warningText }}>
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
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(ROUTES.sellerProductDetail(item.id))}
            // UI-F005: role + label untuk screen reader.
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${formatRupiah(item.priceRupiah)}, ${PRODUCT_STATUS_LABEL[item.status]}`}
            style={{ paddingHorizontal: tokens.space[4], marginBottom: tokens.space[3] }}
          >
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>{item.name}</Text>
                {/* UI-F006: tone semantik per status. */}
                <Badge tone={productStatusBadgeTone(item.status)}>{PRODUCT_STATUS_LABEL[item.status]}</Badge>
              </View>
              <Text style={{ color: c.textTertiary, fontSize: 12 }}>
                SKU {item.sku} · {PRODUCT_MODERATION_LABEL[item.moderationStatus]}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: tokens.space[1] }}>
                <Text style={{ fontWeight: "700" }}>{formatRupiah(item.priceRupiah)}</Text>
                <Text style={{ color: sellableQty(item) > 0 ? c.textPrimary : dangerText }}>
                  {/* UI-F015: guard null dari API — jangan tampilkan "dicadangkan ". */}
                  Stok {sellableQty(item)} (dicadangkan {item.quantityReserved ?? 0})
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  )
}
