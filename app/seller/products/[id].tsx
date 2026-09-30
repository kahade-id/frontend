/**
 * Screen — Form Produk Seller (GAP-D G256, G262, G265).
 * POST/PUT /v1/products · tambah/edit katalog dengan validasi SKU.
 * Dipanggil sebagai /seller/products/new atau /seller/products/[id].
 */
import { useEffect, useState } from "react"
import { ScrollView, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { api } from "@/lib/api"
import type { Product, ProductStatus } from "@/lib/api/products"
import { PRODUCT_STATUS_LABEL } from "@/lib/api/products"
import { formatRupiah } from "@/lib/format"
import { formatRupiahTyping, parseRupiahTyping } from "@/lib/rupiah-input"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useToast } from "@/components/ui/toast"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { DataScreen } from "@/components/ui/data-screen"

const STATUSES: ProductStatus[] = ["DRAFT", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED"]

/** FE-051: validasi per field — harga memakai state ANGKA (FE-052). */
type ProductField = "sku" | "name" | "category" | "price"
function validateProductField(field: ProductField, value: string | number | null): string | undefined {
  switch (field) {
    case "sku":
      return typeof value === "string" && value.trim() ? undefined : "SKU wajib diisi."
    case "name":
      return typeof value === "string" && value.trim() ? undefined : "Nama produk wajib diisi."
    case "category":
      return typeof value === "string" && value.trim() ? undefined : "Kategori wajib diisi."
    case "price": {
      if (value == null) return "Harga wajib diisi."
      const n = Math.round(Number(value))
      return Number.isFinite(n) && n > 0 ? undefined : "Harga harus angka lebih dari 0."
    }
  }
}

export default function SellerProductFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isNew = id === "new"
  const router = useRouter()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  // FE-052: state menyimpan ANGKA (rupiah); tampilan berformat "1.500.000"
  // via formatRupiahTyping — pola yang sama dengan showcase/create.tsx.
  const [priceIdr, setPriceIdr] = useState<number | null>(null)
  const [stock, setStock] = useState("0")
  const [weight, setWeight] = useState("")
  const [lowStock, setLowStock] = useState("5")
  const [status, setStatus] = useState<ProductStatus>("DRAFT")
  const [hydrated, setHydrated] = useState(false)
  /** FE-051: error inline per field — undefined = valid/belum disentuh. */
  const [errors, setErrors] = useState<Partial<Record<ProductField, string>>>({})

  /** Validasi satu field saat blur. */
  function touchField(field: ProductField, value: string) {
    setErrors((prev) => ({ ...prev, [field]: validateProductField(field, value) }))
  }
  /** Saat mengetik: perbarui error yang SUDAH aktif (jangan ganggu yang valid). */
  function changeField(field: ProductField, value: string, set: (v: string) => void) {
    set(value)
    setErrors((prev) =>
      prev[field] ? { ...prev, [field]: validateProductField(field, value) } : prev,
    )
  }

  const existingQuery = useApiQuery<Product>(
    `seller-product:${String(id)}`,
    (signal) => api.products.getProduct(String(id), signal),
    !!id && !isNew,
  )

  const existing = existingQuery.data
  useEffect(() => {
    if (existing && !hydrated) {
      setHydrated(true)
      setSku(existing.sku)
      setName(existing.name)
      setDescription(existing.description ?? "")
      setCategory(existing.category)
      setPriceIdr(existing.priceRupiah)
      setStock(String(existing.quantityAvailable))
      setWeight(existing.weightGrams ? String(existing.weightGrams) : "")
      setLowStock(String(existing.lowStockThreshold))
      setStatus(existing.status)
    }
  }, [existing, hydrated])

  async function save() {
    // Kontrak backend: priceRupiah dalam RUPIAH bulat (server konversi ke sen).
    // FE-051: validasi inline per field — submit menandai SEMUA field invalid
    // (bukan Alert generik; FE-054 terpenuhi tanpa dialog tambahan).
    // Body API & alur simpan tidak berubah.
    const next: Partial<Record<ProductField, string>> = {
      sku: validateProductField("sku", sku),
      name: validateProductField("name", name),
      category: validateProductField("category", category),
      price: validateProductField("price", priceIdr),
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    // State priceIdr sudah angka (FE-052) — nilai mentah ke backend tak berubah.
    const priceRupiah = Math.round(priceIdr ?? NaN)
    const body = {
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      category: category.trim(),
      priceRupiah,
      quantityAvailable: Math.max(0, Number(stock.replace(/\D/g, "")) || 0),
      lowStockThreshold: Math.max(0, Number(lowStock.replace(/\D/g, "")) || 0),
      weightGrams: weight ? Number(weight.replace(/\D/g, "")) || undefined : undefined,
    }
    setSaving(true)
    try {
      if (isNew) {
        await api.products.createProduct(body)
      } else {
        await api.products.updateProduct(String(id), body)
        if (existing && existing.status !== status) {
          await api.products.setProductStatus(String(id), status)
        }
      }
      // UI-F018: konfirmasi sukses — sebelumnya langsung back tanpa umpan balik.
      toast.show({ title: "Produk disimpan", tone: "success", duration: 2500 })
      router.back()
    } catch (e) {
      showMutationError(toast.show, {
        failTitle: "Gagal menyimpan produk",
        uncertainHint: "Penyimpanan mungkin sudah diproses — periksa daftar produk sebelum mencoba lagi.",
        err: e,
      })
    } finally {
      setSaving(false)
    }
  }

  const formFields = (
    // UX-SPA-021: padding px-5 (20px) + gap-4 (16px) = standar FormSection —
    // dulu 16px/12px membuat form menjorok vs header di atasnya.
    <View style={{ padding: tokens.space[5], gap: tokens.space[4] }}>
      <Input
        label="SKU"
        required
        value={sku}
        onChangeText={(v) => changeField("sku", v, setSku)}
        onBlur={() => touchField("sku", sku)}
        autoCapitalize="characters"
        disabled={!isNew}
        errorText={errors.sku}
        accessibilityLabel="SKU, wajib diisi"
      />
      <Input
        label="Nama produk"
        required
        value={name}
        onChangeText={(v) => changeField("name", v, setName)}
        onBlur={() => touchField("name", name)}
        errorText={errors.name}
        accessibilityLabel="Nama produk, wajib diisi"
      />
      <Input
        label="Kategori"
        required
        value={category}
        onChangeText={(v) => changeField("category", v, setCategory)}
        onBlur={() => touchField("category", category)}
        errorText={errors.category}
        accessibilityLabel="Kategori, wajib diisi"
      />
      <Input
        label="Harga (Rp)"
        required
        // FE-052: pemisah ribuan saat mengetik ("1500000" → "1.500.000");
        // state tetap angka — nilai ke backend tetap mentah.
        value={formatRupiahTyping(priceIdr)}
        onChangeText={(raw) => {
          const parsed = parseRupiahTyping(raw)
          // undefined = ketikan tak valid (huruf/>15 digit) — abaikan.
          if (parsed === undefined) return
          setPriceIdr(parsed)
          // FE-051: perbarui error harga yang sudah aktif saat mengetik.
          setErrors((prev) =>
            prev.price ? { ...prev, price: validateProductField("price", parsed) } : prev,
          )
        }}
        onBlur={() =>
          setErrors((prev) => ({ ...prev, price: validateProductField("price", priceIdr) }))
        }
        keyboardType="numeric"
        errorText={errors.price}
        accessibilityLabel="Harga dalam rupiah, wajib diisi"
      />
      {priceIdr != null && priceIdr > 0 ? (
        <Text variant="caption" tone="secondary">
          Pratinjau: {formatRupiah(priceIdr)}
        </Text>
      ) : null}
      <Input
        label="Stok awal"
        value={stock}
        onChangeText={setStock}
        keyboardType="numeric"
        accessibilityLabel="Stok awal"
      />
      <Input
        label="Berat (gram)"
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
        accessibilityLabel="Berat dalam gram"
      />
      <Input
        label="Ambang stok menipis"
        value={lowStock}
        onChangeText={setLowStock}
        keyboardType="numeric"
        accessibilityLabel="Ambang stok menipis"
      />
      {!isNew ? (
        <View style={{ gap: tokens.space[1] }}>
          <Text weight={600}>Status</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
            {STATUSES.map((s) => (
              <Button key={s} variant={status === s ? "primary" : "secondary"} onPress={() => setStatus(s)}>
                {PRODUCT_STATUS_LABEL[s]}
              </Button>
            ))}
          </View>
        </View>
      ) : null}
      <TextArea
        label="Deskripsi"
        value={description}
        onChangeText={setDescription}
        rows={4}
        accessibilityLabel="Deskripsi produk"
      />
      <Text variant="bodySmall" tone="secondary">
        Harga dikirim ke server dalam rupiah; penyimpanan presisi (sen) ditangani server.
      </Text>
      <Button disabled={saving} onPress={save}>
        {saving ? "Menyimpan…" : "Simpan Produk"}
      </Button>
    </View>
  )

  if (isNew) {
    return (
      // UX-SPA-009: form 8 input + TextArea + Simpan — keyboard avoidance
      // agar field bawah & tombol Simpan tidak tertutup keyboard di iOS.
      <Screen edges={["top"]} padded={false} keyboardAvoiding>
        <Header title="Tambah Produk" />
        {/* FE-115: ketukan tombol tidak tertelan saat keyboard terbuka */}
        <ScrollView keyboardShouldPersistTaps="handled">{formFields}</ScrollView>
      </Screen>
    )
  }
  return (
    <DataScreen
      title="Ubah Produk"
      state={existingQuery}
      loadingMessage="Memuat produk…"
      // UX-SPA-009: cabang ubah — sama seperti cabang tambah di atas.
      keyboardAvoiding
    >
      {existing ? formFields : null}
    </DataScreen>
  )
}
