/**
 * Screen — Detail Produk (GAP-D G274).
 * GET /v1/products/[id] · kebijakan harga, varian & ketersediaan pre-checkout.
 */
import { useState } from "react"
import { Pressable, View } from "react-native"
import { useLocalSearchParams } from "expo-router"

import { api } from "@/lib/api"
import type { Product } from "@/lib/api/products"
import { PRODUCT_STATUS_LABEL, productStatusBadgeTone, sellableQty, variantLabel } from "@/lib/api/products"
import { formatRupiah, formatRupiahFromSen } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { PressableScale } from "@/components/ui/pressable-scale"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { mode } = useTheme()
  const toast = useToast()
  const c = tokens.colors[mode]
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [checking, setChecking] = useState(false)
  /** FE-054: hasil validasi ketersediaan memakai <Dialog> bermerek (bukan Alert.alert). */
  const [availability, setAvailability] = useState<{ ok: boolean; message: string } | null>(null)
  const query = useApiQuery<Product>(
    `product:${String(id)}`,
    (signal) => api.products.getProduct(String(id), signal),
    !!id,
    { refreshOnFocus: true, refreshOnFocusStaleMs: 30_000 }, // NC-003 (audit performa ronde-3): skip refetch fokus bila data <30 dtk.
  )
  const p = query.data

  async function validate() {
    if (!p || checking) return
    const variant = (p.variants ?? []).find((v) => v.id === selectedVariant)
    setChecking(true)
    try {
      const res = await api.products.preCheckoutValidate([{ sku: variant?.sku ?? p.sku, qty }])
      const line = res.lines[0]
      if (res.allOk && line?.sufficient) {
        setAvailability({ ok: true, message: `${p.name} × ${qty} — ${formatRupiahFromSen(line.currentPriceSen)}. Harga & stok terkonfirmasi server.` })
      } else {
        setAvailability({ ok: false, message: line?.message ?? "Stok atau harga berubah. Silakan muat ulang." })
        await query.reload()
      }
    } catch (e) {
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal validasi ketersediaan",
          uncertainHint: "Hasil validasi tidak pasti — memuat ulang data produk…",
          err: e,
        })
      ) {
        await query.reload()
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
    <DataScreen title="Detail Produk" state={query} loadingMessage="Memuat produk…">
      {p ? (
        <View style={{ paddingVertical: tokens.space[4], gap: tokens.space[4] }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text variant="h3" style={{ flex: 1 }}>{p.name}</Text>
              <Badge tone={productStatusBadgeTone(p.status)}>{PRODUCT_STATUS_LABEL[p.status]}</Badge>
            </View>
            <Text variant="body" tone="secondary" style={{ marginTop: tokens.space[1] }}>
              {p.category} · SKU <Text variant="monoBody" tone="secondary">{p.sku}</Text>
            </Text>
            {p.description ? <Text variant="body" style={{ marginTop: tokens.space[2] }}>{p.description}</Text> : null}
            <Amount value={priceOf(p, selectedVariant)} size="body" style={{ marginTop: tokens.space[2] }} />
            <Text
              variant="body"
              tone={stockOf(p, selectedVariant) > 0 ? "success" : "danger"}
              style={{ marginTop: tokens.space[1] }}
            >
              {stockOf(p, selectedVariant) > 0 ? `Stok tersedia: ${stockOf(p, selectedVariant)}` : "Stok habis"}
            </Text>
            {p.requiresBusinessVerification ? (
              <Text variant="bodySmall" tone="warning" style={{ marginTop: tokens.space[1] }}>
                Hanya dapat dibeli dari penjual terverifikasi bisnis.
              </Text>
            ) : null}
          </Card>

          {(p.variants ?? []).length > 0 ? (
            <Card>
              <SectionHeader title="Pilih varian" />
              <View style={{ gap: tokens.space[2] }}>
                {(p.variants ?? []).map((v) => (
                  // UX-TCH-008: PressableScale (feedback scale saat ditekan);
                  // gaya visual dinamis tetap di View dalam karena primitif
                  // tidak menerima prop `style`.
                  <PressableScale
                    key={v.id}
                    onPress={() => setSelectedVariant(v.id)}
                    // UI-F002 (lanjutan): opsi varian ikut diberi role + state
                    // terpilih untuk screen reader.
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedVariant === v.id }}
                    accessibilityLabel={variantLabel(v)}
                  >
                    <View
                      style={{
                        padding: tokens.space[3], borderRadius: tokens.radius.md, borderWidth: 1,
                        borderColor: selectedVariant === v.id ? c.primary : c.borderDefault,
                      }}
                    >
                      <Text variant="body" weight={600}>{variantLabel(v)}</Text>
                      <Text variant="caption" tone="secondary">
                        {v.sku} · {formatRupiah(v.priceRupiah ?? p.priceRupiah)} · Stok {Math.max(0, v.quantityAvailable - v.quantityReserved)}
                      </Text>
                    </View>
                  </PressableScale>
                ))}
              </View>
            </Card>
          ) : null}

          <Card>
            <SectionHeader title="Jumlah" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[3] }}>
              {/* UI-F002: target sentuh ≥44pt + label aksesibilitas (sebelumnya
                  ≈35pt tanpa label — screen reader hanya membaca "−"/"+"). */}
              <Pressable
                onPress={() => setQty((x) => Math.max(1, x - 1))}
                accessibilityRole="button"
                accessibilityLabel="Kurangi jumlah"
                style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderDefault, borderRadius: tokens.radius.md }}
              >
                <Text variant="h3">−</Text>
              </Pressable>
              <Text variant="h3" accessibilityLabel={`Jumlah ${qty}`}>{qty}</Text>
              <Pressable
                onPress={() => setQty((x) => Math.min(99, x + 1))}
                accessibilityRole="button"
                accessibilityLabel="Tambah jumlah"
                style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderDefault, borderRadius: tokens.radius.md }}
              >
                <Text variant="h3">+</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: tokens.space[3] }}>
              <Button disabled={checking || stockOf(p, selectedVariant) <= 0} onPress={validate}>
                {checking ? "Memvalidasi…" : "Cek Ketersediaan & Harga"}
              </Button>
            </View>
            <Text variant="bodySmall" tone="secondary" style={{ marginTop: tokens.space[2] }}>
              Harga dan stok dikunci saat checkout berdasarkan data server terkini, bukan tampilan ini.
            </Text>
          </Card>
        </View>
      ) : null}
    </DataScreen>
      {/* FE-054: dialog hasil validasi bermerek (menggantikan Alert.alert informatif). */}
      <Dialog
        visible={availability != null}
        onRequestClose={() => setAvailability(null)}
        title={availability?.ok ? "Tersedia" : "Tidak tersedia"}
        description={availability?.message}
        tone={availability?.ok ? "success" : "danger"}
        confirmLabel="Tutup"
        hideCancel
        onConfirm={() => setAvailability(null)}
      />
    </>
  )
}

function priceOf(p: Product, selectedVariant: string | null) {
  const active = (p.variants ?? []).find((v) => v.id === selectedVariant) ?? null
  return active?.priceRupiah ?? p.priceRupiah
}

/**
 * FE-055: konversi sen -> Rupiah kini memakai helper kanonis
 * `formatRupiahFromSen` dari `@/lib/format` (satu aturan validasi §13).
 * `POST /v1/inventory/pre-checkout` mengembalikan `currentPriceSen` dalam SEN
 * (string BigInt). Satu-satunya field sen di domain produk — konversi lokal.
 */

function stockOf(p: Product, selectedVariant: string | null) {
  const active = (p.variants ?? []).find((v) => v.id === selectedVariant) ?? null
  return active ? Math.max(0, active.quantityAvailable - active.quantityReserved) : sellableQty(p)
}
