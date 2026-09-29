/**
 * Screen — Form Produk Seller (GAP-D G256, G262, G265).
 * POST/PUT /v1/products · tambah/edit katalog dengan validasi SKU.
 * Dipanggil sebagai /seller/products/new atau /seller/products/[id].
 */
import { useEffect, useState } from "react"
import { ScrollView, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { api } from "@/lib/api"
import type { Product, ProductStatus } from "@/lib/api/products"
import { PRODUCT_STATUS_LABEL } from "@/lib/api/products"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/components/ui/toast"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { DataScreen } from "@/components/ui/data-screen"

const STATUSES: ProductStatus[] = ["DRAFT", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED"]

function Field({ label, errorText, children }: { label: string; errorText?: string; children: React.ReactNode }) {
  const { mode } = useTheme()
  // FE-051: error inline per field — bukan Alert generik. Warna danger.text
  // dari tokens (mode-aware).
  const errorColor = mode === "dark" ? "#F87171" : "#B42318"
  return (
    <View style={{ gap: tokens.space[1] }}>
      <Text style={{ fontWeight: "600" }}>{label}</Text>
      {children}
      {errorText ? (
        <Text style={{ color: errorColor, fontSize: 12 }}>{errorText}</Text>
      ) : null}
    </View>
  )
}

/** FE-051: validasi per field — harga harus angka > 0. */
type ProductField = "sku" | "name" | "category" | "price"
function validateProductField(field: ProductField, value: string): string | undefined {
  switch (field) {
    case "sku":
      return value.trim() ? undefined : "SKU wajib diisi."
    case "name":
      return value.trim() ? undefined : "Nama produk wajib diisi."
    case "category":
      return value.trim() ? undefined : "Kategori wajib diisi."
    case "price": {
      if (!value.trim()) return "Harga wajib diisi."
      const n = Math.round(Number(value.replace(/\D/g, "")))
      return Number.isFinite(n) && n > 0 ? undefined : "Harga harus angka lebih dari 0."
    }
  }
}

export default function SellerProductFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const isNew = id === "new"
  const router = useRouter()
  const { mode } = useTheme()
  const toast = useToast()
  const c = tokens.colors[mode]
  const [saving, setSaving] = useState(false)
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [priceIdr, setPriceIdr] = useState("")
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
      setPriceIdr(String(existing.priceRupiah))
      setStock(String(existing.quantityAvailable))
      setWeight(existing.weightGrams ? String(existing.weightGrams) : "")
      setLowStock(String(existing.lowStockThreshold))
      setStatus(existing.status)
    }
  }, [existing, hydrated])

  function inputStyle() {
    return {
      borderWidth: 1,
      borderColor: c.borderDefault,
      borderRadius: tokens.radius.md,
      padding: tokens.space[3],
      color: c.textPrimary,
    }
  }

  async function save() {
    // Kontrak backend: priceRupiah dalam RUPIAH bulat (server konversi ke sen).
    // FE-051: validasi inline per field — submit menandai SEMUA field invalid
    // (bukan Alert generik). Body API & alur simpan tidak berubah.
    const next: Partial<Record<ProductField, string>> = {
      sku: validateProductField("sku", sku),
      name: validateProductField("name", name),
      category: validateProductField("category", category),
      price: validateProductField("price", priceIdr),
    }
    setErrors(next)
    if (Object.values(next).some(Boolean)) return
    const priceRupiah = Math.round(Number(priceIdr.replace(/\D/g, "")))
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
    <View style={{ padding: tokens.space[4], gap: tokens.space[3] }}>
      <Field label="SKU *" errorText={errors.sku}><TextInput value={sku} onChangeText={(v) => changeField("sku", v, setSku)} onBlur={() => touchField("sku", sku)} autoCapitalize="characters" editable={isNew} accessibilityLabel="SKU, wajib diisi" placeholderTextColor={c.textTertiary} style={inputStyle()} /></Field>
      <Field label="Nama produk *" errorText={errors.name}><TextInput value={name} onChangeText={(v) => changeField("name", v, setName)} onBlur={() => touchField("name", name)} accessibilityLabel="Nama produk, wajib diisi" placeholderTextColor={c.textTertiary} style={inputStyle()} /></Field>
      <Field label="Kategori *" errorText={errors.category}><TextInput value={category} onChangeText={(v) => changeField("category", v, setCategory)} onBlur={() => touchField("category", category)} accessibilityLabel="Kategori, wajib diisi" placeholderTextColor={c.textTertiary} style={inputStyle()} /></Field>
      <Field label="Harga (Rp) *" errorText={errors.price}><TextInput value={priceIdr} onChangeText={(v) => changeField("price", v, setPriceIdr)} onBlur={() => touchField("price", priceIdr)} keyboardType="numeric" accessibilityLabel="Harga dalam rupiah, wajib diisi" placeholderTextColor={c.textTertiary} style={inputStyle()} /></Field>
      <Field label="Stok awal"><TextInput value={stock} onChangeText={setStock} keyboardType="numeric" accessibilityLabel="Stok awal" placeholderTextColor={c.textTertiary} style={inputStyle()} /></Field>
      <Field label="Berat (gram)"><TextInput value={weight} onChangeText={setWeight} keyboardType="numeric" accessibilityLabel="Berat dalam gram" placeholderTextColor={c.textTertiary} style={inputStyle()} /></Field>
      <Field label="Ambang stok menipis"><TextInput value={lowStock} onChangeText={setLowStock} keyboardType="numeric" accessibilityLabel="Ambang stok menipis" placeholderTextColor={c.textTertiary} style={inputStyle()} /></Field>
      {!isNew ? (
        <Field label="Status">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[2] }}>
            {STATUSES.map((s) => (
              <Button key={s} variant={status === s ? "primary" : "secondary"} onPress={() => setStatus(s)}>
                {PRODUCT_STATUS_LABEL[s]}
              </Button>
            ))}
          </View>
        </Field>
      ) : null}
      <Field label="Deskripsi">
        <TextInput value={description} onChangeText={setDescription} multiline accessibilityLabel="Deskripsi produk" numberOfLines={4} textAlignVertical="top" placeholderTextColor={c.textTertiary} style={inputStyle()} />
      </Field>
      <Text style={{ color: c.textTertiary, fontSize: 12 }}>
        Harga dikirim ke server dalam rupiah; penyimpanan presisi (sen) ditangani server.
      </Text>
      <Button disabled={saving} onPress={save}>
        {saving ? "Menyimpan…" : "Simpan Produk"}
      </Button>
    </View>
  )

  if (isNew) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header title="Tambah Produk" />
        <ScrollView>{formFields}</ScrollView>
      </Screen>
    )
  }
  return (
    <DataScreen title="Ubah Produk" state={existingQuery} loadingMessage="Memuat produk…">
      {existing ? formFields : null}
    </DataScreen>
  )
}
