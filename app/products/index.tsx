/**
 * Screen — Katalog Produk (GAP-D G260, G274).
 * GET /v1/products · filter kategori/harga/ketersediaan.
 * Terpisah dari konten showcase sosial (G251).
 */
import { memo, useCallback, useState } from "react"
import { Pressable, View } from "react-native"
import { useRouter } from "expo-router"

import { ROUTES } from "@/lib/routes"
import { api } from "@/lib/api"
import type { Product } from "@/lib/api/products"
import { PRODUCT_STATUS_LABEL, productStatusBadgeTone, sellableQty } from "@/lib/api/products"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { useTheme } from "@/components/theme-provider"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { PressableScale } from "@/components/ui/pressable-scale"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { SearchField } from "@/components/ui/search-field"
import { Text } from "@/components/ui/text"
import { Package } from "phosphor-react-native"

/** PERF-FIX (TIM1-P1): baris di-memo — onPress stabil per id, tidak ada
 * closure inline per render. */
const ProductRow = memo(function ProductRow({
  item,
  onSelect,
}: {
  item: Product
  onSelect: (id: string) => void
}) {
  const handlePress = useCallback(() => onSelect(item.id), [onSelect, item.id])
  const qty = sellableQty(item)

  return (
    // UX-TCH-021: PressableScale (feedback scale saat ditekan); sebelumnya
    // Pressable polos. `mb-3 px-4` = tokens.space[3]/[4], sama persis dengan
    // style lama — tata letak tidak berubah.
    <PressableScale
      onPress={handlePress}
      // UI-F004: kartu butuh role + label — screen reader mengumumkan
      // nama, harga, dan stok.
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatRupiah(item.priceRupiah)}, ${qty > 0 ? `stok ${qty}` : "stok habis"}`}
      containerClassName="mb-3 px-4"
    >
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="body" weight={700} style={{ flex: 1 }} numberOfLines={2}>{item.name}</Text>
          <Badge tone={productStatusBadgeTone(item.status)}>{PRODUCT_STATUS_LABEL[item.status]}</Badge>
        </View>
        <Text variant="caption" tone="secondary">{item.category} · SKU {item.sku}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: tokens.space[1] }}>
          <Amount value={item.priceRupiah} size="body" />
          <Text tone={qty > 0 ? "success" : "danger"}>
            {qty > 0 ? `Stok ${qty}` : "Habis"}
          </Text>
        </View>
      </Card>
    </PressableScale>
  )
})

export default function CatalogScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mode } = useTheme()
  const c = tokens.colors[mode]
  // PERF-FIX (TIM1-P1): handler + renderItem stabil.
  const handleSelectProduct = useCallback((id: string) => router.push(ROUTES.productDetail(id)), [router])
  const renderProductItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductRow
        item={item}
        onSelect={handleSelectProduct}
      />
    ),
    [handleSelectProduct],
  )
  const [q, setQ] = useState("")
  const [inStockOnly, setInStockOnly] = useState(true)
  // UI-F001 (audit UI/UX 2026-09-27): debounce — tiap keystroke sebelumnya
  // mengganti kunci query (= 1 request + reset list + skeleton berkedip).
  const debouncedQ = useDebouncedValue(q)
  const query = usePaginatedQuery<Product>(
    `catalog:${debouncedQ}:${inStockOnly ? 1 : 0}`,
    (page, signal) => api.products.listCatalog({ page, limit: 20, q: debouncedQ.trim() || undefined, inStockOnly }, signal),
    // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
    { refreshOnFocus: true, refreshOnFocusStaleMs: 30_000 },
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Katalog Produk" />
      <View style={{ padding: tokens.space[4], gap: tokens.space[2] }}>
        {/* Inline search (bukan overlay): tanpa autoFocus agar keyboard
            tidak muncul saat layar dibuka. */}
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Cari produk…"
          autoFocus={false}
        />
        <Pressable
          onPress={() => setInStockOnly((v) => !v)}
          // UI-F003: checkbox kustom butuh role + state untuk screen reader.
          accessibilityRole="checkbox"
          accessibilityState={{ checked: inStockOnly }}
          accessibilityLabel="Hanya yang tersedia"
          style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[2] }}
        >
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
        empty={<EmptyState icon={Package} title="Belum ada produk" description="Coba kata kunci lain." />}
        renderItem={renderProductItem}
      />
    </Screen>
  )
}
