/**
 * Screen — Katalog Produk (GAP-D G260, G274).
 * GET /v1/products · filter kategori/harga/ketersediaan.
 * Terpisah dari konten showcase sosial (G251).
 */
import { useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"

import { ROUTES } from "@/lib/routes"
import { api } from "@/lib/api"
import type { Product } from "@/lib/api/products"
import { PRODUCT_STATUS_LABEL, sellableQty } from "@/lib/api/products"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { useTheme } from "@/components/theme-provider"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { Package } from "phosphor-react-native"

export default function CatalogScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()
  const c = tokens.colors[mode]
  const successText = tokens.colors.semantic.success[mode].text
  const dangerText = tokens.colors.semantic.danger[mode].text
  const [q, setQ] = useState("")
  const [inStockOnly, setInStockOnly] = useState(true)
  const query = usePaginatedQuery<Product>(
    `catalog:${q}:${inStockOnly ? 1 : 0}`,
    (page, signal) => api.products.listCatalog({ page, limit: 20, q: q.trim() || undefined, inStockOnly }, signal),
    { refreshOnFocus: true },
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Katalog Produk" />
      <View style={{ padding: tokens.space[4], gap: tokens.space[2] }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Cari produk…"
          placeholderTextColor={c.textTertiary}
          style={{ borderWidth: 1, borderColor: c.borderDefault, borderRadius: tokens.radius.md, padding: tokens.space[3], color: c.textPrimary }}
        />
        <Pressable onPress={() => setInStockOnly((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[2] }}>
          <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: c.borderDefault, backgroundColor: inStockOnly ? c.primary : "transparent" }} />
          <Text>Hanya yang tersedia</Text>
        </Pressable>
      </View>
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={<EmptyState icon={Package} title="Tidak ada produk" description="Coba kata kunci lain." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(ROUTES.productDetail(item.id))} style={{ paddingHorizontal: tokens.space[4], marginBottom: tokens.space[3] }}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontWeight: "700", flex: 1 }} numberOfLines={2}>{item.name}</Text>
                <Badge>{PRODUCT_STATUS_LABEL[item.status]}</Badge>
              </View>
              <Text style={{ color: c.textTertiary, fontSize: 12 }}>{item.category} · SKU {item.sku}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: tokens.space[1] }}>
                <Text style={{ fontWeight: "800" }}>{formatRupiah(item.priceRupiah)}</Text>
                <Text style={{ color: sellableQty(item) > 0 ? successText : dangerText }}>
                  {sellableQty(item) > 0 ? `Stok ${sellableQty(item)}` : "Habis"}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  )
}
